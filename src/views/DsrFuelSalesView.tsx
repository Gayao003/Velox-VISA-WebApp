import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  Plus,
  X,
} from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { DsrCashReportRecord, DsrReconcilingItem } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { useDataCache } from '../context/DataCacheContext';
import { authService } from '../core/auth/authService';
import { STATION_DSR_NAMES } from '../data/visaMasterData';
import { formatCurrency, todayIso } from '../lib/format';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { Badge } from '../core/ui/badge';
import { Modal } from '../core/ui/modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../core/ui/table';
import { ConfirmationModal } from '../core/modals/ConfirmationModal';
import { useToast } from '../core/ui/toast';
import {
  PageHeader,
  TableToolbar,
  PaginationBar,
  EmptyState,
  SortableHead,
} from '../components/PageShell';

type SortField =
  | 'date'
  | 'stationId'
  | 'shift'
  | 'cashToBeAccounted'
  | 'cashOnHand'
  | 'variance'
  | 'cashless';

const sumCashless = (r: { debit: number; credit: number; gcash: number; paymaya: number }) =>
  (Number(r.debit) || 0) +
  (Number(r.credit) || 0) +
  (Number(r.gcash) || 0) +
  (Number(r.paymaya) || 0);

const sumReconciling = (items?: DsrReconcilingItem[]) =>
  (items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);

export const DsrFuelSalesView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const { dsrCashReports: records } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'with_items' | 'variance'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DsrCashReportRecord | null>(null);
  const [toDelete, setToDelete] = useState<DsrCashReportRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state matching VISA Load Files Update 2.0/DSR schema
  const [stationId, setStationId] = useState('VLX-AG1');
  const [station, setStation] = useState(STATION_DSR_NAMES['VLX-AG1'] || '');
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState('1ST SHIFT');
  const [cashToBeAccounted, setCashToBeAccounted] = useState<number>(0);
  const [cashOnHand, setCashOnHand] = useState<number>(0);
  const [dateDeposited, setDateDeposited] = useState('');
  const [cashDeposited, setCashDeposited] = useState<number>(0);
  const [debit, setDebit] = useState<number>(0);
  const [credit, setCredit] = useState<number>(0);
  const [gcash, setGcash] = useState<number>(0);
  const [paymaya, setPaymaya] = useState<number>(0);
  const [reconcilingItems, setReconcilingItems] = useState<DsrReconcilingItem[]>([]);

  const openModal = (rec?: DsrCashReportRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setStation(rec.station || STATION_DSR_NAMES[rec.stationId] || rec.stationId);
      setDate(rec.date);
      setShift(rec.shift);
      setCashToBeAccounted(rec.cashToBeAccounted);
      setCashOnHand(rec.cashOnHand);
      setDateDeposited(rec.dateDeposited || '');
      setCashDeposited(rec.cashDeposited || 0);
      setDebit(rec.debit || 0);
      setCredit(rec.credit || 0);
      setGcash(rec.gcash || 0);
      setPaymaya(rec.paymaya || 0);
      setReconcilingItems(rec.reconcilingItems ? [...rec.reconcilingItems] : []);
    } else {
      const defaultSt =
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-AG1';
      setEditing(null);
      setStationId(defaultSt);
      setStation(STATION_DSR_NAMES[defaultSt] || defaultSt);
      setDate(todayIso());
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setCashToBeAccounted(0);
      setCashOnHand(0);
      setDateDeposited('');
      setCashDeposited(0);
      setDebit(0);
      setCredit(0);
      setGcash(0);
      setPaymaya(0);
      setReconcilingItems([]);
    }
    setIsModalOpen(true);
  };

  const handleStationChange = (newSt: string) => {
    setStationId(newSt);
    setStation(STATION_DSR_NAMES[newSt] || newSt);
  };

  const addReconcilingRow = () =>
    setReconcilingItems((prev) => [...prev, { item: '', amount: 0 }]);

  const updateReconcilingRow = (idx: number, patch: Partial<DsrReconcilingItem>) =>
    setReconcilingItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );

  const removeReconcilingRow = (idx: number) =>
    setReconcilingItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const cta = Number(cashToBeAccounted) || 0;
      const coh = Number(cashOnHand) || 0;
      const cleanItems = reconcilingItems
        .filter((x) => x.item.trim() !== '' || Number(x.amount) !== 0)
        .map((x) => ({ item: x.item.trim(), amount: Number(x.amount) || 0 }));

      const rec: DsrCashReportRecord = {
        id: editing?.id || `dsr_${Date.now()}`,
        stationId,
        station: station.trim() || STATION_DSR_NAMES[stationId] || stationId,
        date,
        shift,
        cashToBeAccounted: cta,
        cashOnHand: coh,
        variance: Number((coh - cta).toFixed(2)),
        dateDeposited: dateDeposited.trim(),
        cashDeposited: Number(cashDeposited) || 0,
        debit: Number(debit) || 0,
        credit: Number(credit) || 0,
        gcash: Number(gcash) || 0,
        paymaya: Number(paymaya) || 0,
        reconcilingItems: cleanItems,
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('dsr_cash_reports', rec);
      toast(editing ? 'DSR record updated' : 'DSR record added', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save DSR record', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('dsr_cash_reports', toDelete.id);
      toast('DSR record deleted', 'info');
      setToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const list = records.filter((r) => {
      const matchStation = selectedStation === 'All Stations' || r.stationId === selectedStation;
      const matchShift = shiftFilter === 'all' || r.shift === shiftFilter;
      const matchReconcile =
        reconcileFilter === 'all' ||
        (reconcileFilter === 'with_items' && (r.reconcilingItems || []).length > 0) ||
        (reconcileFilter === 'variance' && Math.abs(Number(r.variance) || 0) >= 0.01);
      const matchSearch =
        !q ||
        r.stationId.toLowerCase().includes(q) ||
        r.station.toLowerCase().includes(q) ||
        r.shift.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q) ||
        (r.reconcilingItems || []).some((x) => x.item.toLowerCase().includes(q));
      return matchStation && matchShift && matchReconcile && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'shift': cmp = a.shift.localeCompare(b.shift); break;
        case 'cashToBeAccounted': cmp = a.cashToBeAccounted - b.cashToBeAccounted; break;
        case 'cashOnHand': cmp = a.cashOnHand - b.cashOnHand; break;
        case 'variance': cmp = a.variance - b.variance; break;
        case 'cashless': cmp = sumCashless(a) - sumCashless(b); break;
        case 'date':
        default:
          cmp = (a.date || '').localeCompare(b.date || '') || a.shift.localeCompare(b.shift);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, shiftFilter, reconcileFilter, searchTerm, sortField, sortOrder]);

  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => filtered.slice((validPage - 1) * pageSize, validPage * pageSize),
    [filtered, validPage, pageSize]
  );

  const summary = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          cashToBeAccounted: acc.cashToBeAccounted + (Number(r.cashToBeAccounted) || 0),
          cashOnHand: acc.cashOnHand + (Number(r.cashOnHand) || 0),
          variance: acc.variance + (Number(r.variance) || 0),
          debit: acc.debit + (Number(r.debit) || 0),
          credit: acc.credit + (Number(r.credit) || 0),
          gcash: acc.gcash + (Number(r.gcash) || 0),
          paymaya: acc.paymaya + (Number(r.paymaya) || 0),
          reconcilingTotal: acc.reconcilingTotal + sumReconciling(r.reconcilingItems),
          reconcilingCount: acc.reconcilingCount + (r.reconcilingItems || []).length,
        }),
        {
          cashToBeAccounted: 0,
          cashOnHand: 0,
          variance: 0,
          debit: 0,
          credit: 0,
          gcash: 0,
          paymaya: 0,
          reconcilingTotal: 0,
          reconcilingCount: 0,
        }
      ),
    [filtered]
  );

  const totalCashless = summary.debit + summary.credit + summary.gcash + summary.paymaya;
  const liveVariance = (Number(cashOnHand) || 0) - (Number(cashToBeAccounted) || 0);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="DSR Cash Consolidated"
        title="Daily Sales Report (DSR)"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Shift' : 'Shifts'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Cash Consolidated — Cash Accounting, Cashless Tenders & Reconciling Items</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{selectedStation}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                ExportService.exportDsrCashReports(filtered);
                toast('Exported DSR Cash Consolidated to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add DSR Entry</span>
            </Button>
          </>
        }
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cash on Hand
          </div>
          <div className="text-2xl font-extrabold text-[#0E4DA4] mt-0.5 font-mono">
            ₱{formatCurrency(summary.cashOnHand)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">
            Expected: ₱{formatCurrency(summary.cashToBeAccounted)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Net Over / Short Variance
          </div>
          <div
            className={`text-2xl font-extrabold mt-0.5 font-mono ${
              summary.variance < 0
                ? 'text-red-600'
                : summary.variance > 0
                ? 'text-emerald-600'
                : 'text-slate-800'
            }`}
          >
            {summary.variance >= 0 ? '+' : ''}₱{formatCurrency(summary.variance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cash on Hand − Cash to be Accounted
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cashless Payments
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-0.5 font-mono">
            ₱{formatCurrency(totalCashless)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            GCash ₱{formatCurrency(summary.gcash)} • PayMaya ₱{formatCurrency(summary.paymaya)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Reconciling Items ({summary.reconcilingCount})
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-0.5 font-mono">
            ₱{formatCurrency(summary.reconcilingTotal)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
            Debit ₱{formatCurrency(summary.debit)} • Credit ₱{formatCurrency(summary.credit)}
          </div>
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Station, Date, Shift, or Reconciling Item..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <div className="flex items-center gap-2">
            <select
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Shifts</option>
              {lovs.shifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={reconcileFilter}
              onChange={(e) => {
                setReconcileFilter(e.target.value as 'all' | 'with_items' | 'variance');
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Records</option>
              <option value="with_items">With Reconciling Items</option>
              <option value="variance">With Variance</option>
            </select>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No DSR Records Found"
          description="Add a DSR shift record or run `npm run seed` to load VISA Load Files Update 2.0/DSR."
          actionLabel="Add DSR Entry"
          onAction={() => openModal()}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="date" activeField={sortField} onSort={handleSort}>
                  Date
                </SortableHead>
                <SortableHead field="stationId" activeField={sortField} onSort={handleSort}>
                  Station
                </SortableHead>
                <SortableHead field="shift" activeField={sortField} onSort={handleSort}>
                  Shift
                </SortableHead>
                <SortableHead
                  field="cashToBeAccounted"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Cash to Account
                </SortableHead>
                <SortableHead
                  field="cashOnHand"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Cash on Hand
                </SortableHead>
                <SortableHead
                  field="variance"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Variance
                </SortableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">GCash</TableHead>
                <TableHead className="text-right">PayMaya</TableHead>
                <TableHead>Reconciling Items</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => {
                const recSum = sumReconciling(r.reconcilingItems);
                const recCount = (r.reconcilingItems || []).length;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {r.date}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{r.stationId}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap">
                      {r.shift}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-700">
                      ₱{formatCurrency(r.cashToBeAccounted)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-extrabold text-[#0E4DA4]">
                      ₱{formatCurrency(r.cashOnHand)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold">
                      <Badge
                        variant={
                          r.variance < -0.01
                            ? 'danger'
                            : r.variance > 0.01
                            ? 'success'
                            : 'secondary'
                        }
                      >
                        {r.variance >= 0 ? '+' : ''}₱{formatCurrency(r.variance)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      ₱{formatCurrency(r.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      ₱{formatCurrency(r.credit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      ₱{formatCurrency(r.gcash)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      ₱{formatCurrency(r.paymaya)}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      {recCount === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          <Badge variant="warning" className="font-mono">
                            {recCount} item(s) • ₱{formatCurrency(recSum)}
                          </Badge>
                          <div
                            className="text-[11px] text-slate-500 truncate"
                            title={r.reconcilingItems
                              .map((x) => `${x.item}: ₱${formatCurrency(x.amount)}`)
                              .join('\n')}
                          >
                            {r.reconcilingItems[0]?.item}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openModal(r)}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(r)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar
        currentPage={validPage}
        totalPages={totalPages}
        totalEntries={totalEntries}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit DSR Cash Report' : 'Add DSR Cash Report'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Station ID <span className="text-red-500">*</span>
              </label>
              <select
                value={stationId}
                onChange={(e) => handleStationChange(e.target.value)}
                required
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {lovs.stations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Station Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="Mindanao : Region X : MisOr : CDO : Agusan 1"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Shift <span className="text-red-500">*</span>
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                required
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {lovs.shifts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cash Accounting & Deposit */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Cash Accounting & Deposit
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  liveVariance < -0.01
                    ? 'text-red-600'
                    : liveVariance > 0.01
                    ? 'text-emerald-600'
                    : 'text-slate-600'
                }`}
              >
                Variance: {liveVariance >= 0 ? '+' : ''}₱{formatCurrency(liveVariance)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cash to be Accounted (₱)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashToBeAccounted}
                  onChange={(e) => setCashToBeAccounted(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Cash on Hand (₱) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashOnHand}
                  onChange={(e) => setCashOnHand(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Date Deposited
                </label>
                <Input
                  type="date"
                  value={dateDeposited}
                  onChange={(e) => setDateDeposited(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cash Deposited (₱)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashDeposited}
                  onChange={(e) => setCashDeposited(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Cashless Tenders */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Cashless Payments (₱)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Debit</label>
                <Input
                  type="number"
                  step="0.01"
                  value={debit}
                  onChange={(e) => setDebit(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Credit</label>
                <Input
                  type="number"
                  step="0.01"
                  value={credit}
                  onChange={(e) => setCredit(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">GCash</label>
                <Input
                  type="number"
                  step="0.01"
                  value={gcash}
                  onChange={(e) => setGcash(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">PayMaya</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymaya}
                  onChange={(e) => setPaymaya(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Reconciling Items */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reconciling Items
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addReconcilingRow}>
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </Button>
            </div>
            {reconcilingItems.length === 0 ? (
              <div className="text-xs text-slate-400 py-1">No reconciling items for this shift.</div>
            ) : (
              <div className="space-y-2">
                {reconcilingItems.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        value={row.item}
                        onChange={(e) => updateReconcilingRow(idx, { item: e.target.value })}
                        placeholder="e.g. CHARGE TO ..."
                      />
                    </div>
                    <div className="w-36">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updateReconcilingRow(idx, {
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="Amount"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReconcilingRow(idx)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete DSR Cash Report"
        description={`Delete DSR for ${toDelete?.stationId} (${toDelete?.date} • ${toDelete?.shift})?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
