import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Truck,
  Receipt,
  Building2,
  ArrowUpRight,
  Home,
  ChevronRight,
  TrendingUp,
  Fuel,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useDataCache } from '../context/DataCacheContext';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { formatStationOption } from '../data/visaMasterData';
import { formatCurrency } from '../lib/format';
import { Badge } from '../core/ui/badge';

const DONUT_COLORS = ['#0E4DA4', '#0EA5E9', '#00C49A', '#1E293B', '#6366F1', '#64748B'];

const calcDsrNet = (f: {
  totalQty: number;
  rate: number;
  creditDisc: number;
  cashDisc: number;
  cashlessDisc: number;
}) =>
  (Number(f.totalQty) || 0) * (Number(f.rate) || 0) -
  ((Number(f.creditDisc) || 0) + (Number(f.cashDisc) || 0) + (Number(f.cashlessDisc) || 0));

const formatLiters = (val: number) =>
  Number(val || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { selectedStation } = useOutletContext<VisaOutletContext>();
  const {
    deposits: allDeposits,
    collections: allCollections,
    bankPickups: allBankPickups,
    vdsRecords: allVdsRecords,
    dsrFuelSales: allDsrFuelSales,
  } = useDataCache();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const deposits = useMemo(
    () =>
      selectedStation === 'All Stations'
        ? allDeposits
        : allDeposits.filter((d) => d.stationId === selectedStation),
    [selectedStation, allDeposits]
  );
  const collections = useMemo(
    () =>
      selectedStation === 'All Stations'
        ? allCollections
        : allCollections.filter((c) => c.stationId === selectedStation),
    [selectedStation, allCollections]
  );
  const bankPickups = useMemo(
    () =>
      selectedStation === 'All Stations'
        ? allBankPickups
        : allBankPickups.filter((b) => b.stationId === selectedStation),
    [selectedStation, allBankPickups]
  );
  const vdsRecords = useMemo(
    () =>
      selectedStation === 'All Stations'
        ? allVdsRecords
        : allVdsRecords.filter((v) => v.stationId === selectedStation),
    [selectedStation, allVdsRecords]
  );
  const dsrFuelSales = useMemo(
    () =>
      selectedStation === 'All Stations'
        ? allDsrFuelSales
        : allDsrFuelSales.filter((f) => f.stationId === selectedStation),
    [selectedStation, allDsrFuelSales]
  );

  const stats = useMemo(() => {
    const totalDeposits = deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalCollections = collections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const inTransitList = bankPickups.filter((p) => p.status === 'In-transit');
    const depositedList = bankPickups.filter((p) => p.status === 'Deposited');
    const pickupInTransit = inTransitList.reduce((s, p) => s + (Number(p.slipAmount) || 0), 0);
    const pickupDeposited = depositedList.reduce((s, p) => s + (Number(p.countedAmount) || 0), 0);
    const pickupSlipTotal = bankPickups.reduce((s, p) => s + (Number(p.slipAmount) || 0), 0);
    const pickupCountedTotal = bankPickups.reduce((s, p) => s + (Number(p.countedAmount) || 0), 0);

    const totalVds = vdsRecords.reduce((s, v) => s + (Number(v.amount) || 0), 0);
    const totalDsrSales = dsrFuelSales.reduce((s, f) => s + calcDsrNet(f), 0);
    const totalDsrLiters = dsrFuelSales.reduce((s, f) => s + (Number(f.totalQty) || 0), 0);

    const stationSet = new Set<string>();
    deposits.forEach((d) => d.stationId && stationSet.add(d.stationId));
    collections.forEach((c) => c.stationId && stationSet.add(c.stationId));
    bankPickups.forEach((b) => b.stationId && stationSet.add(b.stationId));
    vdsRecords.forEach((v) => v.stationId && stationSet.add(v.stationId));
    dsrFuelSales.forEach((f) => f.stationId && stationSet.add(f.stationId));

    return {
      totalDeposits,
      totalCollections,
      pickupInTransit,
      pickupDeposited,
      pickupInTransitCount: inTransitList.length,
      pickupDepositedCount: depositedList.length,
      pickupSlipTotal,
      pickupCountedTotal,
      totalVds,
      totalDsrSales,
      totalDsrLiters,
      dsrCount: dsrFuelSales.length,
      depositCount: deposits.length,
      collectionCount: collections.length,
      pickupCount: bankPickups.length,
      vdsCount: vdsRecords.length,
      activeStations: stationSet.size,
    };
  }, [deposits, collections, bankPickups, vdsRecords, dsrFuelSales]);

  // Daily Trend across all 5 registries (last 7 active dates)
  const dailyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        dsr: number;
        deposits: number;
        pickups: number;
        vds: number;
        collections: number;
      }
    >();
    const ensure = (date: string) =>
      map.get(date) || { date, dsr: 0, deposits: 0, pickups: 0, vds: 0, collections: 0 };

    dsrFuelSales.forEach((f) => {
      if (!f.date) return;
      const cur = ensure(f.date);
      cur.dsr += calcDsrNet(f);
      map.set(f.date, cur);
    });
    deposits.forEach((d) => {
      if (!d.date) return;
      const cur = ensure(d.date);
      cur.deposits += Number(d.amount) || 0;
      map.set(d.date, cur);
    });
    bankPickups.forEach((b) => {
      if (!b.pickUpDate) return;
      const cur = ensure(b.pickUpDate);
      cur.pickups += Number(b.countedAmount || b.slipAmount) || 0;
      map.set(b.pickUpDate, cur);
    });
    vdsRecords.forEach((v) => {
      const dt = v.depositDate || v.date;
      if (!dt) return;
      const cur = ensure(dt);
      cur.vds += Number(v.amount) || 0;
      map.set(dt, cur);
    });
    collections.forEach((c) => {
      if (!c.date) return;
      const cur = ensure(c.date);
      cur.collections += Number(c.amount) || 0;
      map.set(c.date, cur);
    });

    const sorted = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    const maxVal = Math.max(
      1,
      ...sorted.map((x) => Math.max(x.dsr, x.deposits, x.pickups, x.vds, x.collections))
    );
    return { items: sorted, maxVal };
  }, [dsrFuelSales, deposits, bankPickups, vdsRecords, collections]);

  // Payment Type Donut Data
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    collections.forEach((c) => {
      const k = c.paymentType || 'Other';
      map.set(k, (map.get(k) || 0) + (Number(c.amount) || 0));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    const items = Array.from(map.entries())
      .map(([label, amount], idx) => ({
        label,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
    return { items, total };
  }, [collections]);

  // DSR Fuel Breakdown by Product & Tender Volume
  const dsrBreakdown = useMemo(() => {
    const productMap = new Map<string, { product: string; liters: number; netSales: number }>();
    let cashVol = 0;
    let creditVol = 0;
    let cashlessVol = 0;
    let totalDisc = 0;

    dsrFuelSales.forEach((f) => {
      const key = f.product || 'Fuel';
      const cur = productMap.get(key) || { product: key, liters: 0, netSales: 0 };
      cur.liters += Number(f.totalQty) || 0;
      cur.netSales += calcDsrNet(f);
      productMap.set(key, cur);

      cashVol += Number(f.cashVolume) || 0;
      creditVol += Number(f.creditVolume) || 0;
      cashlessVol += Number(f.cashlessVolume) || 0;
      totalDisc +=
        (Number(f.creditDisc) || 0) +
        (Number(f.cashDisc) || 0) +
        (Number(f.cashlessDisc) || 0);
    });

    const products = Array.from(productMap.values()).sort((a, b) => b.netSales - a.netSales);
    const maxSales = Math.max(1, ...products.map((p) => p.netSales));
    const totalVol = Math.max(0.001, cashVol + creditVol + cashlessVol);

    return {
      products: products.map((p) => ({ ...p, widthPct: (p.netSales / maxSales) * 100 })),
      cashVol,
      creditVol,
      cashlessVol,
      cashPct: (cashVol / totalVol) * 100,
      creditPct: (creditVol / totalVol) * 100,
      cashlessPct: (cashlessVol / totalVol) * 100,
      totalDisc,
    };
  }, [dsrFuelSales]);

  // Deposit & VDS Reconciliation Breakdown (Deposits vs Pickups vs VDS + Deposit Type mix)
  const reconciliationStats = useMemo(() => {
    const typeMap = new Map<string, number>();
    deposits.forEach((d) => {
      const k = d.depositType || 'Cash';
      typeMap.set(k, (typeMap.get(k) || 0) + (Number(d.amount) || 0));
    });
    const depositTypes = Array.from(typeMap.entries())
      .map(([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount);

    const pickupVariance = stats.pickupCountedTotal - stats.pickupSlipTotal;
    const vdsVsDepositDiff = stats.totalVds - stats.totalDeposits;
    const vdsCoveragePct =
      stats.totalDeposits > 0 ? Math.min(100, (stats.totalVds / stats.totalDeposits) * 100) : 0;

    return {
      depositTypes,
      pickupVariance,
      vdsVsDepositDiff,
      vdsCoveragePct,
    };
  }, [deposits, stats]);

  // Purpose Breakdown
  const purposeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    collections.forEach((c) => {
      const k = c.purpose || 'Others';
      map.set(k, (map.get(k) || 0) + (Number(c.amount) || 0));
    });
    const maxAmt = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount, widthPct: (amount / maxAmt) * 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [collections]);

  // Active Stations across all 5 registries
  const topStations = useMemo(() => {
    const map = new Map<
      string,
      {
        station: string;
        deposits: number;
        collections: number;
        pickups: number;
        vds: number;
        dsr: number;
        liters: number;
      }
    >();
    const ensure = (st: string) =>
      map.get(st) || {
        station: st,
        deposits: 0,
        collections: 0,
        pickups: 0,
        vds: 0,
        dsr: 0,
        liters: 0,
      };

    deposits.forEach((d) => {
      if (!d.stationId) return;
      const cur = ensure(d.stationId);
      cur.deposits += Number(d.amount) || 0;
      map.set(d.stationId, cur);
    });
    collections.forEach((c) => {
      if (!c.stationId) return;
      const cur = ensure(c.stationId);
      cur.collections += Number(c.amount) || 0;
      map.set(c.stationId, cur);
    });
    bankPickups.forEach((b) => {
      if (!b.stationId) return;
      const cur = ensure(b.stationId);
      cur.pickups += Number(b.countedAmount || b.slipAmount) || 0;
      map.set(b.stationId, cur);
    });
    vdsRecords.forEach((v) => {
      if (!v.stationId) return;
      const cur = ensure(v.stationId);
      cur.vds += Number(v.amount) || 0;
      map.set(v.stationId, cur);
    });
    dsrFuelSales.forEach((f) => {
      if (!f.stationId) return;
      const cur = ensure(f.stationId);
      cur.dsr += calcDsrNet(f);
      cur.liters += Number(f.totalQty) || 0;
      map.set(f.stationId, cur);
    });

    return Array.from(map.values())
      .sort((a, b) => b.dsr + b.deposits - (a.dsr + a.deposits))
      .slice(0, 5);
  }, [deposits, collections, bankPickups, vdsRecords, dsrFuelSales]);

  // SVG Donut segments
  const donutSegments = useMemo(() => {
    const r = 54;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    return paymentBreakdown.items.map((item) => {
      const dash = (item.pct / 100) * circumference;
      const seg = { ...item, dash, gap: circumference - dash, offset };
      offset += dash;
      return seg;
    });
  }, [paymentBreakdown]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col gap-1.5 pb-4 border-b border-slate-200">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
          <Home className="h-3.5 w-3.5 text-slate-400" />
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-medium">TRACE</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-bold text-slate-900">Dashboard</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Station Operations Dashboard
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#0E4DA4] border border-blue-200 flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3" />
              Live Overview
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              <Building2 className="h-3.5 w-3.5 text-[#0E4DA4]" />
              {selectedStation === 'All Stations'
                ? `${stats.activeStations} Active Station(s)`
                : formatStationOption(selectedStation)}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Real-time summary across Shift Deposits, Shift Collections, Bank Pickups, VDS Registry, and DSR Fuel Sales
        </p>
      </div>

      {/* 5 Primary Registry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <button
          onClick={() => navigate('/shift-deposits')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-blue-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Shift Deposits
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#0E4DA4] group-hover:bg-[#0E4DA4] group-hover:text-white transition-colors">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            ₱{formatCurrency(stats.totalDeposits)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.depositCount} slip(s) recorded</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0E4DA4] transition-colors" />
          </div>
        </button>

        <button
          onClick={() => navigate('/shift-collections')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-emerald-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Shift Collections
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2 font-mono">
            ₱{formatCurrency(stats.totalCollections)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.collectionCount} collection(s)</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => navigate('/bank-pickups')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-amber-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Bank Pickups
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2 font-mono">
            ₱{formatCurrency(stats.pickupCountedTotal)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {stats.pickupCount} pickup(s) • In-Transit: ₱{formatCurrency(stats.pickupInTransit)}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => navigate('/vds-registry')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-slate-400 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              VDS Validated Deposits
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            ₱{formatCurrency(stats.totalVds)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.vdsCount} VDS entry(ies)</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => navigate('/dsr-fuel-sales')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-sky-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              DSR Fuel Sales
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Fuel className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-2 font-mono">
            ₱{formatCurrency(stats.totalDsrSales)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {stats.dsrCount} row(s) • {Math.round(stats.totalDsrLiters).toLocaleString('en-PH')} L
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 transition-colors" />
          </div>
        </button>
      </div>

      {/* Row 2: Daily 5-Registry Trend & Collection Payment Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart: DSR, Deposits, Pickups, VDS, Collections by Date */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0E4DA4]" />
                <span>Daily Operations Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                DSR Fuel Sales, Shift Deposits, Bank Pickups, VDS & Collections (last 7 dates)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> DSR Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0E4DA4]" /> Deposits
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Pickups
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> VDS
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> Collections
              </span>
            </div>
          </div>

          {dailyTrend.items.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Add records to view daily trend charts
            </div>
          ) : (
            <div className="h-56 flex items-end justify-around gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
              {dailyTrend.items.map((d) => {
                const dsrH = d.dsr > 0 ? Math.max(4, (d.dsr / dailyTrend.maxVal) * 100) : 2;
                const depH = d.deposits > 0 ? Math.max(4, (d.deposits / dailyTrend.maxVal) * 100) : 2;
                const bpkH = d.pickups > 0 ? Math.max(4, (d.pickups / dailyTrend.maxVal) * 100) : 2;
                const vdsH = d.vds > 0 ? Math.max(4, (d.vds / dailyTrend.maxVal) * 100) : 2;
                const colH = d.collections > 0 ? Math.max(4, (d.collections / dailyTrend.maxVal) * 100) : 2;
                const isHovered = hoveredDay === d.date;
                return (
                  <div
                    key={d.date}
                    onMouseEnter={() => setHoveredDay(d.date)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="relative flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                  >
                    {isHovered && (
                      <div className="absolute -top-2 z-10 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-mono shadow-lg whitespace-nowrap pointer-events-none">
                        <div className="font-bold text-sky-300 mb-0.5">{d.date}</div>
                        <div>DSR: ₱{formatCurrency(d.dsr)}</div>
                        <div>Dep: ₱{formatCurrency(d.deposits)}</div>
                        <div>BPK: ₱{formatCurrency(d.pickups)}</div>
                        <div>VDS: ₱{formatCurrency(d.vds)}</div>
                        <div>Col: ₱{formatCurrency(d.collections)}</div>
                      </div>
                    )}
                    <div className="w-full flex items-end justify-center gap-1 h-40">
                      <div
                        style={{ height: `${dsrH}%` }}
                        className="w-2 sm:w-3 rounded-t-md bg-sky-500 group-hover:bg-sky-400 transition-all duration-500"
                      />
                      <div
                        style={{ height: `${depH}%` }}
                        className="w-2 sm:w-3 rounded-t-md bg-[#0E4DA4] group-hover:bg-[#09397D] transition-all duration-500"
                      />
                      <div
                        style={{ height: `${bpkH}%` }}
                        className="w-2 sm:w-3 rounded-t-md bg-amber-500 group-hover:bg-amber-400 transition-all duration-500"
                      />
                      <div
                        style={{ height: `${vdsH}%` }}
                        className="w-2 sm:w-3 rounded-t-md bg-emerald-500 group-hover:bg-emerald-400 transition-all duration-500"
                      />
                      <div
                        style={{ height: `${colH}%` }}
                        className="w-2 sm:w-3 rounded-t-md bg-slate-800 group-hover:bg-slate-600 transition-all duration-500"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 truncate max-w-full">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut Chart: Payment Type Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Collection Payment Mix</h3>
            <p className="text-[11px] text-slate-500">Breakdown by payment type</p>
          </div>

          {paymentBreakdown.items.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl my-3">
              No collections recorded yet
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 my-3">
              <div className="relative h-36 w-36">
                <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="16"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="70"
                      cy="70"
                      r="54"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="16"
                      strokeDasharray={`${seg.dash} ${seg.gap}`}
                      strokeDashoffset={-seg.offset}
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">
                    ₱{formatCurrency(paymentBreakdown.total)}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-1.5">
                {paymentBreakdown.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-700">{item.label}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: DSR Fuel Product & Volume Breakdown + Bank Pickup & VDS Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DSR Fuel Sales by Product & Tender Volume */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Fuel className="h-4 w-4 text-sky-600" />
                <span>DSR Fuel Product & Volume Mix</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Net fuel revenue and liters sold by product & tender
              </p>
            </div>
            <button
              onClick={() => navigate('/dsr-fuel-sales')}
              className="text-[11px] font-bold text-[#0E4DA4] hover:underline cursor-pointer"
            >
              View DSR →
            </button>
          </div>

          {dsrBreakdown.products.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No DSR fuel sales yet</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {dsrBreakdown.products.map((p) => (
                  <div key={p.product} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {p.product}{' '}
                        <span className="text-slate-400 font-mono">
                          ({formatLiters(p.liters)} L)
                        </span>
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        ₱{formatCurrency(p.netSales)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${p.widthPct}%` }}
                        className="h-full rounded-full bg-sky-500 transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Tender Volume Split Bar */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Volume by Tender</span>
                  <span className="font-mono text-amber-600 normal-case">
                    Total Discounts: ₱{formatCurrency(dsrBreakdown.totalDisc)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    style={{ width: `${dsrBreakdown.cashPct}%` }}
                    className="bg-[#0E4DA4]"
                    title={`Cash: ${formatLiters(dsrBreakdown.cashVol)} L`}
                  />
                  <div
                    style={{ width: `${dsrBreakdown.creditPct}%` }}
                    className="bg-emerald-500"
                    title={`Credit: ${formatLiters(dsrBreakdown.creditVol)} L`}
                  />
                  <div
                    style={{ width: `${dsrBreakdown.cashlessPct}%` }}
                    className="bg-sky-400"
                    title={`Cashless: ${formatLiters(dsrBreakdown.cashlessVol)} L`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-[#0E4DA4]" />
                    <span>Cash: {formatLiters(dsrBreakdown.cashVol)} L</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Credit: {formatLiters(dsrBreakdown.creditVol)} L</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span>Cashless: {formatLiters(dsrBreakdown.cashlessVol)} L</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bank Pickup & VDS Reconciliation */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-600" />
                <span>Deposit, Pickup & VDS Reconciliation</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Cross-check across Shift Deposits, Bank Pickups, and VDS Registry
              </p>
            </div>
            <button
              onClick={() => navigate('/bank-pickups')}
              className="text-[11px] font-bold text-[#0E4DA4] hover:underline cursor-pointer"
            >
              View Pickups →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Deposited Pickups ({stats.pickupDepositedCount})</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-emerald-800 mt-1">
                ₱{formatCurrency(stats.pickupDeposited)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                <span>In-Transit Pickups ({stats.pickupInTransitCount})</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-amber-800 mt-1">
                ₱{formatCurrency(stats.pickupInTransit)}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs pt-1">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Bank Pickup Slip vs Counted</span>
              <span className="font-mono font-bold text-slate-900">
                ₱{formatCurrency(stats.pickupSlipTotal)} / ₱{formatCurrency(stats.pickupCountedTotal)}{' '}
                <span
                  className={
                    reconciliationStats.pickupVariance === 0
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  (Var: ₱{formatCurrency(reconciliationStats.pickupVariance)})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">VDS Validated vs Shift Deposits</span>
              <span className="font-mono font-bold text-slate-900">
                {reconciliationStats.vdsCoveragePct.toFixed(1)}% matched{' '}
                <span className="text-slate-500">
                  (Δ ₱{formatCurrency(reconciliationStats.vdsVsDepositDiff)})
                </span>
              </span>
            </div>
            {reconciliationStats.depositTypes.length > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-medium">Shift Deposit Mix</span>
                <div className="flex items-center gap-2">
                  {reconciliationStats.depositTypes.map((dt) => (
                    <Badge key={dt.type} variant="info">
                      {dt.type}: ₱{formatCurrency(dt.amount)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Collection Purposes & Active Stations across all 5 registries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Collection Purposes */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Collections by Purpose</h3>
            <p className="text-[11px] text-slate-500">Distribution across collection categories</p>
          </div>
          {purposeBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No collection data yet</div>
          ) : (
            <div className="space-y-3">
              {purposeBreakdown.map((p) => (
                <div key={p.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{p.label}</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₱{formatCurrency(p.amount)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${p.widthPct}%` }}
                      className="h-full rounded-full bg-[#0E4DA4] transition-all duration-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Stations across all 5 registries */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Active Stations Summary</h3>
              <p className="text-[11px] text-slate-500">
                Breakdown across DSR Fuel Sales, Deposits, Pickups, VDS & Collections
              </p>
            </div>
          </div>
          {topStations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No station activity yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topStations.map((st) => (
                <div key={st.station} className="py-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="default">{st.station}</Badge>
                      <span className="font-semibold text-slate-700 truncate">
                        {formatStationOption(st.station)}
                      </span>
                    </div>
                    <span className="font-mono font-extrabold text-[#0E4DA4] shrink-0 ml-2">
                      DSR: ₱{formatCurrency(st.dsr)} ({Math.round(st.liters).toLocaleString('en-PH')} L)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                    <span>Dep: ₱{formatCurrency(st.deposits)}</span>
                    <span>•</span>
                    <span>BPK: ₱{formatCurrency(st.pickups)}</span>
                    <span>•</span>
                    <span>VDS: ₱{formatCurrency(st.vds)}</span>
                    <span>•</span>
                    <span>Col: ₱{formatCurrency(st.collections)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
