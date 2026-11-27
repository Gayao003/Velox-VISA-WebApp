import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import {
  DsrRecord,
  ShiftDepositRecord,
  ShiftCollectionRecord,
  MeterReadingRecord,
  BankPickupRecord,
  VdsRecord,
  DsrCashReportRecord,
} from '../models/visa';

const NAVY_BG = '0F2C59';
const SUBHEADER_BG = 'EAF0F5';
const TEXT_DARK = '172B3A';
const BORDER_COLOR = 'CBD5E1';
const MUTED_GRAY = '64748B';
const TOTAL_RED = 'DC2626';

const borderCell = {
  top: { style: 'thin', color: { rgb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
  left: { style: 'thin', color: { rgb: BORDER_COLOR } },
  right: { style: 'thin', color: { rgb: BORDER_COLOR } },
};

const borderHeader = {
  top: { style: 'medium', color: { rgb: NAVY_BG } },
  bottom: { style: 'medium', color: { rgb: NAVY_BG } },
  left: { style: 'thin', color: { rgb: '334155' } },
  right: { style: 'thin', color: { rgb: '334155' } },
};

const borderTotal = {
  top: { style: 'medium', color: { rgb: NAVY_BG } },
  bottom: { style: 'double', color: { rgb: NAVY_BG } },
  left: { style: 'thin', color: { rgb: BORDER_COLOR } },
  right: { style: 'thin', color: { rgb: BORDER_COLOR } },
};

const borderUnderline = {
  bottom: { style: 'thin', color: { rgb: '94A3B8' } },
};

const fontTitle = { name: 'Arial', sz: 13, bold: true, color: { rgb: NAVY_BG } };
const fontSubtitle = { name: 'Arial', sz: 10, bold: true, color: { rgb: MUTED_GRAY } };
const fontLabelBold = { name: 'Arial', sz: 9, bold: true, color: { rgb: TEXT_DARK } };
const fontValue = { name: 'Arial', sz: 9, bold: false, color: { rgb: TEXT_DARK } };
const fontHeaderWhite = { name: 'Arial', sz: 9, bold: true, color: { rgb: 'FFFFFF' } };
const fontData = { name: 'Arial', sz: 9, bold: false, color: { rgb: TEXT_DARK } };
const fontTotalBold = { name: 'Arial', sz: 10, bold: true, color: { rgb: TEXT_DARK } };
const fontTotalRed = { name: 'Arial', sz: 10, bold: true, color: { rgb: TOTAL_RED } };

function sanitizeCell(val: any): any {
  if (typeof val === 'string') {
    const t = val.trim();
    if (t.startsWith('=') || t.startsWith('+') || t.startsWith('-') || t.startsWith('@')) {
      return `'${val}`;
    }
  }
  return val;
}

/**
 * Injects OpenXML print setup so every exported sheet fits cleanly on 1 page wide when printed.
 */
async function saveWorkbookWithPageSetup(
  wb: any,
  filename: string,
  orientation: 'landscape' | 'portrait' = 'landscape',
  fitToHeight: number = 0
): Promise<void> {
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const zip = await JSZip.loadAsync(excelBuffer);

  for (const sheetPath of Object.keys(zip.files)) {
    if (sheetPath.startsWith('xl/worksheets/sheet') && sheetPath.endsWith('.xml')) {
      let xml = await zip.file(sheetPath)!.async('text');

      if (xml.includes('<sheetPr>')) {
        xml = xml.replace('<sheetPr>', '<sheetPr><pageSetUpPr fitToPage="1"/>');
      } else if (xml.includes('<sheetPr ')) {
        xml = xml.replace(/<sheetPr\b([^>]*)>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/>');
      } else {
        const wsMatch = xml.match(/<worksheet[^>]*>/);
        if (wsMatch) {
          xml = xml.replace(wsMatch[0], wsMatch[0] + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
        }
      }

      xml = xml.replace(/<printOptions[^>]*\/>/g, '');
      xml = xml.replace(/<pageMargins[^>]*\/>/g, '');
      xml = xml.replace(/<pageSetup[^>]*\/>/g, '');

      const printOptionsXml = '<printOptions horizontalCentered="1"/>';
      const pageMarginsXml =
        '<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>';
      const pageSetupXml = `<pageSetup orientation="${orientation}" paperSize="1" fitToWidth="1" fitToHeight="${fitToHeight}"/>`;
      const pageElements = printOptionsXml + pageMarginsXml + pageSetupXml;

      const subsequentTags = [
        '<headerFooter',
        '<rowBreaks',
        '<colBreaks',
        '<customProperties',
        '<cellWatches',
        '<ignoredErrors',
        '<smartTags',
        '<drawing',
        '<drawingHF',
        '<picture',
        '<oleObjects',
        '<controls',
        '<webPublishItems',
        '<tableParts',
        '<extLst',
      ];

      let earliestIndex = -1;
      for (const tag of subsequentTags) {
        const idx = xml.indexOf(tag);
        if (idx !== -1 && (earliestIndex === -1 || idx < earliestIndex)) {
          earliestIndex = idx;
        }
      }

      if (earliestIndex !== -1) {
        xml = xml.slice(0, earliestIndex) + pageElements + xml.slice(earliestIndex);
      } else {
        xml = xml.replace('</worksheet>', pageElements + '</worksheet>');
      }

      zip.file(sheetPath, xml);
    }
  }

  const finalBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface TableColumn<T> {
  header: string;
  align?: 'left' | 'center' | 'right';
  type?: 's' | 'n';
  numFmt?: string;
  minWidth?: number;
  maxWidth?: number;
  value: (row: T) => any;
}

async function buildStyledTableWorkbook<T>(options: {
  sheetName: string;
  filename: string;
  title: string;
  subtitle: string;
  metaRows: { label: string; value: string; highlightRed?: boolean; numFmt?: string; numVal?: number }[];
  columns: TableColumn<T>[];
  rows: T[];
  totalColIndex?: number;
  totalLabel?: string;
  orientation?: 'landscape' | 'portrait';
}) {
  const wb = XLSX.utils.book_new();
  const ws: any = {};
  const merges: any[] = [];
  const rowsConfig: any[] = [];
  const colCount = options.columns.length;
  const maxCol = Math.max(colCount - 1, 3);

  const setCell = (
    r: number,
    c: number,
    val: any,
    type: 's' | 'n' = 's',
    style: any = {},
    numFmt?: string,
    formula?: string
  ) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const safeVal = type === 's' ? sanitizeCell(val ?? '') : Number(val || 0);
    const cell: any = { t: type, v: safeVal, s: style };
    if (numFmt) cell.z = numFmt;
    if (formula) cell.f = formula;
    ws[addr] = cell;
  };

  const setMerged = (
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    val: any,
    type: 's' | 'n' = 's',
    style: any = {},
    numFmt?: string
  ) => {
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    setCell(r1, c1, val, type, style, numFmt);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r !== r1 || c !== c1) setCell(r, c, '', 's', style);
      }
    }
  };

  // Row 0: Title
  setMerged(0, 0, 0, maxCol, options.title, 's', {
    font: fontTitle,
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  rowsConfig[0] = { hpt: 22 };

  // Row 1: Subtitle
  setMerged(1, 0, 1, maxCol, options.subtitle, 's', {
    font: fontSubtitle,
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  rowsConfig[1] = { hpt: 16 };

  // Row 2: Spacer
  rowsConfig[2] = { hpt: 8 };

  // Metadata rows
  let r = 3;
  for (const m of options.metaRows) {
    setCell(r, 0, m.label, 's', {
      font: fontLabelBold,
      alignment: { horizontal: 'left', vertical: 'center' },
    });
    if (m.numVal !== undefined) {
      setMerged(
        r,
        1,
        r,
        2,
        m.numVal,
        'n',
        {
          font: m.highlightRed ? fontTotalRed : fontValue,
          border: borderUnderline,
          alignment: { horizontal: 'right', vertical: 'center' },
        },
        m.numFmt || '#,##0.00'
      );
    } else {
      setMerged(r, 1, r, 2, m.value, 's', {
        font: m.highlightRed ? fontTotalRed : fontValue,
        border: borderUnderline,
        alignment: { horizontal: 'left', vertical: 'center' },
      });
    }
    rowsConfig[r] = { hpt: 18 };
    r++;
  }

  // Spacer before table
  rowsConfig[r] = { hpt: 8 };
  r++;

  // Table Headers
  const headerRowIdx = r;
  options.columns.forEach((col, cIdx) => {
    setCell(headerRowIdx, cIdx, col.header, 's', {
      font: fontHeaderWhite,
      fill: { fgColor: { rgb: NAVY_BG } },
      border: borderHeader,
      alignment: { horizontal: col.align || 'center', vertical: 'center', wrapText: true },
    });
  });
  rowsConfig[headerRowIdx] = { hpt: 24 };
  r++;

  // Track max character width per column for auto-fitting
  const colWidths = options.columns.map((col, idx) => {
    let maxLen = col.header.length + 4;
    if (idx === 0) {
      for (const m of options.metaRows) {
        maxLen = Math.max(maxLen, m.label.length + 3);
      }
    }
    return maxLen;
  });

  const startDataRow = r;
  options.rows.forEach((rowData, rowIdx) => {
    const isAlt = rowIdx % 2 === 1;
    const fill = isAlt ? { fgColor: { rgb: 'F8FAFC' } } : undefined;

    options.columns.forEach((col, cIdx) => {
      const rawVal = col.value(rowData);
      const isNum = col.type === 'n';
      const displayStr = isNum
        ? Number(rawVal || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : String(rawVal ?? '');

      colWidths[cIdx] = Math.max(colWidths[cIdx], displayStr.length + 4);

      setCell(
        r,
        cIdx,
        rawVal,
        isNum ? 'n' : 's',
        {
          font: fontData,
          fill,
          border: borderCell,
          alignment: {
            horizontal: col.align || (isNum ? 'right' : 'left'),
            vertical: 'center',
            wrapText: true,
          },
        },
        col.numFmt
      );
    });

    rowsConfig[r] = { hpt: 20 };
    r++;
  });

  // Totals row
  if (options.totalColIndex !== undefined && options.rows.length > 0) {
    const tc = options.totalColIndex;
    const totalCol = options.columns[tc];
    const totalVal = options.rows.reduce((sum, row) => sum + (Number(totalCol.value(row)) || 0), 0);
    const excelStart = startDataRow + 1;
    const excelEnd = r;
    const colLetter = XLSX.utils.encode_col(tc);

    for (let c = 0; c < colCount; c++) {
      if (c === 0) {
        setCell(r, c, options.totalLabel || 'TOTAL', 's', {
          font: fontTotalBold,
          fill: { fgColor: { rgb: SUBHEADER_BG } },
          border: borderTotal,
          alignment: { horizontal: 'left', vertical: 'center' },
        });
      } else if (c === tc) {
        setCell(
          r,
          c,
          totalVal,
          'n',
          {
            font: fontTotalRed,
            fill: { fgColor: { rgb: SUBHEADER_BG } },
            border: borderTotal,
            alignment: { horizontal: 'right', vertical: 'center' },
          },
          totalCol.numFmt || '#,##0.00',
          `SUM(${colLetter}${excelStart}:${colLetter}${excelEnd})`
        );
      } else {
        setCell(r, c, '', 's', {
          font: fontTotalBold,
          fill: { fgColor: { rgb: SUBHEADER_BG } },
          border: borderTotal,
        });
      }
    }
    rowsConfig[r] = { hpt: 22 };
    r++;
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, 0), c: maxCol } });
  ws['!merges'] = merges;
  ws['!rows'] = rowsConfig;
  ws['!cols'] = colWidths.map((w, idx) => {
    const col = options.columns[idx];
    const clamped = Math.min(col.maxWidth ?? 42, Math.max(col.minWidth ?? 13, w));
    return { wch: clamped };
  });

  XLSX.utils.book_append_sheet(wb, ws, options.sheetName);
  await saveWorkbookWithPageSetup(wb, options.filename, options.orientation || 'landscape', 1);
}

export const ExportService = {
  async exportDsrList(records: DsrRecord[]) {
    await buildStyledTableWorkbook({
      sheetName: 'DSR Ledger',
      filename: `TRACE_DSR_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'DAILY SALES REPORT (DSR) — CREDIT SALES LEDGER',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Total Records:', value: `${records.length} DSR(s)` },
      ],
      columns: [
        { header: 'DSR No.', align: 'center', minWidth: 18, value: (r) => r.dsrNo },
        { header: 'Station ID', align: 'center', minWidth: 13, value: (r) => r.stationId },
        { header: 'Station Name', align: 'left', minWidth: 18, value: (r) => r.stationName },
        { header: 'Date', align: 'center', minWidth: 13, value: (r) => r.date },
        { header: 'Shift', align: 'center', minWidth: 13, value: (r) => r.shift },
        { header: 'Credit Customer Sales', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 18, value: (r) => r.creditCustomerSales },
        { header: 'Prepayment Sales', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.prepaymentSales },
        { header: 'Fleet Card - Customer', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 18, value: (r) => r.fleetCardCustomer },
        { header: 'Fleet Card - Inter-Co', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 18, value: (r) => r.fleetCardInterCompany },
        { header: 'Status', align: 'center', minWidth: 12, value: (r) => r.status.toUpperCase() },
        { header: 'Created By', align: 'left', minWidth: 16, value: (r) => r.createdBy },
      ],
      rows: records,
      totalColIndex: 5,
      totalLabel: 'TOTAL CREDIT CUSTOMER',
      orientation: 'landscape',
    });
  },

  async exportSingleDsr(r: DsrRecord) {
    const lineItems = [
      { category: 'Credit Customer Sales', amount: Number(r.creditCustomerSales) || 0 },
      { category: 'Prepayment Sales', amount: Number(r.prepaymentSales) || 0 },
      { category: 'Fleet Card Sales - Customer', amount: Number(r.fleetCardCustomer) || 0 },
      { category: 'Fleet Card Sales - Inter-Company', amount: Number(r.fleetCardInterCompany) || 0 },
    ];
    await buildStyledTableWorkbook({
      sheetName: 'DSR Report',
      filename: `${r.dsrNo}_${r.stationId}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'DAILY SALES REPORT (DSR) — STATION SUMMARY',
      metaRows: [
        { label: 'DSR No.:', value: r.dsrNo },
        { label: 'Station ID:', value: `${r.stationId} (${r.stationName})` },
        { label: 'Date / Shift:', value: `${r.date} • ${r.shift}` },
        { label: 'Status:', value: r.status.toUpperCase() },
        { label: 'Prepared By:', value: r.createdBy },
      ],
      columns: [
        { header: 'Credit Sales Category', align: 'left', minWidth: 34, value: (x) => x.category },
        { header: 'Amount (PHP)', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 20, value: (x) => x.amount },
      ],
      rows: lineItems,
      totalColIndex: 1,
      totalLabel: 'TOTAL CREDIT SALES',
      orientation: 'portrait',
    });
  },

  async exportShiftDeposits(records: ShiftDepositRecord[], stationFilter?: string) {
    const total = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    await buildStyledTableWorkbook({
      sheetName: 'Shift Deposit Registry',
      filename: `Shift_Deposit_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'SHIFT DEPOSIT REGISTRY V3',
      metaRows: [
        { label: 'Station ID:', value: stationFilter || 'All Stations' },
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Deposit Total:', value: '', highlightRed: true, numVal: total, numFmt: '#,##0.00' },
      ],
      columns: [
        { header: 'Station ID', align: 'center', minWidth: 13, value: (r) => r.stationId },
        { header: 'Date', align: 'center', minWidth: 13, value: (r) => r.date },
        { header: 'Shift', align: 'center', minWidth: 13, value: (r) => r.shift },
        { header: 'Deposit Slip Ref.', align: 'center', minWidth: 18, value: (r) => r.depositSlipRef },
        { header: 'Source', align: 'left', minWidth: 16, value: (r) => r.source },
        { header: 'Deposit Type', align: 'center', minWidth: 14, value: (r) => r.depositType },
        { header: 'Depository Bank', align: 'left', minWidth: 18, value: (r) => r.bankName },
        { header: 'Bank Account No.', align: 'center', minWidth: 18, value: (r) => r.bankAccountNo },
        { header: 'Amount', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.amount },
      ],
      rows: records,
      totalColIndex: 8,
      totalLabel: 'DEPOSIT TOTAL',
      orientation: 'landscape',
    });
  },

  async exportShiftCollections(records: ShiftCollectionRecord[]) {
    const total = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    await buildStyledTableWorkbook({
      sheetName: 'Shift Collection Registry',
      filename: `Shift_Collection_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'SHIFT COLLECTION REGISTRY V3.1',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Collection Total:', value: '', highlightRed: true, numVal: total, numFmt: '#,##0.00' },
      ],
      columns: [
        { header: 'Date', align: 'center', minWidth: 12, value: (r) => r.date },
        { header: 'Station ID', align: 'center', minWidth: 12, value: (r) => r.stationId },
        { header: 'Shift', align: 'center', minWidth: 12, value: (r) => r.shift },
        { header: 'Customer', align: 'left', minWidth: 28, maxWidth: 44, value: (r) => r.customer },
        { header: 'Purpose', align: 'left', minWidth: 16, value: (r) => r.purpose },
        { header: 'Deposit Slip Ref.', align: 'center', minWidth: 16, value: (r) => r.depositSlipRef },
        { header: 'SOA Ref', align: 'center', minWidth: 14, value: (r) => r.soaRef },
        { header: 'Payment Type', align: 'center', minWidth: 14, value: (r) => r.paymentType },
        { header: 'CR/AR #', align: 'center', minWidth: 14, value: (r) => r.crArNo },
        { header: 'Amount', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 15, value: (r) => r.amount },
        { header: 'Maya Ref', align: 'center', minWidth: 14, value: (r) => r.mayaPaymentRef },
        { header: 'Check #', align: 'center', minWidth: 13, value: (r) => r.checkNo },
        { header: 'Check Date', align: 'center', minWidth: 13, value: (r) => r.checkDate },
        { header: 'Issuing Bank', align: 'left', minWidth: 15, value: (r) => r.issuingBank },
        { header: 'Remarks', align: 'left', minWidth: 18, value: (r) => r.remarks },
      ],
      rows: records,
      totalColIndex: 9,
      totalLabel: 'TOTAL COLLECTION',
      orientation: 'landscape',
    });
  },

  async exportMeterReadings(records: MeterReadingRecord[]) {
    await buildStyledTableWorkbook({
      sheetName: 'Meter Reading',
      filename: `Meter_Reading_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'PUMP METER READING REGISTRY',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Total Readings:', value: `${records.length} Record(s)` },
      ],
      columns: [
        { header: 'Station ID', align: 'center', minWidth: 13, value: (r) => r.stationId },
        { header: 'Shift', align: 'center', minWidth: 13, value: (r) => r.shift },
        { header: 'Reading Date', align: 'center', minWidth: 14, value: (r) => r.readingDate },
        { header: 'Reading Time', align: 'center', minWidth: 14, value: (r) => r.readingTime },
        { header: 'Nozzle', align: 'left', minWidth: 18, value: (r) => r.nozzle },
        { header: 'TankRef', align: 'center', minWidth: 12, value: (r) => r.tankRef },
        { header: 'Product', align: 'left', minWidth: 16, value: (r) => r.product },
        { header: 'Reading Type', align: 'center', minWidth: 14, value: (r) => r.readingType },
        { header: 'Reading', align: 'right', type: 'n', numFmt: '#,##0.000', minWidth: 16, value: (r) => r.reading },
      ],
      rows: records,
      orientation: 'landscape',
    });
  },

  async exportBankPickups(records: BankPickupRecord[]) {
    const slipTotal = records.reduce((s, r) => s + (Number(r.slipAmount) || 0), 0);
    await buildStyledTableWorkbook({
      sheetName: 'Bank Pickup Registry',
      filename: `Bank_Pickup_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'BANK PICKUP REGISTRY V2',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Slip Total:', value: '', highlightRed: true, numVal: slipTotal, numFmt: '#,##0.00' },
      ],
      columns: [
        { header: 'Station ID', align: 'center', minWidth: 13, value: (r) => r.stationId },
        { header: 'Pick Up Date', align: 'center', minWidth: 14, value: (r) => r.pickUpDate },
        { header: 'Pick Up Time', align: 'center', minWidth: 14, value: (r) => r.pickUpTime },
        { header: 'Bank Representative', align: 'left', minWidth: 20, value: (r) => r.bankRepresentative },
        { header: 'Deposit Slip Ref.', align: 'center', minWidth: 18, value: (r) => r.depositSlipRef },
        { header: 'Deposit Type', align: 'center', minWidth: 14, value: (r) => r.depositType },
        { header: 'Slip Amount', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.slipAmount },
        { header: 'Counted Amount', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.countedAmount },
        { header: 'Status', align: 'center', minWidth: 14, value: (r) => r.status },
      ],
      rows: records,
      totalColIndex: 6,
      totalLabel: 'SLIP TOTAL',
      orientation: 'landscape',
    });
  },

  async exportVdsRegistry(records: VdsRecord[]) {
    const total = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    await buildStyledTableWorkbook({
      sheetName: 'VDS Registry',
      filename: `VDS_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE — TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'VDS REGISTRY V2',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'VDS Total:', value: '', highlightRed: true, numVal: total, numFmt: '#,##0.00' },
      ],
      columns: [
        { header: 'Station ID', align: 'center', minWidth: 13, value: (r) => r.stationId },
        { header: 'Date', align: 'center', minWidth: 13, value: (r) => r.date },
        { header: 'Deposit Slip Ref.', align: 'center', minWidth: 18, value: (r) => r.depositSlipRef },
        { header: 'VDS Ref. No.', align: 'center', minWidth: 18, value: (r) => r.vdsRefNo },
        { header: 'Deposit Date', align: 'center', minWidth: 14, value: (r) => r.depositDate },
        { header: 'Deposit Time', align: 'center', minWidth: 14, value: (r) => r.depositTime },
        { header: 'Deposit Type', align: 'center', minWidth: 14, value: (r) => r.depositType },
        { header: 'Amount', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.amount },
      ],
      rows: records,
      totalColIndex: 7,
      totalLabel: 'VDS TOTAL',
      orientation: 'landscape',
    });
  },

  async exportDsrCashReports(records: DsrCashReportRecord[]) {
    const cashTotal = records.reduce((s, r) => s + (Number(r.cashOnHand) || 0), 0);
    await buildStyledTableWorkbook({
      sheetName: 'DSR Cash Consolidated',
      filename: `TRACE_DSR_Cash_Consolidated_${new Date().toISOString().slice(0, 10)}.xlsx`,
      title: 'TRACE ? TRANSACTION RECONCILIATION, ASSURANCE & CONTROL ENGINE',
      subtitle: 'DAILY SALES REPORT (DSR) ? CASH & CASHLESS CONSOLIDATED',
      metaRows: [
        { label: 'Export Date:', value: new Date().toLocaleDateString('en-PH') },
        { label: 'Total Cash on Hand:', value: '', highlightRed: true, numVal: cashTotal, numFmt: '#,##0.00' },
      ],
      columns: [
        { header: 'Station ID', align: 'center', minWidth: 12, value: (r) => r.stationId },
        { header: 'Station', align: 'left', minWidth: 32, value: (r) => r.station },
        { header: 'Date', align: 'center', minWidth: 12, value: (r) => r.date },
        { header: 'Shift', align: 'center', minWidth: 12, value: (r) => r.shift },
        { header: 'Cash to be Accounted', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 18, value: (r) => r.cashToBeAccounted },
        { header: 'Cash on Hand', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 16, value: (r) => r.cashOnHand },
        { header: 'Variance', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 13, value: (r) => r.variance },
        { header: 'Date Deposited', align: 'center', minWidth: 14, value: (r) => r.dateDeposited || '' },
        { header: 'Cash Deposited', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 15, value: (r) => r.cashDeposited || 0 },
        { header: 'Debit', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 14, value: (r) => r.debit },
        { header: 'Credit', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 14, value: (r) => r.credit },
        { header: 'GCash', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 14, value: (r) => r.gcash },
        { header: 'PayMaya', align: 'right', type: 'n', numFmt: '#,##0.00', minWidth: 14, value: (r) => r.paymaya },
        {
          header: 'Reconciling Items',
          align: 'left',
          minWidth: 28,
          value: (r) => (r.reconcilingItems || []).map((x) => `${x.item} (${x.amount})`).join('; '),
        },
        {
          header: 'Reconciling Amount',
          align: 'right',
          type: 'n',
          numFmt: '#,##0.00',
          minWidth: 16,
          value: (r) => (r.reconcilingItems || []).reduce((s, x) => s + (Number(x.amount) || 0), 0),
        },
      ],
      rows: records,
      totalColIndex: 5,
      totalLabel: 'CASH ON HAND TOTAL',
      orientation: 'landscape',
    });
  },
};
