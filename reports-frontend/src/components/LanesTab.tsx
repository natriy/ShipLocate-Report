import React, { useState, useMemo } from 'react';
import { cn, exportToCSV } from '@/lib/utils';
import { Search, X, Route, DollarSign, Package, ShieldAlert, ArrowUpDown, ChevronRight, Filter, AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Minus, Clock, Activity, Info, Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface LanesTabProps {
  lanes: any[];
  loads_raw: any[];
  isDark?: boolean;
  currency?: string;
}

const formatCurrency = (val: number | null) => val != null ? `$${Math.round(val).toLocaleString()}` : '—';
const formatNumber = (val: number) => val.toLocaleString();
const round1d = (val: number) => Math.round(val * 10) / 10;

type SortKey = 'lane' | 'loads' | 'spend' | 'avg_rate' | 'leakage' | 'carriers_count';

const SH = "text-[10px] uppercase tracking-wider font-black text-muted-foreground";
const TH = `cursor-pointer px-5 py-3 ${SH} hover:text-brand-blue transition-colors select-none`;

function DetailCard({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted/60 transition-colors">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-[9px] uppercase font-black tracking-wider">{label}</span>
      </div>
      <div className={cn("text-sm font-black text-foreground truncate", valueColor)}>{value}</div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-muted-foreground">
      <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="px-2 py-1 hover:text-brand-blue disabled:opacity-30 cursor-pointer">«</button>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-2 py-1 hover:text-brand-blue disabled:opacity-30 cursor-pointer">‹</button>
      <span className="text-foreground">{currentPage} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-2 py-1 hover:text-brand-blue disabled:opacity-30 cursor-pointer">›</button>
      <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 hover:text-brand-blue disabled:opacity-30 cursor-pointer">»</button>
    </div>
  );
}

export default function LanesTab({ lanes, loads_raw, isDark = false, currency = 'USD' }: LanesTabProps) {
  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return currency === 'CAD' ? `C$${Math.round(val).toLocaleString()}` : `$${Math.round(val).toLocaleString()}`;
  };

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'single' | 'savings'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('loads');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedLaneKey, setSelectedLaneKey] = useState<string | null>(null);
  const [loadsPage, setLoadsPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const renderSortArrow = (key: string) => {
    if (sortKey !== key) return null;
    return (
      <span className="text-[8px] text-brand-blue font-semibold ml-0.5">
        {sortDesc ? '▼' : '▲'}
      </span>
    );
  };

  const renderTooltip = (text: string, align: 'left' | 'center' | 'right' = 'center') => {
    let alignClass = "left-1/2 -translate-x-1/2";
    if (align === 'left') {
      alignClass = "left-0";
    } else if (align === 'right') {
      alignClass = "right-0";
    }
    return (
      <div 
        className="relative group inline-block cursor-help ml-1 text-muted-foreground/60 hover:text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Info size={11} className="stroke-[2.5]" />
        <div className={`absolute top-full ${alignClass} mt-1.5 hidden group-hover:block w-48 bg-brand-navy text-white text-[10px] p-2 rounded-lg shadow-md font-normal text-center z-50 normal-case leading-normal whitespace-normal break-words pointer-events-none`}>
          {text}
        </div>
      </div>
    );
  };

  // 1. Calculate Top KPI Cards
  const kpis = useMemo(() => {
    const totalLanes = lanes.length;
    const totalSpend = lanes.reduce((sum, l) => sum + (l.spend || 0), 0);
    const totalLeakage = lanes.reduce((sum, l) => sum + (l.leakage || 0), 0);
    const singleSourceLanes = lanes.filter(l => l.carriers_count === 1).length;
    return { totalLanes, totalSpend, totalLeakage, singleSourceLanes };
  }, [lanes]);

  // 2. Filter & Sort Lanes List
  const filteredAndSorted = useMemo(() => {
    return lanes
      .filter(lane => {
        const q = search.toLowerCase();
        const matchesSearch = !search || 
          lane.shipper.toLowerCase().includes(q) || 
          lane.receiver.toLowerCase().includes(q) || 
          lane.shipperCity.toLowerCase().includes(q) || 
          lane.receiverCity.toLowerCase().includes(q);
        
        if (!matchesSearch) return false;

        if (filter === 'single' && lane.carriers_count !== 1) return false;
        if (filter === 'savings' && (lane.leakage || 0) <= 0) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: any, valB: any;
        if (sortKey === 'lane') { valA = a.key; valB = b.key; }
        else if (sortKey === 'loads') { valA = a.loads || 0; valB = b.loads || 0; }
        else if (sortKey === 'spend') { valA = a.spend || 0; valB = b.spend || 0; }
        else if (sortKey === 'avg_rate') { valA = a.avg_rate || 0; valB = b.avg_rate || 0; }
        else if (sortKey === 'leakage') { valA = a.leakage || 0; valB = b.leakage || 0; }
        else if (sortKey === 'carriers_count') { valA = a.carriers_count || 0; valB = b.carriers_count || 0; }
        
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
  }, [lanes, search, filter, sortKey, sortDesc]);

  // 3. Selected Lane Details
  const selected = useMemo(() => lanes.find(l => l.key === selectedLaneKey), [lanes, selectedLaneKey]);

  // 4. Selected Lane Recent Loads List
  const laneLoads = useMemo(() => {
    if (!selected) return [];
    return loads_raw
      .filter(l => 
        (l.shippers || []).some((sh: any) => sh.name === selected.shipper) &&
        (l.customers || []).some((c: any) => c.name === selected.receiver)
      )
      .map(l => {
        const sh = (l.shippers || []).find((s: any) => s.name === selected.shipper);
        const cust = (l.customers || []).find((c: any) => c.name === selected.receiver);
        return {
          id: l.id,
          date: l.date,
          month: l.month,
          carrier: l.carrier,
          trip_type: l.trip_type,
          total_spend: l.total_spend,
          // proportional share for this single drop
          spend_share: cust?.spend_share || (l.total_spend / (l.customers || []).length)
        };
      })
  }, [selected, loads_raw]);

  const rateTrendData = useMemo(() => {
    if (laneLoads.length === 0) return [];
    
    // Group spend by month
    const monthlySpend: Record<string, { total_spend: number; count: number }> = {};
    laneLoads.forEach(l => {
      const m = l.month || l.date?.substring(0, 7);
      if (m) {
        if (!monthlySpend[m]) {
          monthlySpend[m] = { total_spend: 0, count: 0 };
        }
        monthlySpend[m].total_spend += l.spend_share || 0;
        monthlySpend[m].count++;
      }
    });

    // Convert to sorted array and calculate averages
    return Object.entries(monthlySpend)
      .map(([month, data]) => ({
        month,
        avg_rate: Math.round(data.total_spend / data.count)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [laneLoads]);

  const totalLoadsPages = Math.ceil(laneLoads.length / ITEMS_PER_PAGE);
  const currentLoadsList = laneLoads.slice((loadsPage - 1) * ITEMS_PER_PAGE, loadsPage * ITEMS_PER_PAGE);

  // Reset page when switching lanes
  React.useEffect(() => {
    setLoadsPage(1);
  }, [selectedLaneKey]);

  const excludedCount = useMemo(() => {
    return loads_raw.filter(l => (l.total_spend || 0) <= 0).length;
  }, [loads_raw]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── RATE EXCLUSION WARNING BANNER ── */}
      {excludedCount > 0 && (
        <div className="bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-brand-yellow font-semibold animate-in fade-in duration-200">
          <AlertTriangle size={16} className="text-brand-yellow shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-extrabold uppercase tracking-wider block mb-0.5">Rate Auditing Alert</span>
            {excludedCount} shipments with $0 rate in the selected period were excluded from the analysis. This ensures that average rates, cheapest carrier calculations, and rate leakage potentials remain mathematically accurate and are not skewed by incomplete records.
          </div>
        </div>
      )}

      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Lanes Audited</span>
            <div className="p-1.5 bg-brand-navy/10 rounded-lg text-brand-navy"><Route size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-navy">{formatNumber(kpis.totalLanes)}</div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-1">Unique origin-destination pairs</div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Spend</span>
            <div className="p-1.5 bg-brand-blue/10 rounded-lg text-brand-blue"><DollarSign size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-blue">{formatCurrency(kpis.totalSpend)}</div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-1">Proportional load spend</div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200 border-brand-red/30 bg-brand-red/5">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-red">Overspend (Leakage)</span>
            <div className="p-1.5 bg-brand-red/10 rounded-lg text-brand-red"><TrendingDown size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-red">{formatCurrency(kpis.totalLeakage)}</div>
          <div className="text-[10px] font-bold text-brand-red/80 mt-1">Savings potential vs cheapest carrier</div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200 border-brand-yellow/30 bg-brand-yellow/5">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-yellow">Single-Source Risk</span>
            <div className="p-1.5 bg-brand-yellow/10 rounded-lg text-brand-yellow"><ShieldAlert size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-yellow">{formatNumber(kpis.singleSourceLanes)}</div>
          <div className="text-[10px] font-bold text-brand-yellow/80 mt-1">Lanes with only 1 active carrier</div>
        </div>
      </div>

      {/* ── MAIN SPLIT VIEW ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT PANEL: TABLE OF LANES */}
        <div className={cn("space-y-4 w-full transition-all duration-500", selectedLaneKey ? "lg:w-7/12" : "w-full")}>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border/50 rounded-2xl p-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
              <input
                type="text"
                placeholder="Search shipper or receiver..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden focus:border-brand-blue"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded text-muted-foreground/70">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1"><Filter size={11} /> Filter:</span>
                <div className="flex bg-muted border border-border/50 rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    onClick={() => setFilter('all')}
                    className={cn("px-2.5 py-1 rounded-md transition-all", filter === 'all' ? "bg-card text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground")}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('single')}
                    className={cn("px-2.5 py-1 rounded-md transition-all flex items-center gap-1", filter === 'single' ? "bg-brand-yellow/10 text-brand-yellow shadow-2xs font-extrabold" : "text-muted-foreground hover:text-brand-yellow")}
                  >
                    Single-Source ({kpis.singleSourceLanes})
                  </button>
                  <button
                    onClick={() => setFilter('savings')}
                    className={cn("px-2.5 py-1 rounded-md transition-all flex items-center gap-1", filter === 'savings' ? "bg-brand-red/10 text-brand-red shadow-2xs font-extrabold" : "text-muted-foreground hover:text-brand-red")}
                  >
                    Savings Potential
                  </button>
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={() => {
                  const headers = ['Route (Lane)', 'Loads', 'Spend', 'Avg Rate', 'Market Savings Potential', 'Active Carriers Count', 'Top Carrier'];
                  const keys = ['key', 'loads', 'spend', 'avg_rate', 'leakage', 'carriers_count', 'top_carrier'];
                  exportToCSV(filteredAndSorted, headers, keys, 'lanes_report');
                }}
                className="flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs select-none shrink-0"
                title="Download lanes seasonality report as CSV"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Export CSV</span>
              </button>
            </div>

          </div>

          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th onClick={() => handleSort('lane')} className={`${TH} text-left`}>
                      <div className="flex items-center gap-1">
                        <span>Lane (Shipper ➔ Receiver)</span>
                        {renderSortArrow('lane')}
                        {renderTooltip('The shipping lane route from pickup location to delivery receiver', 'left')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('loads')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Loads</span>
                        {renderSortArrow('loads')}
                        {renderTooltip('Total shipment volume hauled along this lane', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('spend')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Spend</span>
                        {renderSortArrow('spend')}
                        {renderTooltip('Total estimated transport spend for this lane', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('avg_rate')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Avg Rate</span>
                        {renderSortArrow('avg_rate')}
                        {renderTooltip('Average spend rate per load along this lane', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('leakage')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1 text-brand-red">
                        <span>Leakage (Savings)</span>
                        {renderSortArrow('leakage')}
                        {renderTooltip('Potential savings lost to pricing leakage / non-standard rates', 'right')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('carriers_count')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Carriers</span>
                        {renderSortArrow('carriers_count')}
                        {renderTooltip('Number of unique carriers active on this lane', 'right')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredAndSorted.map((row, idx) => {
                    const isSelected = selectedLaneKey === row.key;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedLaneKey(isSelected ? null : row.key)}
                        className={cn(
                          "hover:bg-muted/30 transition-colors group cursor-pointer",
                          isSelected ? "bg-brand-blue/5 border-l-2 border-l-brand-blue" : ""
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 max-w-[280px]">
                            <div className="truncate">
                              <div className="font-semibold text-foreground group-hover:text-brand-blue transition-colors truncate" title={row.shipper}>
                                {row.shipper}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                                <span>{row.shipperCity}</span>
                                <ArrowRight size={10} className="text-muted-foreground/60" />
                                <span>{row.receiverCity}</span>
                              </div>
                              <div className="font-semibold text-brand-blue truncate text-[11px] mt-0.5" title={row.receiver}>
                                {row.receiver}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-navy">
                          {formatNumber(round1d(row.loads))}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-blue">
                          {formatCurrency(row.spend)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(row.avg_rate)}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">
                          {row.leakage > 0 ? (
                            <span className="font-black text-brand-red">{formatCurrency(row.leakage)}</span>
                          ) : (
                            <span className="text-brand-green font-bold flex items-center justify-end gap-1 text-xs">
                              Optimal
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={cn(
                              "text-xs font-black px-1.5 py-0.5 rounded-full inline-block text-center min-w-[20px]",
                              row.carriers_count === 1 ? "bg-brand-yellow/10 text-brand-yellow" : "bg-muted text-muted-foreground"
                            )}>
                              {row.carriers_count}
                            </span>
                            {row.carriers_count === 1 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow animate-pulse" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAndSorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground font-semibold">
                        No lanes match the current criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: LANE DETAILS PROFILE */}
        {selected && (
          <div className="w-full lg:w-5/12 bg-card border border-border rounded-2xl shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-right duration-300">
            
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-start">
              <div>
                <span className="text-[9px] uppercase tracking-widest font-black bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-md">
                  Lane Audit Profile
                </span>
                <h3 className="text-sm font-black text-foreground mt-2 leading-tight flex flex-col gap-1">
                  <span className="text-brand-navy truncate max-w-[320px]">{selected.shipper}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground my-1.5">
                    <span className="bg-muted px-1.5 py-0.5 rounded font-bold">{selected.shipperCity}</span>
                    <ArrowRight size={12} className="text-muted-foreground/60" />
                    <span className="bg-muted px-1.5 py-0.5 rounded font-bold">{selected.receiverCity}</span>
                  </div>
                  <span className="text-brand-blue truncate max-w-[320px]">{selected.receiver}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedLaneKey(null)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              
              {/* Lane KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailCard icon={<Package size={13} className="text-brand-navy" />} label="Total Loads" value={round1d(selected.loads)} />
                <DetailCard icon={<DollarSign size={13} />} label="Total Spend" value={formatCurrency(selected.spend)} valueColor="text-brand-blue" />
                <DetailCard icon={<Route size={13} />} label="Avg Rate" value={formatCurrency(selected.avg_rate)} />
                <DetailCard 
                  icon={<Route size={13} className="text-brand-green" />} 
                  label="Cheapest Rate" 
                  value={formatCurrency(selected.cheapest_rate)} 
                  valueColor="text-brand-green"
                />
                <DetailCard 
                  icon={<TrendingDown size={13} />} 
                  label="Overspend" 
                  value={selected.leakage > 0 ? formatCurrency(selected.leakage) : 'Optimal'} 
                  valueColor={selected.leakage > 0 ? "text-brand-red" : "text-brand-green"} 
                />
                <DetailCard 
                  icon={<ShieldAlert size={13} />} 
                  label="Carriers Risk" 
                  value={selected.carriers_count === 1 ? 'High (1)' : `Normal (${selected.carriers_count})`}
                  valueColor={selected.carriers_count === 1 ? 'text-brand-yellow font-black' : 'text-muted-foreground'}
                />
                <DetailCard
                  icon={<Activity size={13} className={cn(
                    selected.otd_percent >= 90 ? "text-emerald-500" : selected.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                  )}/>}
                  label="OTD Rate"
                  value={selected.otd_eligible > 0 ? `${selected.otd_percent}%` : 'No data'}
                  valueColor={cn(
                    selected.otd_percent >= 90 ? "text-emerald-500" : selected.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                  )}
                />
                <DetailCard
                  icon={<Clock size={13} className="text-slate-500" />}
                  label="Avg Delay"
                  value={selected.otd_eligible > 0 && selected.otd_avg_delay > 0 ? `${selected.otd_avg_delay} hrs` : '0.0 hrs'}
                  valueColor="text-slate-600"
                />
              </div>

              {/* MoM Rate Trend Chart */}
              {rateTrendData.length > 1 && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
                  <div>
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      📈 Rate Trend & Seasonality (MoM)
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Average monthly rate progression for this lane</p>
                  </div>
                  <div className="h-40 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rateTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="month" 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(val) => currency === 'CAD' ? `C$${val}` : `$${val}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '8px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                          }}
                          formatter={(value: any) => [currency === 'CAD' ? `C$${value}` : `$${value}`, 'Avg Rate']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avg_rate" 
                          stroke="#2563eb" 
                          strokeWidth={2.5} 
                          dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} 
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Carrier Comparison Table */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  🚛 Carrier Cost Benchmarking
                </h4>
                <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-[9px] uppercase tracking-wider font-extrabold">Carrier</th>
                        <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider font-extrabold">Loads</th>
                        <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider font-extrabold">Avg Rate</th>
                        <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider font-extrabold text-brand-red">Variance</th>
                        <th className="px-3 py-2 text-right text-[9px] uppercase tracking-wider font-extrabold">OTD %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {selected.carriers.map((c: any, i: number) => {
                        const isCheapest = c.name === selected.cheapest_carrier;
                        const variance = c.avg_rate - selected.cheapest_rate;
                        const variancePct = selected.cheapest_rate > 0 ? (variance / selected.cheapest_rate) * 100 : 0;
                        return (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-foreground truncate max-w-[120px]" title={c.name}>{c.name}</div>
                              <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                {round1d(c.tl_loads)} TL · {round1d(c.ltl_loads)} LTL
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-brand-navy tabular-nums">
                              {round1d(c.loads)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">
                              {formatCurrency(c.avg_rate)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {isCheapest ? (
                                <span className="text-[10px] font-black text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded">
                                  Cheapest
                                </span>
                              ) : variance > 0 ? (
                                <div className="text-[10px] font-bold text-brand-red flex flex-col justify-end">
                                  <span>+{formatCurrency(variance)}</span>
                                  <span className="text-[9px] font-medium opacity-80">+{variancePct.toFixed(0)}%</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {c.otd_eligible > 0 ? (
                                <span className={cn(
                                  "font-extrabold",
                                  c.otd_percent >= 90 ? "text-emerald-500" : c.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                                )}>
                                  {c.otd_percent}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 font-normal">No data</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Loads Table */}
              <div className="space-y-2.5 pt-2">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                  <span>📦 Recent Lane Shipments</span>
                  <span className="text-[9px] font-medium lowercase text-muted-foreground">({laneLoads.length} total)</span>
                </h4>
                <div className="space-y-2">
                  {currentLoadsList.map((load: any, i: number) => (
                    <div key={i} className="p-3 bg-muted/20 border border-border/50 rounded-xl hover:border-brand-blue/30 hover:bg-muted/30 transition-all flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>ID: {load.id}</span>
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded",
                            load.trip_type === 'LTL' ? "bg-brand-yellow/10 text-brand-yellow" : "bg-brand-green/10 text-brand-green"
                          )}>
                            {load.trip_type}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold mt-1">
                          {load.date} · <span className="text-brand-navy">{load.carrier}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-foreground tabular-nums">{formatCurrency(load.spend_share)}</div>
                        <div className="text-[8px] text-muted-foreground font-semibold">Pro-rata portion</div>
                      </div>
                    </div>
                  ))}
                  {laneLoads.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      No matching loads found
                    </div>
                  )}
                  <Pagination currentPage={loadsPage} totalPages={totalLoadsPages} onPageChange={setLoadsPage} />
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
