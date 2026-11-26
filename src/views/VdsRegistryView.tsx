import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileSpreadsheet, PlusCircle, Pencil, Trash2, MapPin } from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { VdsRecord } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { authService } from '../core/auth/authService';
import { formatCurrency, todayIso, nowTimeHHMM } from '../lib/format';
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

type SortField = 'date' | 'stationId' | 'depositSlipRef' | 'vdsRefNo' | 'depositDate' | 'amount';

export const VdsRegistryView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const [records, setRecords] = useState<VdsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<VdsRecord | null>(null);
  const [toDelete, setToDelete] = useState<VdsRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [stationId, setStationId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [depositSlipRef, setDepositSlipRef] = useState('');
  const [vdsRefNo, setVdsRefNo] = useState('');
  const [depositDate, setDepositDate] = useState(todayIso());
  const [depositTime, setDepositTime] = useState(nowTimeHHMM());
  const [depositType, setDepositType] = useState('Cash');
  const [amount, setAmount] = useState<number>(0);

  useEffect(() => {
    setIsLoading(true);
    return firestoreService.subscribe<VdsRecord>('vds_records', (data) => {
      setRecords(data);
      setIsLoading(false);
    });
  }, []);

  const openModal = (rec?: VdsRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setDate(rec.date);
      setDepositSlipRef(rec.depositSlipRef);
      setVdsRefNo(rec.vdsRefNo);
      setDepositDate(rec.depositDate);
      setDepositTime(rec.depositTime);
      setDepositType(rec.depositType);
      setAmount(rec.amount);
    } else {
      setEditing(null);
      setStationId(
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-ABA'
      );
      setDate(todayIso());
      setDepositSlipRef('');
      setVdsRefNo('');
      setDepositDate(todayIso());
      setDepositTime(nowTimeHHMM());
      setDepositType(lovs.depositTypes[0] || 'Cash');
      setAmount(0);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: VdsRecord = {
        id: editing?.id || `vds_${Date.now()}`,
        stationId,
        date,
        depositSlipRef: depositSlipRef.trim(),
        vdsRefNo: vdsRefNo.trim(),
        depositDate,
        depositTime,
        depositType,
        amount: Number(amount) || 0,
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('vds_records', rec);
      toast(editing ? 'VDS record updated' : 'VDS record added', 'success');
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('vds_records', toDelete.id);
      toast('VDS record deleted', 'info');
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
        r.vdsRefNo.toLowerCase().includes(q);
      return matchStation && matchType && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'depositSlipRef': cmp = a.depositSlipRef.localeCompare(b.depositSlipRef); break;
        case 'vdsRefNo': cmp = a.vdsRefNo.localeCompare(b.vdsRefNo); break;
        case 'depositDate': cmp = (a.depositDate || '').localeCompare(b.depositDate || ''); break;
        case 'amount': cmp = a.amount - b.amount; break;
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

  const totalAmount = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="VDS Registry"
        title="VDS Registry"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Entry' : 'Entries'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>VDS Registry V2 — Validated Deposit Slip Reference & Timestamp Ledger</span>
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
                ExportService.exportVdsRegistry(filtered);
                toast('Exported VDS Registry to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add VDS Entry</span>
            </Button>
          </>
        }
      />

      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Total VDS Deposited Amount
        </div>
        <div className="text-2xl font-extrabold text-emerald-700 mt-0.5 font-mono">
          ₱{formatCurrency(totalAmount)}
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Deposit Slip Ref, VDS Ref No, Station ID..."
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
          title="No VDS Entries Found"
          description="Record validated deposit slips (VDS) with deposit date and time."
          actionLabel="Add VDS Entry"
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
                  Registry Date
                </SortableHead>
                <SortableHead field="depositSlipRef" activeField={sortField} onSort={handleSort}>
                  Deposit Slip Ref.
                </SortableHead>
                <SortableHead field="vdsRefNo" activeField={sortField} onSort={handleSort}>
                  VDS Ref. No.
                </SortableHead>
                <SortableHead field="depositDate" activeField={sortField} onSort={handleSort}>
                  Deposit Date & Time
                </SortableHead>
                <TableHead>Type</TableHead>
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
                  <TableCell className="font-medium text-slate-700">{r.date}</TableCell>
                  <TableCell className="font-mono font-semibold text-slate-800">
                    {r.depositSlipRef}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-blue-700">{r.vdsRefNo}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800">{r.depositDate}</div>
                    <div className="text-[11px] text-slate-500">{r.depositTime}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.depositType === 'Cash' ? 'success' : 'default'}>
                      {r.depositType}
                    </Badge>
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
        title={editing ? 'Edit VDS Entry' : 'New VDS Entry'}
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
                Registry Date
              </label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
                VDS Ref. No.
              </label>
              <Input value={vdsRefNo} onChange={(e) => setVdsRefNo(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Date
              </label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Deposit Time
              </label>
              <Input
                type="time"
                value={depositTime}
                onChange={(e) => setDepositTime(e.target.value)}
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
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'Update VDS Entry' : 'Save VDS Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete VDS Entry"
        description={`Delete VDS entry "${toDelete?.vdsRefNo}" (Slip: ${toDelete?.depositSlipRef})?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
