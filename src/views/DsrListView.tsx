import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { DsrRecord } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { formatCurrency } from '../lib/format';
import { Button } from '../core/ui/button';
import { Badge } from '../core/ui/badge';
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
import { DsrFormModal } from '../components/DsrFormModal';

type SortField = 'dsrNo' | 'stationId' | 'date' | 'shift' | 'creditCustomerSales' | 'status';

export const DsrListView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();

  const [records, setRecords] = useState<DsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DsrRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<DsrRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsub = firestoreService.subscribe<DsrRecord>('dsr_records', (data) => {
      setRecords(data);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const totalCreditOf = (r: DsrRecord) =>
    (Number(r.creditCustomerSales) || 0) +
    (Number(r.prepaymentSales) || 0) +
    (Number(r.fleetCardCustomer) || 0) +
    (Number(r.fleetCardInterCompany) || 0);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const list = records.filter((r) => {
      const matchStation =
        selectedStation === 'All Stations' || r.stationId === selectedStation;
      const matchShift = shiftFilter === 'all' || r.shift === shiftFilter;
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        !q ||
        r.dsrNo.toLowerCase().includes(q) ||
        r.stationId.toLowerCase().includes(q) ||
        r.stationName.toLowerCase().includes(q) ||
        r.createdBy.toLowerCase().includes(q);
      return matchStation && matchShift && matchStatus && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'dsrNo': cmp = a.dsrNo.localeCompare(b.dsrNo); break;
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'shift': cmp = a.shift.localeCompare(b.shift); break;
        case 'creditCustomerSales': cmp = totalCreditOf(a) - totalCreditOf(b); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'date':
        default: cmp = (a.date || '').localeCompare(b.date || ''); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, shiftFilter, statusFilter, searchTerm, sortField, sortOrder]);

  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, validPage, pageSize]);

  const handleSave = async (record: DsrRecord) => {
    await firestoreService.save('dsr_records', record);
    toast(editingRecord ? `Updated ${record.dsrNo}` : `Created ${record.dsrNo}`, 'success');
    setEditingRecord(null);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('dsr_records', recordToDelete.id);
      toast(`Deleted ${recordToDelete.dsrNo}`, 'info');
      setRecordToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          creditCustomer: acc.creditCustomer + (Number(r.creditCustomerSales) || 0),
          prepayment: acc.prepayment + (Number(r.prepaymentSales) || 0),
          fleet:
            acc.fleet +
            (Number(r.fleetCardCustomer) || 0) +
            (Number(r.fleetCardInterCompany) || 0),
        }),
        { creditCustomer: 0, prepayment: 0, fleet: 0 }
      ),
    [filtered]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Daily Sales Report"
        title="Daily Sales Report (DSR)"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Report' : 'Reports'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Station Header & Credit Sales Ledger</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                ExportService.exportDsrList(filtered);
                toast(`Exported ${filtered.length} DSR records to Excel`, 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditingRecord(null);
                setIsModalOpen(true);
              }}
              className="font-bold shadow-sm shadow-blue-500/20"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New DSR</span>
            </Button>
          </>
        }
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Credit Customer Sales
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            ₱{formatCurrency(totals.creditCustomer)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Prepayment Sales
          </div>
          <div className="text-xl font-extrabold text-blue-700 mt-1 font-mono">
            ₱{formatCurrency(totals.prepayment)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Fleet Card Sales
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
            ₱{formatCurrency(totals.fleet)}
          </div>
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by DSR No, Station ID, Station Name, Encoder..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <>
            <select
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Shifts</option>
              {lovs.shifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </>
        }
      />

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
          <p className="text-xs font-medium">Loading DSR records...</p>
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No Daily Sales Reports Found"
          description="Create your first DSR record for this station or adjust your search filters."
          actionLabel="New DSR"
          onAction={() => {
            setEditingRecord(null);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="dsrNo" activeField={sortField} onSort={handleSort}>
                  DSR No
                </SortableHead>
                <SortableHead field="stationId" activeField={sortField} onSort={handleSort}>
                  Station
                </SortableHead>
                <SortableHead field="date" activeField={sortField} onSort={handleSort}>
                  Date & Shift
                </SortableHead>
                <SortableHead field="creditCustomerSales" activeField={sortField} onSort={handleSort} className="text-right">
                  Total Credit Sales
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
                  onClick={() => {
                    setEditingRecord(r);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                >
                  <TableCell className="font-mono font-bold text-blue-700">{r.dsrNo}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">{r.stationId}</div>
                    <div className="text-[11px] text-slate-500">{r.stationName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium text-slate-800">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{r.date}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600">{r.shift}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    ₱{formatCurrency(totalCreditOf(r))}
                  </TableCell>
                  <TableCell>
                    {r.status === 'submitted' ? (
                      <Badge variant="success">Submitted</Badge>
                    ) : (
                      <Badge variant="warning">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => ExportService.exportSingleDsr(r)}
                        className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Export DSR to Excel"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>
                      {r.status === 'draft' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await firestoreService.save('dsr_records', {
                              ...r,
                              status: 'submitted',
                              updatedAt: new Date().toISOString(),
                            });
                            toast(`${r.dsrNo} marked as Submitted`, 'success');
                          }}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Submit DSR"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord(r);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit DSR"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecordToDelete(r)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete DSR"
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

      <DsrFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSave}
        initialRecord={editingRecord}
        defaultStation={selectedStation}
        lovs={lovs}
      />

      <ConfirmationModal
        isOpen={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Daily Sales Report"
        description={`Are you sure you want to permanently delete DSR "${recordToDelete?.dsrNo}" (${recordToDelete?.stationId} · ${recordToDelete?.date})? This action cannot be undone.`}
        confirmText="Delete DSR"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
