import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Timer,
  Building,
  Truck,
  TrendingUp,
  MapPin,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area
} from 'recharts';

interface TransitTabProps {
  globalArrival: {
    eligible: number;
    ontime: number;
    late: number;
    percent: number;
    avgDelay: number;
  };
  globalOTD: {
    eligible: number;
    ontime: number;
    late: number;
    severe_late: number;
    late_only: number;
    percent: number;
    avgDelay: number;
  };
  globalDwell: {
    eligible: number;
    total_mins: number;
    detention_count: number;
    detention_mins: number;
    avg_dwell_mins: number;
    detention_risk: number;
  };
  globalHourlyDelays: {
    hour: number;
    label: string;
    avgDelay: number;
    count: number;
  }[];
  globalWeekdayDelays: {
    day: string;
    avgDelay: number;
    count: number;
  }[];
  carriers: any[];
  lanes: any[];
}

type SortField = 'loads' | 'ota_percent' | 'avg_arr_delay' | 'otd_percent' | 'avg_arr_delay_val' | 'otd_avg_delay_val';

export default function TransitTab({
  globalArrival,
  globalOTD,
  globalDwell,
  globalHourlyDelays,
  globalWeekdayDelays,
  carriers,
  lanes
}: TransitTabProps) {
  const [activeAuditTab, setActiveAuditTab] = useState<'carriers' | 'lanes'>('carriers');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('loads');
  const [sortAsc, setSortAsc] = useState(false);

  // Custom Hour labels list for formatting
  const formattedHourlyDelays = useMemo(() => {
    return globalHourlyDelays.map(item => ({
      ...item,
      // Simplify the hours representation for charts
      displayHour: `${item.hour}:00`
    }));
  }, [globalHourlyDelays]);

  // Handler for sorting column
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const renderSortArrow = (key: string) => {
    if (sortField !== key) return null;
    return (
      <span className="text-[8px] text-brand-green font-semibold ml-0.5">
        {sortAsc ? '▲' : '▼'}
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

  // Filter & Sort Carriers
  const filteredCarriers = useMemo(() => {
    let result = carriers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) && c.loads > 0
    );

    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === 'loads') {
        valA = a.loads;
        valB = b.loads;
      } else if (sortField === 'ota_percent') {
        valA = a.ota_percent ?? 100;
        valB = b.ota_percent ?? 100;
      } else if (sortField === 'avg_arr_delay') {
        valA = a.avg_arr_delay ?? 0;
        valB = b.avg_arr_delay ?? 0;
      } else if (sortField === 'otd_percent') {
        valA = a.otd_percent ?? 100;
        valB = b.otd_percent ?? 100;
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [carriers, searchQuery, sortField, sortAsc]);

  // Filter & Sort Lanes
  const filteredLanes = useMemo(() => {
    let result = lanes.filter(l => 
      (l.shipper.toLowerCase().includes(searchQuery.toLowerCase()) || 
       l.receiver.toLowerCase().includes(searchQuery.toLowerCase())) && l.loads > 0
    );

    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortField === 'loads') {
        valA = a.loads;
        valB = b.loads;
      } else if (sortField === 'ota_percent') {
        valA = a.ota_percent ?? 100;
        valB = b.ota_percent ?? 100;
      } else if (sortField === 'avg_arr_delay') {
        valA = a.avg_arr_delay ?? 0;
        valB = b.avg_arr_delay ?? 0;
      } else if (sortField === 'otd_percent') {
        valA = a.otd_percent ?? 100;
        valB = b.otd_percent ?? 100;
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [lanes, searchQuery, sortField, sortAsc]);

  const customTooltipStyle = {
    contentStyle: {
      backgroundColor: 'var(--card)',
      borderColor: 'var(--border)',
      borderRadius: '12px',
      color: 'var(--foreground)',
      fontSize: '11px',
      fontWeight: 'bold',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* OTA Card */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">On-Time Arrival (OTA)</div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Clock size={16} /></div>
          </div>
          <div className="text-3xl font-black mb-1.5 text-emerald-500">{globalArrival.percent}%</div>
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{globalArrival.ontime} of {globalArrival.eligible} pickups/drops within 30 minutes</span>
          </div>
          <div className="absolute -right-5 -bottom-5 opacity-5 pointer-events-none text-emerald-500">
            <Clock size={90} />
          </div>
        </div>

        {/* OTD Card */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">On-Time Delivery (OTD)</div>
            <div className="p-2 bg-brand-blue/10 text-brand-blue rounded-lg"><Timer size={16} /></div>
          </div>
          <div className="text-3xl font-black mb-1.5 text-brand-blue">{globalOTD.percent}%</div>
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
            <span>{globalOTD.ontime} of {globalOTD.eligible} completions within 2 hours</span>
          </div>
          <div className="absolute -right-5 -bottom-5 opacity-5 pointer-events-none text-brand-blue">
            <Timer size={90} />
          </div>
        </div>

        {/* Avg Late Arrival Delay */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Late Check-In Delay</div>
            <div className="p-2 bg-brand-red/10 text-brand-red rounded-lg"><AlertTriangle size={16} /></div>
          </div>
          <div className="text-3xl font-black mb-1.5 text-brand-red">{globalArrival.avgDelay} hrs</div>
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red" />
            <span>Average delay among {globalArrival.late} late stops</span>
          </div>
          <div className="absolute -right-5 -bottom-5 opacity-5 pointer-events-none text-brand-red">
            <AlertTriangle size={90} />
          </div>
        </div>

        {/* Avg Facility Dwell */}
        <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Stop Dwell Time</div>
            <div className="p-2 bg-brand-yellow/10 text-brand-yellow rounded-lg"><Building size={16} /></div>
          </div>
          <div className="text-3xl font-black mb-1.5 text-brand-yellow">
            {(globalDwell.avg_dwell_mins / 60).toFixed(1)} hrs
          </div>
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
            <span>{globalDwell.detention_risk}% of stops exceeded 2-hr free time</span>
          </div>
          <div className="absolute -right-5 -bottom-5 opacity-5 pointer-events-none text-brand-yellow">
            <Building size={90} />
          </div>
        </div>

      </div>

      {/* 2. Heatmaps & Progression Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Hourly Heatmap Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 bg-brand-red rounded-full" />
              <div>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hourly Delay Analysis</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Average delay by planned appointment hour</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-muted/30 border border-border rounded-lg px-2 py-1">
              <Sparkles size={11} className="text-brand-yellow" />
              <span>Identifies hour bottlenecks</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedHourlyDelays} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-red)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--brand-red)" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis 
                  dataKey="label" 
                  stroke="var(--muted-foreground)" 
                  fontSize={9} 
                  fontWeight={700}
                  tickLine={false} 
                  axisLine={false}
                  interval={2} 
                />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={9} 
                  fontWeight={700}
                  tickLine={false} 
                  axisLine={false} 
                  unit="h"
                />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                  {...customTooltipStyle}
                  formatter={(value: any) => [`${value} hours`, 'Avg Delay']}
                  labelFormatter={(label) => `Appt Hour: ${label}`}
                />
                <Bar 
                  dataKey="avgDelay" 
                  fill="url(#hourlyGradient)" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekday Progression Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-1 h-5 bg-brand-blue rounded-full" />
              <div>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Weekday Transit Trends</h3>
                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Average schedule deviation by day of planned arrival</p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={globalWeekdayDelays} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="weekdayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-blue)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--brand-blue)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis 
                  dataKey="day" 
                  stroke="var(--muted-foreground)" 
                  fontSize={9} 
                  fontWeight={700}
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val.substring(0, 3)}
                />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={9} 
                  fontWeight={700}
                  tickLine={false} 
                  axisLine={false} 
                  unit="h"
                />
                <Tooltip 
                  {...customTooltipStyle}
                  formatter={(value: any) => [`${value} hours`, 'Avg Delay']}
                />
                <Area 
                  type="monotone" 
                  dataKey="avgDelay" 
                  stroke="var(--brand-blue)" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#weekdayGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Carrier & Lane Schedule Deviation Audit Tables */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
        
        {/* Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-border/60 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex p-0.5 bg-muted rounded-xl border border-border/60">
              <button
                onClick={() => {
                  setActiveAuditTab('carriers');
                  setSortField('loads');
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  activeAuditTab === 'carriers'
                    ? "bg-card text-brand-green shadow-xs border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Truck size={13} />
                <span>Carriers Audit</span>
              </button>
              <button
                onClick={() => {
                  setActiveAuditTab('lanes');
                  setSortField('loads');
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  activeAuditTab === 'lanes'
                    ? "bg-card text-brand-green shadow-xs border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MapPin size={13} />
                <span>Lanes Audit</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeAuditTab === 'carriers' ? "Search carrier..." : "Search lane cities/customers..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-semibold focus:outline-hidden focus:border-brand-green transition-all"
            />
          </div>
        </div>

        {/* Audit Tables */}
        <div className="overflow-x-auto">
          {activeAuditTab === 'carriers' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[9px] font-black uppercase text-muted-foreground tracking-wider select-none">
                  <th className="pb-3 pl-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Carrier Name</span>
                      {renderTooltip('The name of the carrier company', 'left')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('loads')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Loads</span>
                      {renderSortArrow('loads')}
                      {renderTooltip('Total shipment volume hauled by this carrier', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('ota_percent')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>On-Time Arrival (OTA)</span>
                      {renderSortArrow('ota_percent')}
                      {renderTooltip('On-Time Arrival rate (percentage of check-ins within planned window)', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('avg_arr_delay')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Avg Check-In Delay</span>
                      {renderSortArrow('avg_arr_delay')}
                      {renderTooltip('Average check-in delay (in hours) among late arrivals', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('otd_percent')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>On-Time Delivery (OTD)</span>
                      {renderSortArrow('otd_percent')}
                      {renderTooltip('On-Time Delivery rate (percentage of completions within planned window)', 'right')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs font-semibold">
                {filteredCarriers.length > 0 ? (
                  filteredCarriers.map((c, i) => (
                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-foreground">{c.name}</td>
                      <td className="py-3.5 text-center tabular-nums">{c.loads}</td>
                      
                      {/* OTA progress and percent */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "font-black tabular-nums",
                            c.ota_percent >= 95 ? "text-brand-green" : c.ota_percent < 90 ? "text-brand-red" : "text-brand-yellow"
                          )}>
                            {c.ota_percent}%
                          </span>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn(
                              "h-full rounded-full",
                              c.ota_percent >= 95 ? "bg-brand-green" : c.ota_percent < 90 ? "bg-brand-red" : "bg-brand-yellow"
                            )} style={{ width: `${c.ota_percent}%` }} />
                          </div>
                        </div>
                      </td>
                      
                      {/* Avg Arrival Delay */}
                      <td className={cn(
                        "py-3.5 text-center tabular-nums font-black",
                        c.avg_arr_delay > 4 ? "text-brand-red" : c.avg_arr_delay > 1.5 ? "text-brand-yellow" : "text-muted-foreground"
                      )}>
                        {c.avg_arr_delay > 0 ? `${c.avg_arr_delay.toFixed(1)} hrs` : '0.0 hrs'}
                      </td>

                      {/* OTD progress and percent */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "font-black tabular-nums",
                            c.otd_percent >= 95 ? "text-brand-green" : c.otd_percent < 90 ? "text-brand-red" : "text-brand-yellow"
                          )}>
                            {c.otd_percent}%
                          </span>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn(
                              "h-full rounded-full",
                              c.otd_percent >= 95 ? "bg-brand-green" : c.otd_percent < 90 ? "bg-brand-red" : "bg-brand-yellow"
                            )} style={{ width: `${c.otd_percent}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground font-medium">
                      No carriers matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[9px] font-black uppercase text-muted-foreground tracking-wider select-none">
                  <th className="pb-3 pl-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>Lane Route</span>
                      {renderTooltip('The shipping lane route from pickup location to delivery receiver', 'left')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('loads')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Loads</span>
                      {renderSortArrow('loads')}
                      {renderTooltip('Total shipment volume hauled along this lane', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('ota_percent')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>On-Time Arrival (OTA)</span>
                      {renderSortArrow('ota_percent')}
                      {renderTooltip('On-Time Arrival rate (percentage of check-ins within planned window)', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('avg_arr_delay')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Avg Check-In Delay</span>
                      {renderSortArrow('avg_arr_delay')}
                      {renderTooltip('Average check-in delay (in hours) among late arrivals', 'center')}
                    </div>
                  </th>
                  <th className="pb-3 text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('otd_percent')}>
                    <div className="flex items-center justify-center gap-1">
                      <span>On-Time Delivery (OTD)</span>
                      {renderSortArrow('otd_percent')}
                      {renderTooltip('On-Time Delivery rate (percentage of completions within planned window)', 'right')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs font-semibold">
                {filteredLanes.length > 0 ? (
                  filteredLanes.map((l, i) => (
                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 pl-2 max-w-[320px]">
                        <div className="font-bold text-foreground truncate">{l.shipper} ➔ {l.receiver}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {l.shipperCity} to {l.receiverCity}
                        </div>
                      </td>
                      <td className="py-3.5 text-center tabular-nums">{Math.round(l.loads * 10) / 10}</td>
                      
                      {/* OTA progress and percent */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "font-black tabular-nums",
                            l.ota_percent >= 95 ? "text-brand-green" : l.ota_percent < 90 ? "text-brand-red" : "text-brand-yellow"
                          )}>
                            {l.ota_percent}%
                          </span>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn(
                              "h-full rounded-full",
                              l.ota_percent >= 95 ? "bg-brand-green" : l.ota_percent < 90 ? "bg-brand-red" : "bg-brand-yellow"
                            )} style={{ width: `${l.ota_percent}%` }} />
                          </div>
                        </div>
                      </td>
                      
                      {/* Avg Arrival Delay */}
                      <td className={cn(
                        "py-3.5 text-center tabular-nums font-black",
                        l.avg_arr_delay > 4 ? "text-brand-red" : l.avg_arr_delay > 1.5 ? "text-brand-yellow" : "text-muted-foreground"
                      )}>
                        {l.avg_arr_delay > 0 ? `${l.avg_arr_delay.toFixed(1)} hrs` : '0.0 hrs'}
                      </td>

                      {/* OTD progress and percent */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn(
                            "font-black tabular-nums",
                            l.otd_percent >= 95 ? "text-brand-green" : l.otd_percent < 90 ? "text-brand-red" : "text-brand-yellow"
                          )}>
                            {l.otd_percent}%
                          </span>
                          <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                            <div className={cn(
                              "h-full rounded-full",
                              l.otd_percent >= 95 ? "bg-brand-green" : l.otd_percent < 90 ? "bg-brand-red" : "bg-brand-yellow"
                            )} style={{ width: `${l.otd_percent}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground font-medium">
                      No lanes matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
