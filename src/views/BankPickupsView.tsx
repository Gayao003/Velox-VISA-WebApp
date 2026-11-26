import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { BankPickupRecord, BankPickupStatus } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { useDataCache } from '../context/DataCacheContext';
import { authService } from '../core/auth/authService';
import { formatCurrency, todayIso, nowTimeHHMM, getNextIncrementRef } from '../lib/format';
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

type SortField = 'pickUpDate' | 'stationId' | 'depositSlipRef' | 'slipAmount' | 'countedAmount' | 'status';

export const BankPickupsView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const { bankPickups: records } = useDataCache();
  const isLoading = false;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('pickUpDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankPickupRecord | null>(null);
  const [toDelete, setToDelete] = useState<BankPickupRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [stationId, setStationId] = useState('');
  const [pickUpDate, setPickUpDate] = useState(todayIso());
  const [pickUpTime, setPickUpTime] = useState(nowTimeHHMM());
  const [bankRepresentative, setBankRepresentative] = useState('');
  const [depositSlipRef, setDepositSlipRef] = useState('');
  const [depositType, setDepositType] = useState('Cash');
  const [slipAmount, setSlipAmount] = useState<number>(0);
  const [countedAmount, setCountedAmount] = useState<number>(0);
  const [status, setStatus] = useState<BankPickupStatus>('In-transit');

  const openModal = (rec?: BankPickupRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setPickUpDate(rec.pickUpDate);
      setPickUpTime(rec.pickUpTime);
      setBankRepresentative(rec.bankRepresentative);
      setDepositSlipRef(rec.depositSlipRef);
      setDepositType(rec.depositType);
      setSlipAmount(rec.slipAmount);
      setCountedAmount(rec.countedAmount);
      setStatus(rec.status);
    } else {
      setEditing(null);
      setStationId(
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-ABA'
      );
      setPickUpDate(todayIso());
      setPickUpTime(nowTimeHHMM());
      setBankRepresentative('');
      setDepositSlipRef(
        getNextIncrementRef(
          'BPK-SLIP',
          records.map((r) => r.depositSlipRef)
        )
      );
      setDepositType(lovs.depositTypes[0] || 'Cash');
      setSlipAmount(0);
      setCountedAmount(0);
      setStatus('In-transit');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: BankPickupRecord = {
        id: editing?.id || `bpk_${Date.now()}`,
        stationId,
        pickUpDate,
        pickUpTime,
        bankRepresentative: bankRepresentative.trim(),
        depositSlipRef: depositSlipRef.trim(),
        depositType,
        slipAmount: Number(slipAmount) || 0,
        countedAmount: Number(countedAmount) || 0,
        status,
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('bank_pickups', rec);
      toast(editing ? 'Bank pickup updated' : 'Bank pickup added', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save bank pickup', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('bank_pickups', toDelete.id);
      toast('Bank pickup record deleted', 'info');
      setToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Implements the business rule from Bank Pickup Registry V2.xlsx Notes:
  // Set status of all In-transit records with pickUpDate < today (on weekdays) to Deposited.
  const handleMarkDueDeposited = async () => {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) {
      toast('Today is a weekend — banking deposits settle on the next business day.', 'warning');
      return;
    }
    const todayStr = todayIso();
    const due = records.filter((r) => r.status === 'In-transit' && r.pickUpDate < todayStr);
    if (due.length === 0) {
      toast('No overdue In-transit pickups to mark as Deposited.', 'info');
      return;
    }
    await Promise.all(
      due.map((r) =>
        firestoreService.save('bank_pickups', {
          ...r,
          status: 'Deposited',
          updatedAt: new Date().toISOString(),
        })
      )
    );
    toast(`Marked ${due.length} past-date pickup(s) as Deposited`, 'success');
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
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        !q ||
        r.stationId.toLowerCase().includes(q) ||
        r.depositSlipRef.toLowerCase().includes(q) ||
        r.bankRepresentative.toLowerCase().includes(q);
      return matchStation && matchStatus && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'depositSlipRef': cmp = a.depositSlipRef.localeCompare(b.depositSlipRef); break;
        case 'slipAmount': cmp = a.slipAmount - b.slipAmount; break;
        case 'countedAmount': cmp = a.countedAmount - b.countedAmount; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'pickUpDate':
        default: cmp = (a.pickUpDate || '').localeCompare(b.pickUpDate || ''); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, statusFilter, searchTerm, sortField, sortOrder]);

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
          inTransit: acc.inTransit + (r.status === 'In-transit' ? Number(r.slipAmount) || 0 : 0),
          slipTotal: acc.slipTotal + (Number(r.slipAmount) || 0),
          countedTotal: acc.countedTotal + (Number(r.countedAmount) || 0),
        }),
        { inTransit: 0, slipTotal: 0, countedTotal: 0 }
      ),
    [filtered]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Bank Pickups"
        title="Bank Pickup Registry"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Pickup' : 'Pickups'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Bank Pickup Registry V2 — Deposit In-Transit & Counted Verification</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{selectedStation}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={handleMarkDueDeposited}
              className="font-semibold"
              title="Set status of past-date In-transit pickups (weekday rule) to Deposited"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span>Settle Due Pickups</span>
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                ExportService.exportBankPickups(filtered);
                toast('Exported Bank Pickup Registry to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add Pickup</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Deposit In-Transit
          </div>
          <div className="text-xl font-extrabold text-amber-600 mt-1 font-mono">
            ₱{formatCurrency(summary.inTransit)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Slip Total
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            ₱{formatCurrency(summary.slipTotal)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Counted Total
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
            ₱{formatCurrency(summary.countedTotal)}
          </div>
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Deposit Slip Ref, Bank Representative, Station..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="In-transit">In-transit</option>
            <option value="Deposited">Deposited</option>
          </select>
        }
      />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No Bank Pickups Found"
          description="Log armored/bank representative pickups and track In-transit vs Deposited status."
          actionLabel="Add Pickup"
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
                <SortableHead field="pickUpDate" activeField={sortField} onSort={handleSort}>
                  Pick Up Date & Time
                </SortableHead>
                <TableHead>Bank Representative</TableHead>
                <SortableHead field="depositSlipRef" activeField={sortField} onSort={handleSort}>
                  Deposit Slip Ref.
                </SortableHead>
                <SortableHead field="slipAmount" activeField={sortField} onSort={handleSort} className="text-right">
                  Slip Amount
                </SortableHead>
                <SortableHead field="countedAmount" activeField={sortField} onSort={handleSort} className="text-right">
                  Counted Amount
                </SortableHead>
                <SortableHead field="status" activeField={sortField} onSort={handleSort}>
                  Status
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
                    <div className="font-medium text-slate-800">{r.pickUpDate}</div>
                    <div className="text-[11px] text-slate-500">{r.pickUpTime}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Truck className="h-3.5 w-3.5 text-slate-400" />
                      <span>{r.bankRepresentative || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{r.depositType}</div>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-blue-700">
                    {r.depositSlipRef}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    ₱{formatCurrency(r.slipAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    ₱{formatCurrency(r.countedAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'Deposited' ? 'success' : 'warning'}>
                      {r.status}
                    </Badge>
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
        title={editing ? 'Edit Bank Pickup' : 'New Bank Pickup'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Station ID</label>
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
                Bank Representative
              </label>
              <Input
                value={bankRepresentative}
                onChange={(e) => setBankRepresentative(e.target.value)}
                placeholder="Representative name"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Pick Up Date
              </label>
              <Input
                type="date"
                value={pickUpDate}
                onChange={(e) => setPickUpDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Pick Up Time
              </label>
              <Input
                type="time"
                value={pickUpTime}
                onChange={(e) => setPickUpTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Slip Ref.
              </label>
              <Input
                value={depositSlipRef}
                onChange={(e) => setDepositSlipRef(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Type
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
                Slip Amount
              </label>
              <Input
                type="number"
                step="0.01"
                value={slipAmount}
                onChange={(e) => setSlipAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Counted Amount
              </label>
              <Input
                type="number"
                step="0.01"
                value={countedAmount}
                onChange={(e) => setCountedAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BankPickupStatus)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold"
              >
                <option value="In-transit">In-transit</option>
                <option value="Deposited">Deposited</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'Update Pickup' : 'Save Pickup'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Bank Pickup"
        description={`Delete bank pickup slip "${toDelete?.depositSlipRef}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
