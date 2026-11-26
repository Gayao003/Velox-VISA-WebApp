import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useDataCache } from '../context/DataCacheContext';
import { formatCurrency } from '../lib/format';
import { Badge } from '../core/ui/badge';

const DONUT_COLORS = ['#C8102E', '#1E293B', '#D97706', '#10B981', '#0EA5E9', '#64748B'];

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { deposits, collections, bankPickups, vdsRecords, meterReadings } = useDataCache();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalDeposits = deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const totalCollections = collections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const pickupInTransit = bankPickups
      .filter((p) => p.status === 'In-transit')
      .reduce((s, p) => s + (Number(p.slipAmount) || 0), 0);
    const pickupDeposited = bankPickups
      .filter((p) => p.status === 'Deposited')
      .reduce((s, p) => s + (Number(p.countedAmount) || 0), 0);
    const pickupSlipTotal = bankPickups.reduce((s, p) => s + (Number(p.slipAmount) || 0), 0);
    const pickupCountedTotal = bankPickups.reduce((s, p) => s + (Number(p.countedAmount) || 0), 0);

    const totalVds = vdsRecords.reduce((s, v) => s + (Number(v.amount) || 0), 0);

    const stationSet = new Set<string>();
    deposits.forEach((d) => d.stationId && stationSet.add(d.stationId));
    collections.forEach((c) => c.stationId && stationSet.add(c.stationId));
    bankPickups.forEach((b) => b.stationId && stationSet.add(b.stationId));
    vdsRecords.forEach((v) => v.stationId && stationSet.add(v.stationId));
    meterReadings.forEach((m) => m.stationId && stationSet.add(m.stationId));

    return {
      totalDeposits,
      totalCollections,
      pickupInTransit,
      pickupDeposited,
      pickupSlipTotal,
      pickupCountedTotal,
      totalVds,
      depositCount: deposits.length,
      collectionCount: collections.length,
      pickupCount: bankPickups.length,
      vdsCount: vdsRecords.length,
      meterCount: meterReadings.length,
      activeStations: stationSet.size,
    };
  }, [deposits, collections, bankPickups, vdsRecords, meterReadings]);

  // Daily Trend: Deposits vs Collections vs VDS (last 7 active dates)
  const dailyTrend = useMemo(() => {
    const map = new Map<
      string,
      { date: string; deposits: number; collections: number; vds: number }
    >();
    const ensure = (date: string) =>
      map.get(date) || { date, deposits: 0, collections: 0, vds: 0 };

    deposits.forEach((d) => {
      if (!d.date) return;
      const cur = ensure(d.date);
      cur.deposits += Number(d.amount) || 0;
      map.set(d.date, cur);
    });
    collections.forEach((c) => {
      if (!c.date) return;
      const cur = ensure(c.date);
      cur.collections += Number(c.amount) || 0;
      map.set(c.date, cur);
    });
    vdsRecords.forEach((v) => {
      const dt = v.depositDate || v.date;
      if (!dt) return;
      const cur = ensure(dt);
      cur.vds += Number(v.amount) || 0;
      map.set(dt, cur);
    });

    const sorted = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    const maxVal = Math.max(
      1,
      ...sorted.map((x) => Math.max(x.deposits, x.collections, x.vds))
    );
    return { items: sorted, maxVal };
  }, [deposits, collections, vdsRecords]);

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

  // Top Stations across all 4 registries
  const topStations = useMemo(() => {
    const map = new Map<
      string,
      { station: string; deposits: number; collections: number; vds: number }
    >();
    const ensure = (st: string) =>
      map.get(st) || { station: st, deposits: 0, collections: 0, vds: 0 };

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
    vdsRecords.forEach((v) => {
      if (!v.stationId) return;
      const cur = ensure(v.stationId);
      cur.vds += Number(v.amount) || 0;
      map.set(v.stationId, cur);
    });

    return Array.from(map.values())
      .sort((a, b) => b.deposits + b.collections + b.vds - (a.deposits + a.collections + a.vds))
      .slice(0, 5);
  }, [deposits, collections, vdsRecords]);

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
          <span className="font-medium">VISA</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-bold text-slate-900">Dashboard</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Station Operations Dashboard
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-[#991B1B] border border-red-200 flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3" />
              Live Overview
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              <Building2 className="h-3.5 w-3.5 text-[#C8102E]" />
              {stats.activeStations} Active Station(s)
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Real-time summary across Shift Deposits, Shift Collections, Bank Pickups, and VDS Registry
        </p>
      </div>

      {/* 4 Primary Registry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/shift-deposits')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-red-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Shift Deposits
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-[#C8102E] group-hover:bg-[#C8102E] group-hover:text-white transition-colors">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            ₱{formatCurrency(stats.totalDeposits)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.depositCount} slip(s) recorded</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#C8102E] transition-colors" />
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
              Bank Pickups (In-Transit)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2 font-mono">
            ₱{formatCurrency(stats.pickupInTransit)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.pickupCount} pickup(s) • Dep: ₱{formatCurrency(stats.pickupDeposited)}</span>
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
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart: Deposits vs Collections vs VDS by Date */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#C8102E]" />
                <span>Deposits, Collections & VDS Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">Last 7 recorded dates</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#C8102E]" /> Deposits
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-800" /> Collections
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> VDS
              </span>
            </div>
          </div>

          {dailyTrend.items.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Add Shift Deposits, Collections, or VDS records to view daily trend charts
            </div>
          ) : (
            <div className="h-56 flex items-end justify-around gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
              {dailyTrend.items.map((d) => {
                const depH = Math.max(4, (d.deposits / dailyTrend.maxVal) * 100);
                const colH = Math.max(4, (d.collections / dailyTrend.maxVal) * 100);
                const vdsH = Math.max(4, (d.vds / dailyTrend.maxVal) * 100);
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
                        <div>Dep: ₱{formatCurrency(d.deposits)}</div>
                        <div>Col: ₱{formatCurrency(d.collections)}</div>
                        <div>VDS: ₱{formatCurrency(d.vds)}</div>
                      </div>
                    )}
                    <div className="w-full flex items-end justify-center gap-1 h-40">
                      <div
                        style={{ height: `${depH}%` }}
                        className="w-3 sm:w-4 rounded-t-md bg-[#C8102E] group-hover:bg-[#A30D24] transition-all duration-500"
                      />
                      <div
                        style={{ height: `${colH}%` }}
                        className="w-3 sm:w-4 rounded-t-md bg-slate-800 group-hover:bg-slate-600 transition-all duration-500"
                      />
                      <div
                        style={{ height: `${vdsH}%` }}
                        className="w-3 sm:w-4 rounded-t-md bg-emerald-500 group-hover:bg-emerald-400 transition-all duration-500"
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

      {/* Bottom Row: Purpose Bars & Bank Pickup Reconciliation / Top Stations */}
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
                      className="h-full rounded-full bg-[#C8102E] transition-all duration-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Stations */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Top Active Stations</h3>
              <p className="text-[11px] text-slate-500">
                Combined Deposits, Collections & VDS volume
              </p>
            </div>
            {stats.pickupCount > 0 && (
              <span className="text-[11px] font-semibold text-slate-500">
                Pickup Variance: ₱
                {formatCurrency(stats.pickupCountedTotal - stats.pickupSlipTotal)}
              </span>
            )}
          </div>
          {topStations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No station activity yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topStations.map((st) => (
                <div
                  key={st.station}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Badge variant="default">{st.station}</Badge>
                    <span className="text-slate-500 truncate">
                      Dep: ₱{formatCurrency(st.deposits)} • Col: ₱{formatCurrency(st.collections)} • VDS: ₱{formatCurrency(st.vds)}
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-slate-900 shrink-0 ml-2">
                    ₱{formatCurrency(st.deposits + st.collections + st.vds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
