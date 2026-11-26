import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Gauge,
  Building2,
  ArrowUpRight,
  Home,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useDataCache } from '../context/DataCacheContext';
import { formatCurrency } from '../lib/format';
import { Badge } from '../core/ui/badge';

const DONUT_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { deposits, collections, meterReadings } = useDataCache();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalDeposits = deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const cashDeposits = deposits
      .filter((d) => d.depositType === 'Cash')
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const chequeDeposits = deposits
      .filter((d) => d.depositType === 'Cheque')
      .reduce((s, d) => s + (Number(d.amount) || 0), 0);

    const totalCollections = collections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const stationSet = new Set<string>();
    deposits.forEach((d) => d.stationId && stationSet.add(d.stationId));
    collections.forEach((c) => c.stationId && stationSet.add(c.stationId));
    meterReadings.forEach((m) => m.stationId && stationSet.add(m.stationId));

    return {
      totalDeposits,
      cashDeposits,
      chequeDeposits,
      totalCollections,
      depositCount: deposits.length,
      collectionCount: collections.length,
      meterCount: meterReadings.length,
      activeStations: stationSet.size,
    };
  }, [deposits, collections, meterReadings]);

  // Daily Deposits vs Collections (last 7 active dates)
  const dailyTrend = useMemo(() => {
    const map = new Map<string, { date: string; deposits: number; collections: number }>();
    deposits.forEach((d) => {
      if (!d.date) return;
      const cur = map.get(d.date) || { date: d.date, deposits: 0, collections: 0 };
      cur.deposits += Number(d.amount) || 0;
      map.set(d.date, cur);
    });
    collections.forEach((c) => {
      if (!c.date) return;
      const cur = map.get(c.date) || { date: c.date, deposits: 0, collections: 0 };
      cur.collections += Number(c.amount) || 0;
      map.set(c.date, cur);
    });
    const sorted = Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    const maxVal = Math.max(
      1,
      ...sorted.map((x) => Math.max(x.deposits, x.collections))
    );
    return { items: sorted, maxVal };
  }, [deposits, collections]);

  // Payment Type Donut Data (from Shift Collections)
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

  // Top Stations by Total Volume (Deposits + Collections)
  const topStations = useMemo(() => {
    const map = new Map<string, { station: string; deposits: number; collections: number }>();
    deposits.forEach((d) => {
      const cur = map.get(d.stationId) || { station: d.stationId, deposits: 0, collections: 0 };
      cur.deposits += Number(d.amount) || 0;
      map.set(d.stationId, cur);
    });
    collections.forEach((c) => {
      const cur = map.get(c.stationId) || { station: c.stationId, deposits: 0, collections: 0 };
      cur.collections += Number(c.amount) || 0;
      map.set(c.stationId, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.deposits + b.collections - (a.deposits + a.collections))
      .slice(0, 5);
  }, [deposits, collections]);

  // Build SVG Donut segments
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
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3" />
              Live Overview
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Real-time summary of Shift Deposits, Shift Collections, and Pump Meter Readings
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/shift-deposits')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-blue-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Shift Deposits
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            ₱{formatCurrency(stats.totalDeposits)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{stats.depositCount} slip(s) recorded</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
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
          onClick={() => navigate('/meter-readings')}
          className="text-left p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-amber-300 hover:shadow-md transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Meter Readings
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            {stats.meterCount}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Logged pump readings</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
        </button>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Stations
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            {stats.activeStations}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Cash: ₱{formatCurrency(stats.cashDeposits)} • Chq: ₱{formatCurrency(stats.chequeDeposits)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart: Deposits vs Collections by Date */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span>Deposits vs Collections Trend</span>
              </h3>
              <p className="text-[11px] text-slate-500">Last 7 recorded dates</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Deposits
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Collections
              </span>
            </div>
          </div>

          {dailyTrend.items.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Add Shift Deposits or Collections to view daily trend charts
            </div>
          ) : (
            <div className="h-56 flex items-end justify-around gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
              {dailyTrend.items.map((d) => {
                const depH = Math.max(4, (d.deposits / dailyTrend.maxVal) * 100);
                const colH = Math.max(4, (d.collections / dailyTrend.maxVal) * 100);
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
                      </div>
                    )}
                    <div className="w-full flex items-end justify-center gap-1.5 h-40">
                      <div
                        style={{ height: `${depH}%` }}
                        className="w-4 sm:w-6 rounded-t-md bg-blue-600 group-hover:bg-blue-500 transition-all duration-500"
                      />
                      <div
                        style={{ height: `${colH}%` }}
                        className="w-4 sm:w-6 rounded-t-md bg-emerald-500 group-hover:bg-emerald-400 transition-all duration-500"
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

      {/* Bottom Row: Purpose Bars & Top Stations */}
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
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Stations */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Top Active Stations</h3>
            <p className="text-[11px] text-slate-500">Combined Deposits & Collections volume</p>
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
                  <div className="flex items-center gap-2.5">
                    <Badge variant="default">{st.station}</Badge>
                    <span className="text-slate-500">
                      Dep: ₱{formatCurrency(st.deposits)} • Col: ₱{formatCurrency(st.collections)}
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-slate-900">
                    ₱{formatCurrency(st.deposits + st.collections)}
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
