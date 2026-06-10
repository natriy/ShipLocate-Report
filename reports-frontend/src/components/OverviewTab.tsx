import React, { useMemo } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line
} from 'recharts';
import { TrendingUp, Calendar, BarChart3, Truck, Users } from 'lucide-react';

interface OverviewTabProps {
  monthly: any[];
  daily: any[];
  dow: Record<string, { avg: number; tl: number; ltl: number }>;
  customers: any[];
  carriers: any[];
  comparisonList?: { year: number; label?: string; color: string; data: any }[];
  currency?: string;
}

const formatCurrency = (val: number | null) => val != null ? `$${val.toLocaleString()}` : '—';
const formatNumber = (val: number) => val.toLocaleString();
const round1d = (val: number) => Math.round(val * 10) / 10;
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Premium rich tooltip for monthly/daily charts
function makeRichTooltip(comparisonList: { year: number; label?: string; color: string; data: any }[]) {
  return function RichTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;

    // Format label
    let displayLabel = label;
    if (typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
      const [y, m, d] = label.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      displayLabel = date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
      });
    }

    // Grab primary values from payload
    const findVal = (key: string) => {
      const e = payload.find((p: any) => p.dataKey === key);
      return e ? (e.value ?? 0) : 0;
    };
    const primaryTL  = findVal('tl');
    const primaryLTL = findVal('ltl');
    const primaryTotal = Math.round((primaryTL + primaryLTL) * 10) / 10;

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs animate-in fade-in zoom-in-95 duration-100 min-w-[160px]">
        <p className="font-bold text-foreground mb-2.5 border-b border-border pb-1.5">{displayLabel}</p>

        {/* Primary period */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0 bg-[#16a34a]" />
              <span className="text-muted-foreground">TL:</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">{primaryTL}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0 bg-[#d97706]" />
              <span className="text-muted-foreground">LTL:</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">{primaryLTL}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-1 mt-1">
            <span className="text-muted-foreground font-bold">Total:</span>
            <span className="font-black text-foreground tabular-nums">{primaryTotal}</span>
          </div>
        </div>

        {/* Comparison periods */}
        {comparisonList.map(c => {
          const cTL    = findVal(`compare_${c.year}_tl`);
          const cLTL   = findVal(`compare_${c.year}_ltl`);
          const cTotal = Math.round((cTL + cLTL) * 10) / 10;
          if (cTotal === 0 && cTL === 0 && cLTL === 0) return null;
          return (
            <div key={c.year} className="space-y-1 border-t border-border/50 pt-2 mt-1">
              <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: c.color }}>vs {c.label || `${c.year} yr ago`}</p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0 bg-[#16a34a] opacity-50" />
                  <span className="text-muted-foreground">TL:</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: c.color }}>{cTL}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0 bg-[#d97706] opacity-50" />
                  <span className="text-muted-foreground">LTL:</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: c.color }}>{cLTL}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-1 mt-1">
                <span className="text-muted-foreground font-bold">Total:</span>
                <span className="font-black tabular-nums" style={{ color: c.color }}>{cTotal}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
}

// Simple tooltip for non-stacked charts (DoW, top lists, etc.)
const SimpleTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs animate-in fade-in zoom-in-95 duration-100">
        <p className="font-bold text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-bold text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function getCompareDate(dateStr: string, yearOffset: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0]) - yearOffset;
  return `${y}-${parts[1]}-${parts[2]}`;
}

function getTicks(dates: string[]): string[] {
  if (dates.length <= 15) return dates;
  if (dates.length <= 31) {
    return dates.filter((_, idx) => idx % 3 === 0);
  }
  if (dates.length <= 90) {
    return dates.filter((_, idx) => idx % 7 === 0);
  }
  return dates.filter(d => d.endsWith('-01') || d.endsWith('-15'));
}

const formatXAxisDate = (tickItem: string) => {
  if (typeof tickItem === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tickItem)) {
    const [_, m, d] = tickItem.split('-');
    const monthName = MONTH_NAMES_SHORT[parseInt(m) - 1];
    return `${monthName} ${parseInt(d)}`;
  }
  return tickItem;
};

export default function OverviewTab({ monthly, daily: primaryDaily = [], dow, customers, carriers, comparisonList = [], currency = 'USD' }: OverviewTabProps) {
  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return currency === 'CAD' ? `C$${val.toLocaleString()}` : `$${val.toLocaleString()}`;
  };

  const hasComparison = comparisonList.length > 0;
  const topCustomers = [...customers]
    .sort((a, b) => {
      const aVal = a.total_loads != null ? a.total_loads : ((a.tl_loads || 0) + (a.ltl_loads || 0));
      const bVal = b.total_loads != null ? b.total_loads : ((b.tl_loads || 0) + (b.ltl_loads || 0));
      return bVal - aVal;
    })
    .slice(0, 5)
    .map(c => {
      const tl = round1d(c.tl_loads != null ? c.tl_loads : (c.single || 0));
      const ltl = round1d(c.ltl_loads != null ? c.ltl_loads : (c.multi || 0));
      const total_loads = round1d(c.total_loads != null ? c.total_loads : (tl + ltl));
      const total_drops = c.total_drops != null ? c.total_drops : (c.loads || 0);
      return {
        name: c.name,
        tl_loads: tl,
        ltl_loads: ltl,
        total_loads: total_loads,
        total_drops: total_drops,
        otd: c.otd_percent ?? 100,
        avg_delay: c.otd_avg_delay ?? 0,
        // For backwards compatibility and progress bar layout
        loads: total_loads,
        tl: tl,
        ltl: ltl
      };
    });

  const topCarriers = [...carriers]
    .sort((a, b) => (b.loads || 0) - (a.loads || 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name,
      loads: c.loads || 0,
      tl: c.single || 0,
      ltl: c.multi || 0,
      otd: c.otd_percent ?? 100,
      avg_delay: c.otd_avg_delay ?? 0
    }));

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthlyMerged = useMemo(() => {
    // Build a fast lookup for each comparison period's monthly data: monthStr -> row
    const compMaps = comparisonList.map(c => {
      const map = new Map<string, any>();
      (c.data.monthly || []).forEach((row: any) => map.set(row.month, row));
      return { year: c.year, map };
    });

    return monthly.map((m) => {
      const [yStr, mStr] = m.month.split('-');
      const monthNum = parseInt(mStr);
      const yrShort = yStr.substring(2);
      const entry: any = {
        name: `${MONTH_NAMES_SHORT[monthNum - 1]} '${yrShort}`,
        tl: m.tl ?? 0,
        ltl: m.ltl ?? 0,
        total: m.loads ?? 0
      };
      compMaps.forEach(comp => {
        // Shift month string back by the offset years
        const compYear = parseInt(yStr) - comp.year;
        const compMonthStr = `${compYear}-${mStr}`;
        const compRow = comp.map.get(compMonthStr);
        entry[`compare_${comp.year}_total`] = compRow?.loads ?? 0;
        entry[`compare_${comp.year}_tl`]    = compRow?.tl ?? 0;
        entry[`compare_${comp.year}_ltl`]   = compRow?.ltl ?? 0;
      });
      return entry;
    });
  }, [monthly, comparisonList]);

  const dowData = dayLabels.map((label, i) => {
    const dayObj = dow[days[i]] || { avg: 0, tl: 0, ltl: 0 };
    const entry: any = {
      day: label,
      tl:  dayObj.tl,
      ltl: dayObj.ltl,
      total: dayObj.avg,
    };
    comparisonList.forEach(c => {
      const cDayObj = c.data.dow?.[days[i]] || { avg: 0, tl: 0, ltl: 0 };
      entry[`compare_${c.year}_total`] = cDayObj.avg ?? 0;
      entry[`compare_${c.year}_tl`]   = cDayObj.tl  ?? 0;
      entry[`compare_${c.year}_ltl`]  = cDayObj.ltl ?? 0;
    });
    return entry;
  });

  const dailyMerged = useMemo(() => {
    const compMaps = comparisonList.map(c => {
      const map = new Map<string, any>();
      (c.data.daily || []).forEach((dItem: any) => {
        map.set(dItem.date, dItem);
      });
      return { year: c.year, map };
    });

    return primaryDaily.map((dayItem: any) => {
      const entry: any = {
        date: dayItem.date,
        tl: dayItem.tl,
        ltl: dayItem.ltl,
        total: dayItem.total
      };

      compMaps.forEach(comp => {
        const compareDate = getCompareDate(dayItem.date, comp.year);
        const compRow = comp.map.get(compareDate);
        entry[`compare_${comp.year}_total`] = compRow?.total ?? 0;
        entry[`compare_${comp.year}_tl`]    = compRow?.tl ?? 0;
        entry[`compare_${comp.year}_ltl`]   = compRow?.ltl ?? 0;
      });

      return entry;
    });
  }, [primaryDaily, comparisonList]);

  const dailyDates = useMemo(() => primaryDaily.map((d: any) => d.date), [primaryDaily]);
  const dailyTicks = useMemo(() => getTicks(dailyDates), [dailyDates]);

  const greenCardClass = "bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs hover:shadow-[0_8px_30px_-6px_rgba(22,163,74,0.04)] hover:border-brand-green/30 transition-all duration-300";
  const blueCardClass = "bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs hover:shadow-[0_8px_30px_-6px_rgba(37,99,235,0.04)] hover:border-brand-blue/30 transition-all duration-300";
  const slateCardClass = "bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs hover:shadow-[0_8px_30px_-6px_rgba(100,116,139,0.04)] hover:border-brand-slate/30 transition-all duration-300";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4";

  // Memoize rich tooltip components so they don't cause re-render issues
  const RichTooltip = useMemo(() => makeRichTooltip(comparisonList), [comparisonList]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Daily Truck Loads Trend - Full Width Combo Chart */}
      <div className={greenCardClass}>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl shrink-0">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Daily Truck Loads Trend
              </h3>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Daily count of TL + LTL loads
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-tighter">
            <div className="flex items-center gap-1.5 text-brand-green">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-brand-green" /> TRUCK LOADS WITH SINGLE DROP (TL)
            </div>
            <div className="flex items-center gap-1.5 text-[#d97706]">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#d97706]" /> TRUCK LOADS WITH MULTI-STOP (LTL)
            </div>
            {hasComparison && (
              <>
                {comparisonList.map(c => (
                  <div key={c.year} className="flex items-center gap-1.5" style={{ color: c.color }}>
                    <span className="w-4 h-0.5 border-t-2 border-dashed inline-block" style={{ borderColor: c.color }} /> vs {c.label || `${c.year} yr ago`}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyMerged} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.4} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                ticks={dailyTicks}
                tickFormatter={formatXAxisDate}
                tick={{ fontSize: 11, fill: 'currentColor', className: 'text-muted-foreground' }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip content={<RichTooltip />} />
              <Bar dataKey="tl" name="TL" stackId="a" fill="#16a34a" maxBarSize={28} />
              <Bar dataKey="ltl" name="LTL" stackId="a" fill="#d97706" maxBarSize={28} radius={[2, 2, 0, 0]} />
              {comparisonList.map(c => (
                <React.Fragment key={c.year}>
                  <Line
                    type="monotone"
                    name={`vs ${c.label || `${c.year} yr ago`}`}
                    dataKey={`compare_${c.year}_total`}
                    stroke={c.color}
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1.5, stroke: '#fff' }}
                    animationDuration={600}
                  />
                  {/* Hidden lines to carry tl/ltl data into tooltip payload */}
                  <Line dataKey={`compare_${c.year}_tl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                  <Line dataKey={`compare_${c.year}_ltl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                </React.Fragment>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly TRUCK Loads - Combo Chart */}
        <div className={greenCardClass}>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl shrink-0">
                <Calendar size={16} />
              </div>
              <div>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Monthly TRUCK Loads
                </h3>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                  Monthly count of TL + LTL loads
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase tracking-tighter">
              <div className="flex items-center gap-1 text-brand-green">
                <span className="w-2 h-2 rounded-xs inline-block bg-brand-green" /> TL
              </div>
              <div className="flex items-center gap-1 text-[#d97706]">
                <span className="w-2.5 h-2.5 rounded-xs inline-block bg-[#d97706]" /> LTL
              </div>
              {hasComparison && (
                <>
                  {comparisonList.map(c => (
                    <div key={c.year} className="flex items-center gap-1" style={{ color: c.color }}>
                      <span className="w-3 h-0.5 border-t border-dashed inline-block" style={{ borderColor: c.color }} /> vs {c.label || `${c.year} yr`}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyMerged} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.4} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', className: 'text-muted-foreground' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<RichTooltip />} />
              <Bar dataKey="tl" name="TL" stackId="a" fill="#16a34a" maxBarSize={30} />
              <Bar dataKey="ltl" name="LTL" stackId="a" fill="#d97706" maxBarSize={30} radius={[2, 2, 0, 0]} />
              {comparisonList.map(c => (
                <React.Fragment key={c.year}>
                  <Line
                    type="monotone"
                    name={`vs ${c.label || `${c.year} yr ago`}`}
                    dataKey={`compare_${c.year}_total`}
                    stroke={c.color}
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: c.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 1.5, stroke: '#fff' }}
                    animationDuration={600}
                  />
                  {/* Hidden lines to carry tl/ltl data into tooltip payload */}
                  <Line dataKey={`compare_${c.year}_tl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                  <Line dataKey={`compare_${c.year}_ltl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                </React.Fragment>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Avg truck Loads by Weekday - Combo Chart */}
      <div className={greenCardClass}>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Avg truck Loads by Weekday
              </h3>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">Average TL + LTL loads per weekday occurrence</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-[9px] font-bold uppercase tracking-tighter">
            <div className="flex items-center gap-1 text-brand-green">
              <span className="w-2 h-2 rounded-xs inline-block bg-brand-green" /> TL
            </div>
            <div className="flex items-center gap-1 text-[#d97706]">
              <span className="w-2.5 h-2.5 rounded-xs inline-block bg-[#d97706]" /> LTL
            </div>
            {hasComparison && (
              <>
                {comparisonList.map(c => (
                  <div key={c.year} className="flex items-center gap-1" style={{ color: c.color }}>
                    <span className="w-3 h-0.5 border-t border-dashed inline-block" style={{ borderColor: c.color }} /> vs {c.label || `${c.year} yr`}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dowData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.4} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<RichTooltip />} />
              <Bar dataKey="tl" name="TL" stackId="a" fill="#16a34a" maxBarSize={36} animationDuration={600} />
              <Bar dataKey="ltl" name="LTL" stackId="a" fill="#d97706" maxBarSize={36} radius={[4, 4, 0, 0]} animationDuration={600} />
              {comparisonList.map(c => (
                <React.Fragment key={c.year}>
                  <Line
                    type="monotone"
                    name={`vs ${c.label || `${c.year} yr ago`}`}
                    dataKey={`compare_${c.year}_total`}
                    stroke={c.color}
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: c.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 1.5, stroke: '#fff' }}
                    animationDuration={600}
                  />
                  <Line dataKey={`compare_${c.year}_tl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                  <Line dataKey={`compare_${c.year}_ltl`} stroke="transparent" dot={false} legendType="none" tooltipType="none" />
                </React.Fragment>
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>

      {/* Middle Row: Top 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top 5 Carriers */}
        <div className={slateCardClass}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-slate/10 text-brand-slate rounded-xl shrink-0">
                <Truck size={16} />
              </div>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Top 5 Carriers by TRUCK Loads
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-tighter shrink-0 select-none">
              <div className="flex items-center gap-1 text-brand-green">
                <span className="w-2 h-2 rounded-xs inline-block bg-[#16a34a]" /> TL
              </div>
              <div className="flex items-center gap-1 text-brand-yellow">
                <span className="w-2 h-2 rounded-xs inline-block bg-[#d97706]" /> LTL
              </div>
              <div className="flex items-center gap-1 text-brand-navy">
                <span className="w-2 h-2 rounded-xs inline-block bg-brand-navy" /> Total Loads
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {topCarriers.map((c, i) => {
              const maxLoads = topCarriers[0]?.loads || 1;
              const outerPct = Math.max((c.loads / maxLoads) * 100, 5);
              const tlPct  = c.loads > 0 ? (c.tl  / c.loads) * 100 : 0;
              const ltlPct = c.loads > 0 ? (c.ltl / c.loads) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-start text-xs gap-2">
                    <span className="font-semibold truncate pr-1 text-foreground leading-tight" title={c.name}>{c.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-emerald-500">{c.otd}% OTD</span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-green tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green inline-block" />
                        {c.tl}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#d97706] tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] inline-block" />
                        {c.ltl}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-brand-navy tabular-nums" title="Total Loads">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-navy inline-block" />
                        {formatNumber(c.loads)}
                      </span>
                    </div>
                  </div>
                  {/* Segmented bar with hover tooltip */}
                  <div className="relative group">
                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                      <div className="h-full flex transition-all duration-700" style={{ width: `${outerPct}%` }}>
                        <div className="h-full bg-[#16a34a] transition-all duration-700" style={{ width: `${tlPct}%` }} />
                        <div className="h-full bg-[#d97706] transition-all duration-700" style={{ width: `${ltlPct}%` }} />
                      </div>
                    </div>
                    {/* Hover tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      bg-card border border-border rounded-lg shadow-lg p-2.5 text-xs min-w-[130px]">
                      <p className="font-bold text-foreground mb-1.5 truncate" title={c.name}>{c.name}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-emerald-500 border-b border-border pb-1 mb-1">
                          <span>OTD Rate:</span>
                          <span>{c.otd}%</span>
                        </div>
                        {c.avg_delay > 0 && (
                          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground pb-1">
                            <span>Avg Delay:</span>
                            <span>{c.avg_delay} hrs</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#16a34a] inline-block" /><span className="text-muted-foreground">TL:</span></div>
                          <span className="font-bold text-foreground tabular-nums">{c.tl}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#d97706] inline-block" /><span className="text-muted-foreground">LTL:</span></div>
                          <span className="font-bold text-foreground tabular-nums">{c.ltl}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1 mt-1">
                          <span className="text-muted-foreground font-bold">Total:</span>
                          <span className="font-black text-foreground tabular-nums">{formatNumber(c.loads)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Customers by TRUCK Loads */}
        <div className={blueCardClass}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-blue/10 text-brand-blue rounded-xl shrink-0">
                <Users size={16} />
              </div>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Top 5 Customers by TRUCK Loads
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-tighter shrink-0 select-none">
              <div className="flex items-center gap-1 text-brand-green">
                <span className="w-2 h-2 rounded-xs inline-block bg-[#16a34a]" /> TL
              </div>
              <div className="flex items-center gap-1 text-brand-yellow">
                <span className="w-2 h-2 rounded-xs inline-block bg-[#d97706]" /> LTL
              </div>
              <div className="flex items-center gap-1 text-brand-navy">
                <span className="w-2 h-2 rounded-xs inline-block bg-brand-navy" /> Total Loads
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {topCustomers.map((c, i) => {
              const maxLoads = topCustomers[0]?.loads || 1;
              // TL and LTL widths relative to each other within the outer bar width
              const outerPct = Math.max((c.loads / maxLoads) * 100, 5);
              const tlPct  = c.loads > 0 ? (c.tl  / c.loads) * 100 : 0;
              const ltlPct = c.loads > 0 ? (c.ltl / c.loads) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-start text-xs gap-2">
                    <span className="font-semibold truncate pr-1 text-foreground leading-tight" title={c.name}>{c.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-emerald-500">{c.otd}% OTD</span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-green tabular-nums" title="TL (Single Drop) Loads">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green inline-block" />
                        {c.tl_loads}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#d97706] tabular-nums" title="LTL (Multi-Stop) Loads Share">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] inline-block" />
                        {c.ltl_loads}
                      </span>
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-navy tabular-nums" title="Total Loads (TL + LTL Share)">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-navy inline-block" />
                        {c.total_loads}
                      </span>
                    </div>
                  </div>
                  {/* Segmented bar with hover tooltip */}
                  <div className="relative group">
                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                      <div className="h-full flex transition-all duration-700" style={{ width: `${outerPct}%` }}>
                        <div className="h-full bg-[#16a34a] transition-all duration-700" style={{ width: `${tlPct}%` }} />
                        <div className="h-full bg-[#d97706] transition-all duration-700" style={{ width: `${ltlPct}%` }} />
                      </div>
                    </div>
                    {/* Hover tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      bg-card border border-border rounded-lg shadow-lg p-2.5 text-xs min-w-[150px]">
                      <p className="font-bold text-foreground mb-1.5 truncate" title={c.name}>{c.name}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-emerald-500 border-b border-border pb-1 mb-1">
                          <span>OTD Rate:</span>
                          <span>{c.otd}%</span>
                        </div>
                        {c.avg_delay > 0 && (
                          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground pb-1">
                            <span>Avg Delay:</span>
                            <span>{c.avg_delay} hrs</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#16a34a] inline-block" /><span className="text-muted-foreground">TL (Single):</span></div>
                          <span className="font-bold text-foreground tabular-nums">{c.tl_loads}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#d97706] inline-block" /><span className="text-muted-foreground">LTL (Multi-Stop):</span></div>
                          <span className="font-bold text-foreground tabular-nums">{c.ltl_loads}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1 mt-1">
                          <span className="text-muted-foreground font-bold">Total Loads:</span>
                          <span className="font-black text-foreground tabular-nums">{c.total_loads}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
