import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileSpreadsheet, PlusCircle, Pencil, Trash2, MapPin, Landmark } from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { ShiftDepositRecord } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { authService } from '../core/auth/authService';
import { formatCurrency, todayIso, getNextIncrementRef } from '../lib/format';
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

type SortField = 'date' | 'stationId' | 'depositSlipRef' | 'source' | 'amount' | 'depositType';

export const ShiftDepositsView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const [records, setRecords] = useState<ShiftDepositRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftDepositRecord | null>(null);
  const [toDelete, setToDelete] = useState<ShiftDepositRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [stationId, setStationId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState('1ST SHIFT');
  const [depositSlipRef, setDepositSlipRef] = useState('');
  const [source, setSource] = useState('Cash Sale');
  const [amount, setAmount] = useState<number>(0);
  const [depositType, setDepositType] = useState('Cash');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');

  useEffect(() => {
    setIsLoading(true);
    return firestoreService.subscribe<ShiftDepositRecord>('shift_deposits', (data) => {
      setRecords(data);
      setIsLoading(false);
    });
  }, []);

  const openModal = (rec?: ShiftDepositRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setDate(rec.date);
      setShift(rec.shift);
      setDepositSlipRef(rec.depositSlipRef);
      setSource(rec.source);
      setAmount(rec.amount);
      setDepositType(rec.depositType);
      setBankName(rec.bankName);
      setBankAccountNo(rec.bankAccountNo);
    } else {
      setEditing(null);
      setStationId(
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-ABA'
      );
      setDate(todayIso());
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setDepositSlipRef(
        getNextIncrementRef(
          'SLIP',
          records.map((r) => r.depositSlipRef)
        )
      );
      setSource(lovs.sources[0] || 'Cash Sale');
      setAmount(0);
      setDepositType(lovs.depositTypes[0] || 'Cash');
      setBankName('');
      setBankAccountNo('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: ShiftDepositRecord = {
        id: editing?.id || `sdep_${Date.now()}`,
        stationId,
        date,
        shift,
        depositSlipRef: depositSlipRef.trim(),
        source,
        amount: Number(amount) || 0,
        depositType,
        bankName: bankName.trim(),
        bankAccountNo: bankAccountNo.trim(),
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('shift_deposits', rec);
      toast(editing ? 'Shift deposit updated' : 'Shift deposit added', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save shift deposit', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('shift_deposits', toDelete.id);
      toast('Shift deposit deleted', 'info');
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
      const matchType = typeFilter === 'all' || r.depositType === typeFilter;
      const matchSearch =
        !q ||
        r.stationId.toLowerCase().includes(q) ||
        r.depositSlipRef.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.bankName.toLowerCase().includes(q) ||
        r.bankAccountNo.toLowerCase().includes(q);
      return matchStation && matchType && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'depositSlipRef': cmp = a.depositSlipRef.localeCompare(b.depositSlipRef); break;
        case 'source': cmp = a.source.localeCompare(b.source); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'depositType': cmp = a.depositType.localeCompare(b.depositType); break;
        case 'date':
        default: cmp = (a.date || '').localeCompare(b.date || ''); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, typeFilter, searchTerm, sortField, sortOrder]);

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
          total: acc.total + (Number(r.amount) || 0),
          cash: acc.cash + (r.depositType === 'Cash' ? Number(r.amount) || 0 : 0),
          cheque: acc.cheque + (r.depositType === 'Cheque' ? Number(r.amount) || 0 : 0),
        }),
        { total: 0, cash: 0, cheque: 0 }
      ),
    [filtered]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Shift Deposits"
        title="Shift Deposit Registry"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Deposit' : 'Deposits'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Shift Deposit Registry V3 — Depository Bank & Slip Tracking</span>
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
                ExportService.exportShiftDeposits(filtered, selectedStation);
                toast('Exported Shift Deposit Registry to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add Deposit</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Deposit Total
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            ₱{formatCurrency(summary.total)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cash Deposits
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
            ₱{formatCurrency(summary.cash)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cheque Deposits
          </div>
          <div className="text-xl font-extrabold text-blue-700 mt-1 font-mono">
            ₱{formatCurrency(summary.cheque)}
          </div>
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Deposit Slip Ref, Source, Bank Name, Account No..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">All Deposit Types</option>
            {lovs.depositTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No Shift Deposits Found"
          description="Record a shift deposit slip to track depository bank and account numbers."
          actionLabel="Add Deposit"
          onAction={() => openModal()}
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="stationId" activeField={sortField} onSort={handleSort}>
                  Station
                </SortableHead>
                <SortableHead field="date" activeField={sortField} onSort={handleSort}>
                  Date & Shift
                </SortableHead>
                <SortableHead field="depositSlipRef" activeField={sortField} onSort={handleSort}>
                  Deposit Slip Ref.
                </SortableHead>
                <SortableHead field="source" activeField={sortField} onSort={handleSort}>
                  Source
                </SortableHead>
                <SortableHead field="depositType" activeField={sortField} onSort={handleSort}>
                  Type
                </SortableHead>
                <TableHead>Depository Bank</TableHead>
                <SortableHead field="amount" activeField={sortField} onSort={handleSort} className="text-right">
                  Amount
                </SortableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => openModal(r)}
                  className="cursor-pointer hover:bg-blue-50/40"
                >
                  <TableCell className="font-bold text-slate-900">{r.stationId}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800">{r.date}</div>
                    <div className="text-[11px] font-semibold text-blue-600">{r.shift}</div>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-blue-700">
                    {r.depositSlipRef || '—'}
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">{r.source}</TableCell>
                  <TableCell>
                    <Badge variant={r.depositType === 'Cash' ? 'success' : 'default'}>
                      {r.depositType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Landmark className="h-3.5 w-3.5 text-slate-400" />
                      <span>{r.bankName || '—'}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{r.bankAccountNo}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    ₱{formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(r)}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(r)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationBar
            currentPage={validPage}
            totalPages={totalPages}
            totalEntries={totalEntries}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit Shift Deposit' : 'New Shift Deposit'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Station ID <span className="text-red-500">*</span>
              </label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                required
              >
                {lovs.stations.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
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
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                {lovs.shifts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Slip Ref. <span className="text-red-500">*</span>
              </label>
              <Input
                value={depositSlipRef}
                onChange={(e) => setDepositSlipRef(e.target.value)}
                placeholder="Auto-generated or enter slip #"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Source <span className="text-red-500">*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                {lovs.sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Type <span className="text-red-500">*</span>
              </label>
              <select
                value={depositType}
                onChange={(e) => setDepositType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                {lovs.depositTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Amount (₱) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Depository Bank Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. BDO / Metrobank / BPI"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Bank Account No. <span className="text-red-500">*</span>
              </label>
              <Input
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                placeholder="e.g. 00123-4567-89"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'Update Deposit' : 'Save Deposit'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Shift Deposit"
        description={`Delete deposit slip "${toDelete?.depositSlipRef}" (₱${formatCurrency(toDelete?.amount)})?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
