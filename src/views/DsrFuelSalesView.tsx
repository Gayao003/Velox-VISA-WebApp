import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FileSpreadsheet,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  Fuel,
} from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { DsrFuelSaleRecord } from '../models/visa';
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

type SortField = 'date' | 'stationId' | 'shift' | 'product' | 'totalQty' | 'rate' | 'netSales';

const formatLiters = (val: number) =>
  Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

const calcNetSales = (r: {
  totalQty: number;
  rate: number;
  creditDisc: number;
  cashDisc: number;
  cashlessDisc: number;
}) =>
  (Number(r.totalQty) || 0) * (Number(r.rate) || 0) -
  ((Number(r.creditDisc) || 0) + (Number(r.cashDisc) || 0) + (Number(r.cashlessDisc) || 0));

export const DsrFuelSalesView: React.FC = () => {
  const { selectedStation, lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();
  const currentUser = authService.getCurrentUser();

  const { dsrFuelSales: records } = useDataCache();
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DsrFuelSaleRecord | null>(null);
  const [toDelete, setToDelete] = useState<DsrFuelSaleRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state matching AGU1_DSR / AGU2-DSR Excel schema
  const [stationId, setStationId] = useState('VLX-AG1');
  const [station, setStation] = useState(STATION_DSR_NAMES['VLX-AG1'] || '');
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState('1ST SHIFT');
  const [product, setProduct] = useState('Fuel : Diesel');
  const [totalQty, setTotalQty] = useState<number>(0);
  const [creditVolume, setCreditVolume] = useState<number>(0);
  const [cashVolume, setCashVolume] = useState<number>(0);
  const [cashlessVolume, setCashlessVolume] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [creditDisc, setCreditDisc] = useState<number>(0);
  const [cashDisc, setCashDisc] = useState<number>(0);
  const [cashlessDisc, setCashlessDisc] = useState<number>(0);

  const productOptions = useMemo(() => {
    const set = new Set<string>(lovs.products);
    records.forEach((r) => r.product && set.add(r.product));
    return Array.from(set);
  }, [lovs.products, records]);

  const openModal = (rec?: DsrFuelSaleRecord) => {
    if (rec) {
      setEditing(rec);
      setStationId(rec.stationId);
      setStation(rec.station || STATION_DSR_NAMES[rec.stationId] || rec.stationId);
      setDate(rec.date);
      setShift(rec.shift);
      setProduct(rec.product);
      setTotalQty(rec.totalQty);
      setCreditVolume(rec.creditVolume);
      setCashVolume(rec.cashVolume);
      setCashlessVolume(rec.cashlessVolume);
      setRate(rec.rate);
      setCreditDisc(rec.creditDisc);
      setCashDisc(rec.cashDisc);
      setCashlessDisc(rec.cashlessDisc);
    } else {
      const defaultSt =
        selectedStation !== 'All Stations' ? selectedStation : lovs.stations[0] || 'VLX-AG1';
      setEditing(null);
      setStationId(defaultSt);
      setStation(STATION_DSR_NAMES[defaultSt] || defaultSt);
      setDate(todayIso());
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setProduct(productOptions[0] || 'Fuel : Diesel');
      setTotalQty(0);
      setCreditVolume(0);
      setCashVolume(0);
      setCashlessVolume(0);
      setRate(0);
      setCreditDisc(0);
      setCashDisc(0);
      setCashlessDisc(0);
    }
    setIsModalOpen(true);
  };

  const handleStationChange = (newSt: string) => {
    setStationId(newSt);
    setStation(STATION_DSR_NAMES[newSt] || newSt);
  };

  const handleVolumeChange = (
    field: 'credit' | 'cash' | 'cashless',
    val: number
  ) => {
    const nextCredit = field === 'credit' ? val : creditVolume;
    const nextCash = field === 'cash' ? val : cashVolume;
    const nextCashless = field === 'cashless' ? val : cashlessVolume;
    if (field === 'credit') setCreditVolume(val);
    if (field === 'cash') setCashVolume(val);
    if (field === 'cashless') setCashlessVolume(val);
    setTotalQty(
      Number(((Number(nextCredit) || 0) + (Number(nextCash) || 0) + (Number(nextCashless) || 0)).toFixed(3))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const rec: DsrFuelSaleRecord = {
        id: editing?.id || `dsr_${Date.now()}`,
        stationId,
        station: station.trim() || STATION_DSR_NAMES[stationId] || stationId,
        date,
        shift,
        product: product.trim(),
        totalQty: Number(totalQty) || 0,
        creditVolume: Number(creditVolume) || 0,
        cashVolume: Number(cashVolume) || 0,
        cashlessVolume: Number(cashlessVolume) || 0,
        rate: Number(rate) || 0,
        creditDisc: Number(creditDisc) || 0,
        cashDisc: Number(cashDisc) || 0,
        cashlessDisc: Number(cashlessDisc) || 0,
        createdBy: editing?.createdBy || currentUser?.fullName || 'Operator',
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await firestoreService.save('dsr_fuel_sales', rec);
      toast(editing ? 'DSR fuel entry updated' : 'DSR fuel entry added', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err?.message || 'Failed to save DSR fuel entry', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await firestoreService.remove('dsr_fuel_sales', toDelete.id);
      toast('DSR fuel entry deleted', 'info');
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
      const matchProduct = productFilter === 'all' || r.product === productFilter;
      const matchShift = shiftFilter === 'all' || r.shift === shiftFilter;
      const matchSearch =
        !q ||
        r.stationId.toLowerCase().includes(q) ||
        r.station.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.shift.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q);
      return matchStation && matchProduct && matchShift && matchSearch;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'stationId': cmp = a.stationId.localeCompare(b.stationId); break;
        case 'shift': cmp = a.shift.localeCompare(b.shift); break;
        case 'product': cmp = a.product.localeCompare(b.product); break;
        case 'totalQty': cmp = a.totalQty - b.totalQty; break;
        case 'rate': cmp = a.rate - b.rate; break;
        case 'netSales': cmp = calcNetSales(a) - calcNetSales(b); break;
        case 'date':
        default:
          cmp = (a.date || '').localeCompare(b.date || '') || a.shift.localeCompare(b.shift);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [records, selectedStation, productFilter, shiftFilter, searchTerm, sortField, sortOrder]);

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
        (acc, r) => {
          const disc =
            (Number(r.creditDisc) || 0) +
            (Number(r.cashDisc) || 0) +
            (Number(r.cashlessDisc) || 0);
          return {
            totalQty: acc.totalQty + (Number(r.totalQty) || 0),
            creditVol: acc.creditVol + (Number(r.creditVolume) || 0),
            cashVol: acc.cashVol + (Number(r.cashVolume) || 0),
            cashlessVol: acc.cashlessVol + (Number(r.cashlessVolume) || 0),
            totalDisc: acc.totalDisc + disc,
            netSales: acc.netSales + calcNetSales(r),
          };
        },
        { totalQty: 0, creditVol: 0, cashVol: 0, cashlessVol: 0, totalDisc: 0, netSales: 0 }
      ),
    [filtered]
  );

  const liveModalNetSales = calcNetSales({
    totalQty,
    rate,
    creditDisc,
    cashDisc,
    cashlessDisc,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="DSR Fuel Sales"
        title="Daily Sales Report (DSR)"
        countLabel={`${totalEntries} ${totalEntries === 1 ? 'Entry' : 'Entries'}`}
        subtitle={
          <>
            <MapPin className="h-3 w-3 text-blue-600" />
            <span>Shift Fuel Volume, Rate & Discount Breakdown</span>
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
                ExportService.exportDsrFuelSales(filtered);
                toast('Exported DSR Fuel Sales to Excel', 'success');
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
            Net Fuel Sales
          </div>
          <div className="text-2xl font-extrabold text-[#0E4DA4] mt-0.5 font-mono">
            ₱{formatCurrency(summary.netSales)}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Volume Sold
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-0.5 font-mono">
            {formatLiters(summary.totalQty)} L
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Cash / Credit / Cashless (L)
          </div>
          <div className="text-xs font-bold text-slate-700 mt-1.5 font-mono space-y-0.5">
            <div>
              Cash: {formatLiters(summary.cashVol)} • Credit: {formatLiters(summary.creditVol)}
            </div>
            <div className="text-sky-700">Cashless: {formatLiters(summary.cashlessVol)} L</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-card">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Discounts
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-0.5 font-mono">
            ₱{formatCurrency(summary.totalDisc)}
          </div>
        </div>
      </div>

      <TableToolbar
        searchTerm={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        searchPlaceholder="Search by Station, Product, Shift, or Date..."
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setCurrentPage(1);
        }}
        filters={
          <div className="flex items-center gap-2">
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Products</option>
              {productOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
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
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No DSR Fuel Sales Found"
          description="Add a shift fuel sales entry or run `npm run seed` to load AGU1_DSR / AGU2-DSR."
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
                <SortableHead field="product" activeField={sortField} onSort={handleSort}>
                  Product
                </SortableHead>
                <SortableHead
                  field="totalQty"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Total Qty (L)
                </SortableHead>
                <TableHead className="text-right">Credit Vol</TableHead>
                <TableHead className="text-right">Cash Vol</TableHead>
                <TableHead className="text-right">Cashless Vol</TableHead>
                <SortableHead
                  field="rate"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Rate
                </SortableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <SortableHead
                  field="netSales"
                  activeField={sortField}
                  onSort={handleSort}
                  className="text-right"
                >
                  Net Sales
                </SortableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => {
                const totalDisc =
                  (Number(r.creditDisc) || 0) +
                  (Number(r.cashDisc) || 0) +
                  (Number(r.cashlessDisc) || 0);
                const netSales = calcNetSales(r);
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
                    <TableCell>
                      <Badge variant="info" className="gap-1">
                        <Fuel className="h-3 w-3" />
                        {r.product}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      {formatLiters(r.totalQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      {formatLiters(r.creditVolume)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      {formatLiters(r.cashVolume)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-600">
                      {formatLiters(r.cashlessVolume)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">
                      ₱{formatCurrency(r.rate)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-700">
                      ₱{formatCurrency(totalDisc)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-extrabold text-[#0E4DA4]">
                      ₱{formatCurrency(netSales)}
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
        title={editing ? 'Edit DSR Fuel Entry' : 'Add DSR Fuel Entry'}
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
                Station Name / Location <span className="text-red-500">*</span>
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
            <div className="grid grid-cols-2 gap-2">
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  {productOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Volumes */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Volume Breakdown (Liters)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Credit Volume
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={creditVolume}
                  onChange={(e) => handleVolumeChange('credit', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cash Volume
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={cashVolume}
                  onChange={(e) => handleVolumeChange('cash', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cashless Volume
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={cashlessVolume}
                  onChange={(e) => handleVolumeChange('cashless', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Total Qty (L) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={totalQty}
                  onChange={(e) => setTotalQty(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Rate & Discounts */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Rate & Discounts (₱)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Rate (₱/L) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Credit Disc (₱)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={creditDisc}
                  onChange={(e) => setCreditDisc(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cash Disc (₱)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={cashDisc}
                  onChange={(e) => setCashDisc(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Cashless Disc (₱)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={cashlessDisc}
                  onChange={(e) => setCashlessDisc(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span className="font-semibold text-slate-600">Estimated Net Sales:</span>
              <span className="font-mono text-base font-extrabold text-[#0E4DA4]">
                ₱{formatCurrency(liveModalNetSales)}
              </span>
            </div>
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
        title="Delete DSR Fuel Entry"
        description={`Delete ${toDelete?.product} (${toDelete?.date} • ${toDelete?.shift}) for ${toDelete?.stationId}?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
