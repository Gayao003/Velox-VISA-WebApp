import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileSpreadsheet, PlusCircle, Pencil, Trash2, MapPin, Gauge } from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { MeterReadingRecord } from '../models/visa';
import { firestoreService } from '../services/firestoreService';
import { ExportService } from '../services/exportService';
import { authService } from '../core/auth/authService';
import { todayIso, nowTimeHHMM } from '../lib/format';
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

type SortField = 'readingDate' | 'stationId' | 'nozzle' | 'product' | 'reading' | 'readingType';

export const MeterReadingsView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const [records, setRecords] = useState<MeterReadingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('readingDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<MeterReadingRecord | null>(null);
  const [toDelete, setToDelete] = useState<MeterReadingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [stationId, setStationId] = useState('');
  const [shift, setShift] = useState('1ST SHIFT');
  const [readingDate, setReadingDate] = useState(todayIso());
  const [readingTime, setReadingTime] = useState(nowTimeHHMM());
  const [nozzle, setNozzle] = useState('');
  const [tankRef, setTankRef] = useState('');
  const [product, setProduct] = useState('Diesel');
  const [reading, setReading] = useState<number>(0);
  const [readingType, setReadingType] = useState('Opening');

  useEffect(() => {
    setIsLoading(true);
    return firestoreService.subscribe<MeterReadingRecord>('meter_readings', (data) => {
      setRecords(data);
      setIsLoading(false);
    });
  }, []);

  const openModal = (rec?: MeterReadingRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setShift(rec.shift);
      setReadingDate(rec.readingDate);
      setReadingTime(rec.readingTime);
      setNozzle(rec.nozzle);
      setTankRef(rec.tankRef);
      setProduct(rec.product);
      setReading(rec.reading);
      setReadingType(rec.readingType);
    } else {
      setEditing(null);
      setStationId(
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-ABA'
      );
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setReadingDate(todayIso());
      setReadingTime(nowTimeHHMM());
      setNozzle('');
      setTankRef('');
      setProduct(lovs.products[0] || 'Diesel');
      setReading(0);
      setReadingType(lovs.readingTypes[0] || 'Opening');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: MeterReadingRecord = {
        id: editing?.id || `mtr_${Date.now()}`,
        stationId,
        shift,
        readingDate,
        readingTime,
        nozzle: nozzle.trim(),
        tankRef: tankRef.trim(),
        product: product.trim(),
        reading: Number(reading) || 0,
        readingType,
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('meter_readings', rec);
      toast(editing ? 'Meter reading updated' : 'Meter reading added', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save meter reading', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('meter_readings', toDelete.id);
      toast('Meter reading deleted', 'info');
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
      const matchType = typeFilter === 'all' || r.readingType === typeFilter;
      const matchSearch =
        !q ||
        r.stationId.toLowerCase().includes(q) ||
        r.nozzle.toLowerCase().includes(q) ||
        r.tankRef.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q);
      return matchStation && matchType && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'nozzle': cmp = a.nozzle.localeCompare(b.nozzle); break;
        case 'product': cmp = a.product.localeCompare(b.product); break;
        case 'reading': cmp = a.reading - b.reading; break;
        case 'readingType': cmp = a.readingType.localeCompare(b.readingType); break;
        case 'readingDate':
        default: cmp = (a.readingDate || '').localeCompare(b.readingDate || ''); break;
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

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Meter Reading"
        title="Pump Meter Reading"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Reading' : 'Readings'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Nozzle, Tank Reference, Product & Shift Meter Readings</span>
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
                ExportService.exportMeterReadings(filtered);
                toast('Exported Meter Readings to Excel', 'success');
              }}
              className="font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button variant="primary" size="md" onClick={() => openModal()} className="font-bold">
              <PlusCircle className="h-4 w-4" />
              <span>Add Reading</span>
            </Button>
          </>
        }
      />

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Nozzle, TankRef, Product, Station ID..."
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
            <option value="all">All Reading Types</option>
            {lovs.readingTypes.map((t) => (
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
          title="No Meter Readings Found"
          description="Log opening, mid-shift, or closing pump meter readings."
          actionLabel="Add Reading"
          onAction={() => openModal()}
        />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="stationId" activeField={sortField} onSort={handleSort}>
                  Station & Shift
                </SortableHead>
                <SortableHead field="readingDate" activeField={sortField} onSort={handleSort}>
                  Date & Time
                </SortableHead>
                <SortableHead field="nozzle" activeField={sortField} onSort={handleSort}>
                  Nozzle / TankRef
                </SortableHead>
                <SortableHead field="product" activeField={sortField} onSort={handleSort}>
                  Product
                </SortableHead>
                <SortableHead field="readingType" activeField={sortField} onSort={handleSort}>
                  Type
                </SortableHead>
                <SortableHead field="reading" activeField={sortField} onSort={handleSort} className="text-right">
                  Reading
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
                    <div className="text-[11px] font-semibold text-blue-600">{r.shift}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800">{r.readingDate}</div>
                    <div className="text-[11px] text-slate-500">{r.readingTime}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Gauge className="h-3.5 w-3.5 text-blue-600" />
                      <span>{r.nozzle}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Tank: {r.tankRef || '—'}</div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">{r.product}</TableCell>
                  <TableCell>
                    <Badge variant={r.readingType === 'Closing' ? 'success' : 'default'}>
                      {r.readingType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    {Number(r.reading).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 3,
                    })}
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
        title={editing ? 'Edit Meter Reading' : 'New Meter Reading'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Reading Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Reading Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Nozzle <span className="text-red-500">*</span>
              </label>
              <Input
                value={nozzle}
                onChange={(e) => setNozzle(e.target.value)}
                placeholder="e.g. Pump 1 - N1"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">TankRef</label>
              <Input
                value={tankRef}
                onChange={(e) => setTankRef(e.target.value)}
                placeholder="e.g. T-01"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Product <span className="text-red-500">*</span>
              </label>
              <Input
                list="visa-products"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                required
              />
              <datalist id="visa-products">
                {lovs.products.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Reading Type <span className="text-red-500">*</span>
              </label>
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              >
                {lovs.readingTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Meter Reading Value <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.001"
                value={reading}
                onChange={(e) => setReading(Number(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editing ? 'Update Reading' : 'Save Reading'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Meter Reading"
        description={`Delete meter reading for nozzle "${toDelete?.nozzle}" (${toDelete?.readingDate})?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
