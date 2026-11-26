import * as XLSX from 'xlsx';
import {
  DsrRecord,
  ShiftDepositRecord,
  ShiftCollectionRecord,
  MeterReadingRecord,
  BankPickupRecord,
  VdsRecord,
} from '../models/visa';

export const ExportService = {
  exportDsrList(records: DsrRecord[]) {
    const rows = records.map((r) => ({
      'DSR No': r.dsrNo,
      'Station ID': r.stationId,
      'Station Name': r.stationName,
      Date: r.date,
      Shift: r.shift,
      'Credit Customer Sales': r.creditCustomerSales,
      'Prepayment Sales': r.prepaymentSales,
      'Fleet Card - Customer': r.fleetCardCustomer,
      'Fleet Card - Inter-Company': r.fleetCardInterCompany,
      Status: r.status.toUpperCase(),
      Notes: r.notes || '',
      'Created By': r.createdBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DSR Records');
    XLSX.writeFile(wb, `VISA_DSR_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportSingleDsr(r: DsrRecord) {
    const summaryRows = [
      ['Velox Integrated Station App (VISA) - Daily Sales Report'],
      ['DSR No:', r.dsrNo, 'Status:', r.status.toUpperCase()],
      ['Station ID:', r.stationId, 'Station Name:', r.stationName],
      ['Date:', r.date, 'Shift:', r.shift],
      [],
      ['CREDIT SALES', 'Amount'],
      ['Credit Customer Sales', r.creditCustomerSales],
      ['Prepayment Sales', r.prepaymentSales],
      ['Fleet Card Sales - Customer', r.fleetCardCustomer],
      ['Fleet Card Sales - Inter-Company', r.fleetCardInterCompany],
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DSR');
    XLSX.writeFile(wb, `${r.dsrNo}_${r.stationId}.xlsx`);
  },

  exportShiftDeposits(records: ShiftDepositRecord[], stationFilter?: string) {
    const total = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const headerRows = [
      ['Station ID:', stationFilter || 'All Stations'],
      ['Export Date:', new Date().toISOString().slice(0, 10)],
      ['Deposit Total:', total],
      [],
      ['Station ID', 'Date', 'Shift', 'Deposit Slip Ref.', 'Source', 'Amount', 'Deposit Type', 'Bank Name', 'Bank Account No.'],
      ...records.map((r) => [
        r.stationId,
        r.date,
        r.shift,
        r.depositSlipRef,
        r.source,
        r.amount,
        r.depositType,
        r.bankName,
        r.bankAccountNo,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Deposit Registry');
    XLSX.writeFile(wb, `Shift_Deposit_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportShiftCollections(records: ShiftCollectionRecord[]) {
    const rows = records.map((r) => ({
      Date: r.date,
      'Station ID': r.stationId,
      Shift: r.shift,
      Customer: r.customer,
      Purpose: r.purpose,
      'Deposit Slip Ref.': r.depositSlipRef,
      'SOA Ref': r.soaRef,
      'Payment Type': r.paymentType,
      'CR/AR #': r.crArNo,
      Amount: r.amount,
      'Maya Payment Ref': r.mayaPaymentRef,
      'Check #': r.checkNo,
      'Check Date': r.checkDate,
      'Issuing Bank': r.issuingBank,
      Remarks: r.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Collection Registry');
    XLSX.writeFile(wb, `Shift_Collection_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportMeterReadings(records: MeterReadingRecord[]) {
    const rows = records.map((r) => ({
      'Station ID': r.stationId,
      Shift: r.shift,
      'Reading Date': r.readingDate,
      'Reading Time': r.readingTime,
      Nozzle: r.nozzle,
      TankRef: r.tankRef,
      Product: r.product,
      Reading: r.reading,
      'Reading Type': r.readingType,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Meter Reading');
    XLSX.writeFile(wb, `Meter_Reading_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportBankPickups(records: BankPickupRecord[]) {
    const slipTotal = records.reduce((s, r) => s + (Number(r.slipAmount) || 0), 0);
    const countedTotal = records.reduce((s, r) => s + (Number(r.countedAmount) || 0), 0);
    const aoa = [
      ['Slip Total:', slipTotal, 'Counted Total:', countedTotal],
      [],
      ['Station ID', 'Pick Up Date', 'Pick Up Time', 'Bank Representative', 'Deposit Slip Ref.', 'Deposit Type', 'Slip Amount', 'Counted Amount', 'Status'],
      ...records.map((r) => [
        r.stationId,
        r.pickUpDate,
        r.pickUpTime,
        r.bankRepresentative,
        r.depositSlipRef,
        r.depositType,
        r.slipAmount,
        r.countedAmount,
        r.status,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Pickup Registry');
    XLSX.writeFile(wb, `Bank_Pickup_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportVdsRegistry(records: VdsRecord[]) {
    const rows = records.map((r) => ({
      'Station ID': r.stationId,
      Date: r.date,
      'Deposit Slip Ref.': r.depositSlipRef,
      'VDS Ref. No.': r.vdsRefNo,
      'Deposit Date': r.depositDate,
      'Deposit Time': r.depositTime,
      'Deposit Type': r.depositType,
      Amount: r.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VDS Registry');
    XLSX.writeFile(wb, `VDS_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },
};
