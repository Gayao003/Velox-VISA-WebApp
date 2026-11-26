import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { ShiftCollectionRecord } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { useDataCache } from '../context/DataCacheContext';
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

type SortField = 'date' | 'stationId' | 'customer' | 'purpose' | 'paymentType' | 'amount';

export const ShiftCollectionsView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const { collections: records } = useDataCache();
  const isLoading = false;
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editing, setEditing] = useState<ShiftCollectionRecord | null>(null);
  const [toDelete, setToDelete] = useState<ShiftCollectionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 fields
  const [date, setDate] = useState(todayIso());
  const [stationId, setStationId] = useState('');
  const [shift, setShift] = useState('1ST SHIFT');
  const [customer, setCustomer] = useState('');
  const [purpose, setPurpose] = useState('Credit Payment');
  const [amount, setAmount] = useState<number>(0);

  // Step 2 fields
  const [paymentType, setPaymentType] = useState('Cash');
  const [depositSlipRef, setDepositSlipRef] = useState('');
  const [soaRef, setSoaRef] = useState('');
  const [crArNo, setCrArNo] = useState('');
  const [mayaPaymentRef, setMayaPaymentRef] = useState('');
  const [checkNo, setCheckNo] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [issuingBank, setIssuingBank] = useState('');
  const [remarks, setRemarks] = useState('');

  const openModal = (rec?: ShiftCollectionRecord) => {
    setStep(1);
    if (rec) {
      setEditing(rec);
      setDate(rec.date);
      setStationId(rec.stationId);
      setShift(rec.shift);
      setCustomer(rec.customer);
      setPurpose(rec.purpose);
      setAmount(rec.amount);
      setPaymentType(rec.paymentType);
      setDepositSlipRef(rec.depositSlipRef);
      setSoaRef(rec.soaRef);
      setCrArNo(rec.crArNo);
      setMayaPaymentRef(rec.mayaPaymentRef);
      setCheckNo(rec.checkNo);
      setCheckDate(rec.checkDate);
      setIssuingBank(rec.issuingBank);
      setRemarks(rec.remarks);
    } else {
      setEditing(null);
      setDate(todayIso());
      setStationId(
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-AG1'
      );
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setCustomer('');
      setPurpose(lovs.purposes[1] || lovs.purposes[0] || 'Credit Payment');
      setAmount(0);
      setPaymentType(lovs.paymentTypes[0] || 'Cash');
      setDepositSlipRef(
        getNextIncrementRef(
          'COL-SLIP',
          records.map((r) => r.depositSlipRef)
        )
      );
      setSoaRef('');
      setCrArNo('');
      setMayaPaymentRef('');
      setCheckNo('');
      setCheckDate('');
      setIssuingBank('');
      setRemarks('');
    }
    setIsModalOpen(true);
  };

  const handleNextStep = () => {
    if (!date || !stationId || !shift) {
      toast('Please fill in Date, Station ID, and Shift.', 'warning');
      return;
    }
    if (!customer.trim()) {
      toast('Please select or enter a Credit Customer.', 'warning');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast('Please enter a valid collection Amount greater than 0.', 'warning');
      return;
    }
    setStep(2);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleNextStep();
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: ShiftCollectionRecord = {
        id: editing?.id || `scoll_${Date.now()}`,
        date,
        stationId,
        shift,
        customer: customer.trim(),
        purpose,
        depositSlipRef: depositSlipRef.trim(),
        soaRef: soaRef.trim(),
        paymentType,
        crArNo: crArNo.trim(),
        amount: Number(amount) || 0,
        mayaPaymentRef: mayaPaymentRef.trim(),
        checkNo: checkNo.trim(),
        checkDate,
        issuingBank: issuingBank.trim(),
        remarks: remarks.trim(),
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('shift_collections', rec);
      toast(editing ? 'Collection updated successfully' : 'Collection saved successfully', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save shift collection', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('shift_collections', toDelete.id);
      toast('Collection record deleted', 'info');
      setToDelete(null);
    } catch (err: any) {
      toast(err?.message || 'Failed to delete collection', 'error');
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
      const matchPurpose = purposeFilter === 'all' || r.purpose === purposeFilter;
      const matchPayment = paymentFilter === 'all' || r.paymentType === paymentFilter;
      const matchSearch =
        !q ||
        r.customer.toLowerCase().includes(q) ||
        r.crArNo.toLowerCase().includes(q) ||
        r.soaRef.toLowerCase().includes(q) ||
        r.depositSlipRef.toLowerCase().includes(q) ||
        r.stationId.toLowerCase().includes(q);
      return matchStation && matchPurpose && matchPayment && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'customer': cmp = a.customer.localeCompare(b.customer); break;
        case 'purpose': cmp = a.purpose.localeCompare(b.purpose); break;
        case 'paymentType': cmp = a.paymentType.localeCompare(b.paymentType); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'date':
        default: cmp = (a.date || '').localeCompare(b.date || ''); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, purposeFilter, paymentFilter, searchTerm, sortField, sortOrder]);

  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => filtered.slice((validPage - 1) * pageSize, validPage * pageSize),
    [filtered, validPage, pageSize]
  );

  const totalCollection = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <PageHeader
        breadcrumb="Shift Collections"
        title="Shift Collection Registry"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Collection' : 'Collections'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Shift Collection Registry V3.1 — Customer AR, SOA & Payment Tracking</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                ExportService.exportShiftCollections(filtered);
                toast('Exported Shift Collection Registry to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add Collection</span>
            </Button>
          </>
        }
      />

      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Collection (Filtered)
          </div>
          <div className="text-2xl font-extrabold text-blue-700 mt-0.5 font-mono">
            ₱{formatCurrency(totalCollection)}
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {lovs.creditCustomers.length} Credit Customers loaded
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Customer, CR/AR #, SOA Ref, Deposit Slip..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <>
            <select
              value={purposeFilter}
              onChange={(e) => {
                setPurposeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Purposes</option>
              {lovs.purposes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Payment Types</option>
              {lovs.paymentTypes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </>
        }
      />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No Shift Collections Found"
          description="Record a customer payment or prepayment collection for this shift."
          actionLabel="Add Collection"
          onAction={() => openModal()}
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="date" activeField={sortField} onSort={handleSort}>
                  Date & Station
                </SortableHead>
                <SortableHead field="customer" activeField={sortField} onSort={handleSort}>
                  Customer
                </SortableHead>
                <SortableHead field="purpose" activeField={sortField} onSort={handleSort}>
                  Purpose & Refs
                </SortableHead>
                <SortableHead field="paymentType" activeField={sortField} onSort={handleSort}>
                  Payment Type
                </SortableHead>
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
                  <TableCell>
                    <div className="font-bold text-slate-900">{r.stationId}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.date} • {r.shift}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="font-semibold text-slate-900 truncate" title={r.customer}>
                      {r.customer}
                    </div>
                    {r.remarks && (
                      <div className="text-[11px] text-slate-400 truncate">{r.remarks}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{r.purpose}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {r.crArNo ? `CR/AR: ${r.crArNo}` : ''} {r.soaRef ? `• SOA: ${r.soaRef}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{r.paymentType}</Badge>
                    {r.checkNo && (
                      <div className="text-[10px] text-slate-500 mt-0.5">Chk #{r.checkNo}</div>
                    )}
                    {r.mayaPaymentRef && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Maya: {r.mayaPaymentRef}
                      </div>
                    )}
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

      {/* 2-Step Wizard Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit Shift Collection' : 'New Shift Collection'}
        maxWidth="xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Step Progress Indicator */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                step === 1
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                  : 'text-emerald-700 hover:bg-white/60'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                  step === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {step > 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
              </span>
              <span>Station & Customer</span>
            </button>

            <div className="h-px w-6 bg-slate-300 shrink-0" />

            <button
              type="button"
              onClick={() => {
                if (step === 1) handleNextStep();
              }}
              className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                step === 2
                  ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                  : 'text-slate-500 hover:bg-white/60'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                  step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span>Payment & References</span>
            </button>
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Station & Shift
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
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
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Customer & Collection Amount
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Credit Customer <span className="text-red-500">*</span>
                    </label>
                    <Input
                      list="visa-credit-customers"
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      placeholder="Start typing customer name (436+ customers)..."
                      required
                    />
                    <datalist id="visa-credit-customers">
                      {lovs.creditCustomers.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Purpose <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                      >
                        {lovs.purposes.map((p) => (
                          <option key={p} value={p}>
                            {p}
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
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" onClick={handleNextStep} className="font-bold">
                  <span>Next: Payment & References</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Payment & Slip References
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Payment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    >
                      {lovs.paymentTypes.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Deposit Slip Ref.
                    </label>
                    <Input
                      value={depositSlipRef}
                      onChange={(e) => setDepositSlipRef(e.target.value)}
                      placeholder="Auto-generated or enter slip #"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      CR/AR #
                    </label>
                    <Input value={crArNo} onChange={(e) => setCrArNo(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      SOA Ref
                    </label>
                    <Input value={soaRef} onChange={(e) => setSoaRef(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Digital / Check & Remarks (Optional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Maya Payment Ref
                    </label>
                    <Input
                      value={mayaPaymentRef}
                      onChange={(e) => setMayaPaymentRef(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Check #
                    </label>
                    <Input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Check Date
                    </label>
                    <Input
                      type="date"
                      value={checkDate}
                      onChange={(e) => setCheckDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Issuing Bank
                    </label>
                    <Input
                      value={issuingBank}
                      onChange={(e) => setIssuingBank(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Remarks
                    </label>
                    <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isLoading={isSaving} className="font-bold">
                    {editing ? 'Update Collection' : 'Save Collection'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Shift Collection"
        description={`Delete collection for "${toDelete?.customer}" (₱${formatCurrency(toDelete?.amount)})?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
