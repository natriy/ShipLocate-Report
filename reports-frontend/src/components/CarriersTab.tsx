import React, { useState, useMemo } from 'react';
import { cn, exportToCSV } from '@/lib/utils';
import { Search, X, Truck, Package, DollarSign, Activity, MapPin, Users, CheckCircle, Plus, Minus, Clock, Info, Download } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import mapData from '../assets/usa-canada-map.json';

interface CarriersTabProps {
  carriers: any[];
  loads_raw: any[];
  isDark?: boolean;
  currency?: string;
}

const formatCurrency = (val: number | null) => val != null ? `$${val.toLocaleString()}` : '—';
const formatNumber = (val: number) => val.toLocaleString();

const SH = "text-[10px] uppercase tracking-wider font-black text-muted-foreground";
const TH = `cursor-pointer px-5 py-3 ${SH} hover:text-brand-slate transition-colors select-none`;

type SortKey = 'name' | 'loads' | 'single' | 'multi' | 'stops' | 'customer_count' | 'otd_percent' | 'otd_avg_delay' | 'performance_score';

export default function CarriersTab({ carriers, loads_raw, isDark = false, currency = 'USD' }: CarriersTabProps) {
  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return currency === 'CAD' ? `C$${val.toLocaleString()}` : `$${val.toLocaleString()}`;
  };

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('loads');
  const [sortDesc, setSortDesc] = useState(true);

  const stateNames = useMemo(() => {
    const map: Record<string, string> = {};
    mapData.forEach((s: any) => {
      map[s.code] = s.name;
    });
    return map;
  }, []);
  const [selectedCarrierName, setSelectedCarrierName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'zones' | 'customers' | 'loads'>('zones');
  const [zonesPage, setZonesPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);
  const [loadsPage, setLoadsPage] = useState(1);
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 25;

  const toggleClientExpanded = (clientName: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientName)) {
        next.delete(clientName);
      } else {
        next.add(clientName);
      }
      return next;
    });
  };

  const toggleZoneExpanded = (stateName: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(stateName)) {
        next.delete(stateName);
      } else {
        next.add(stateName);
      }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const renderSortArrow = (key: string) => {
    if (sortKey !== key) return null;
    return (
      <span className="text-[8px] text-brand-slate font-semibold ml-0.5">
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

  const filteredAndSorted = useMemo(() => {
    return carriers
      .filter(c => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortKey], valB = b[sortKey];
        if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = (valB || '').toLowerCase(); }
        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
  }, [carriers, search, sortKey, sortDesc]);

  const selectedCarrier = useMemo(() => carriers.find(c => c.name === selectedCarrierName), [carriers, selectedCarrierName]);

  // Aggregate stop counts by state for the selected carrier (used by detail map)
  const stateLoadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (selectedCarrierName) {
      loads_raw.forEach(l => {
        if (l.carrier === selectedCarrierName) {
          (l.customers || []).forEach((c: any) => {
            if (c.state) counts[c.state] = (counts[c.state] || 0) + 1;
          });
        }
      });
    }
    return counts;
  }, [selectedCarrierName, loads_raw]);

  const carrierZones = useMemo(() => {
    if (!selectedCarrierName) return [];
    const stateMap: Record<string, { state: string; stops: number; cities: Record<string, { name: string; stops: number }> }> = {};
    
    loads_raw.forEach(l => {
      if (l.carrier === selectedCarrierName) {
        (l.customers || []).forEach((c: any) => {
          const stateCode = c.state;
          if (!stateCode) return;
          
          if (!stateMap[stateCode]) {
            stateMap[stateCode] = {
              state: stateCode,
              stops: 0,
              cities: {}
            };
          }
          
          const sm = stateMap[stateCode];
          sm.stops++;
          
          const cityStr = c.city || 'Unknown';
          if (!sm.cities[cityStr]) {
            sm.cities[cityStr] = {
              name: cityStr,
              stops: 0
            };
          }
          
          const cm = sm.cities[cityStr];
          cm.stops++;
        });
      }
    });
    
    return Object.values(stateMap)
      .map((item) => {
        const stateFullName = stateNames[item.state] || item.state;
        const citiesList = Object.values(item.cities).map((city) => ({
          name: `${city.name}, ${item.state}`,
          loads: city.stops
        })).sort((a, b) => b.loads - a.loads);
        
        return {
          state: stateFullName,
          stateCode: item.state,
          loads: item.stops,
          cities: citiesList
        };
      })
      .sort((a, b) => b.loads - a.loads);
  }, [loads_raw, selectedCarrierName, stateNames]);

  const carrierCustomers = useMemo(() => {
    if (!selectedCarrier) return [];
    const totalStops = Object.values(selectedCarrier.customers || {}).reduce((s: number, data: any) => s + (data.loads || 0), 0);
    return Object.entries(selectedCarrier.customers || {}).map(([name, data]: [string, any]) => {
      const stops = data.loads;
      const zones = Object.entries(data.locations || {}).map(([locName, locData]: [string, any]) => ({
        name: locName,
        stops: locData.stops,
        single: locData.single || 0,
        multi: locData.multi || 0,
        percentage: stops > 0 ? Math.round((locData.stops / stops) * 100) : 0
      })).sort((a, b) => b.stops - a.stops);
      return {
        name,
        stops,
        single: data.single || 0,
        multi: data.multi || 0,
        percentage: totalStops > 0 ? Math.round((stops / totalStops) * 100) : 0,
        zones
      };
    }).sort((a, b) => b.stops - a.stops);
  }, [selectedCarrier]);

  const { customersTotalTL, customersTotalLTL, customersTotalStops } = useMemo(() => {
    return carrierCustomers.reduce((acc, c) => {
      acc.customersTotalTL += c.single;
      acc.customersTotalLTL += c.multi;
      acc.customersTotalStops += c.stops;
      return acc;
    }, { customersTotalTL: 0, customersTotalLTL: 0, customersTotalStops: 0 });
  }, [carrierCustomers]);



  const carrierLoads = useMemo(() => {
    if (!selectedCarrierName) return [];
    return loads_raw
      .filter(l => l.carrier === selectedCarrierName)
      .map(l => {
        const states = Array.from(new Set((l.customers || []).map((c: any) => c.state))).join(', ');
        return { ...l, state: states || 'Unknown' };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [loads_raw, selectedCarrierName]);

  const zonesTotalDrops = useMemo(() => {
    return carrierZones.reduce((sum, s) => sum + s.loads, 0);
  }, [carrierZones]);

  const totalZonesPages = Math.ceil(carrierZones.length / ITEMS_PER_PAGE);
  const currentZones = carrierZones.slice((zonesPage - 1) * ITEMS_PER_PAGE, zonesPage * ITEMS_PER_PAGE);

  const totalClientsPages = Math.ceil(carrierCustomers.length / ITEMS_PER_PAGE);
  const currentClients = carrierCustomers.slice((clientsPage - 1) * ITEMS_PER_PAGE, clientsPage * ITEMS_PER_PAGE);

  const totalLoadsPages = Math.ceil(carrierLoads.length / ITEMS_PER_PAGE);
  const currentLoadsList = carrierLoads.slice((loadsPage - 1) * ITEMS_PER_PAGE, loadsPage * ITEMS_PER_PAGE);

  React.useEffect(() => {
    setZonesPage(1);
    setClientsPage(1);
    setLoadsPage(1);
    setExpandedClients(new Set());
    setExpandedZones(new Set());
  }, [selectedCarrierName]);

  const badge = (type: string) => cn(
    "px-1.5 py-0.5 rounded text-[9px] font-black inline-block min-w-[28px] text-center",
    type === 'LTL' ? "bg-brand-yellow/10 text-brand-yellow" : "bg-brand-green/10 text-brand-green"
  );

  const detailBtnCls = (tab: string) => cn(
    "pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer",
    detailTab === tab ? "border-brand-slate text-brand-slate" : "border-transparent text-muted-foreground hover:text-foreground"
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── HEADER & CONTROLS (Single premium compact row) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-black text-foreground tracking-tight">Carrier Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluating carrier capacity, volume allocation, on-time performance (OTD), and route efficiency
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search carrier..."
              className="w-full bg-secondary border border-border rounded-full py-1.5 pl-9 pr-4 text-xs outline-none focus:border-brand-slate focus:ring-1 focus:ring-brand-slate/20 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Export Button */}
          <button
            onClick={() => {
              const headers = ['Carrier Name', 'Loads', 'OTD %', 'Avg OTD Delay (h)', 'Performance Score', 'TL (Single) Loads', 'LTL (Multi) Loads', 'Stops Count', 'Distinct Customers'];
              const keys = ['name', 'loads', 'otd_percent', 'otd_avg_delay', 'performance_score', 'single', 'multi', 'stops', 'customer_count'];
              exportToCSV(filteredAndSorted, headers, keys, 'carriers_report');
            }}
            className="flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs select-none shrink-0"
            title="Download carriers scorecard report as CSV"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">

        {/* LEFT: TABLE */}
        <div className={cn("space-y-4 transition-all duration-500", selectedCarrierName ? "w-full lg:w-1/2" : "w-full")}>

        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th onClick={() => handleSort('name')} className={`${TH} text-left`}>
                    <div className="flex items-center gap-1">
                      <span>Carrier</span>
                      {renderSortArrow('name')}
                      {renderTooltip('The name of the carrier company', 'left')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('loads')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Loads</span>
                      {renderSortArrow('loads')}
                      {renderTooltip('Total loads transported by this carrier', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('performance_score')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Score</span>
                      {renderSortArrow('performance_score')}
                      {renderTooltip('Combined performance score (60% OTD + 40% OTA)', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('otd_percent')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>OTD %</span>
                      {renderSortArrow('otd_percent')}
                      {renderTooltip('On-Time Delivery rate (percentage of visits within planned window)', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('otd_avg_delay')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Avg Delay</span>
                      {renderSortArrow('otd_avg_delay')}
                      {renderTooltip('Average delivery delay (in hours) among late shipments', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('single')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>TL</span>
                      {renderSortArrow('single')}
                      {renderTooltip('Volume of Full Truckload (TL) shipments hauled', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('multi')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>LTL</span>
                      {renderSortArrow('multi')}
                      {renderTooltip('Volume of Less-Than-Truckload (LTL) shipments hauled', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('stops')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Drops</span>
                      {renderSortArrow('stops')}
                      {renderTooltip('Total count of absolute physical delivery stops', 'right')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('customer_count')} className={`${TH} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Customers</span>
                      {renderSortArrow('customer_count')}
                      {renderTooltip('Total count of distinct client facilities visited', 'right')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSorted.map((row, idx) => {
                  const totalForRow = row.single + row.multi || 1;
                  const ltlPct = Math.round((row.multi / totalForRow) * 100);
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedCarrierName(row.name === selectedCarrierName ? null : row.name)}
                      className={cn(
                        "hover:bg-muted/30 transition-colors group cursor-pointer",
                        selectedCarrierName === row.name ? "bg-brand-slate/5 border-l-2 border-l-brand-slate" : ""
                      )}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold group-hover:text-brand-slate transition-colors truncate max-w-[180px]" title={row.name}>{row.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{row.top_zone || 'Unknown zone'}</div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-black text-brand-navy">{formatNumber(row.loads)}</td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        <span className={cn(
                          "font-black text-xs px-2 py-0.5 rounded-full inline-block min-w-[32px] text-center",
                          row.performance_score >= 85
                            ? "bg-emerald-500/15 text-emerald-500"
                            : row.performance_score >= 70
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-rose-500/15 text-rose-500"
                        )}>
                          {row.performance_score}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {row.otd_eligible > 0 ? (
                          <span className={cn(
                            "font-extrabold",
                            row.otd_percent >= 90 ? "text-emerald-500" : row.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                          )}>
                            {row.otd_percent}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 font-normal">No data</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {row.otd_eligible > 0 && row.otd_avg_delay > 0 ? (
                          <span className="font-bold text-muted-foreground">
                            {row.otd_avg_delay}h
                          </span>
                        ) : row.otd_eligible > 0 ? (
                          <span className="text-emerald-500 font-bold">0.0h</span>
                        ) : (
                          <span className="text-muted-foreground/60 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-green">{row.single > 0 ? formatNumber(row.single) : <span className="text-muted-foreground font-normal">—</span>}</td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {row.multi > 0 ? (
                          <span className="font-bold text-brand-yellow">
                            {formatNumber(row.multi)}
                            <span className="ml-1 text-[10px] text-muted-foreground font-normal">({ltlPct}%)</span>
                          </span>
                        ) : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-blue">{formatNumber(row.stops || 0)}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold text-muted-foreground">{row.customer_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT: DETAIL PANEL */}
      {selectedCarrier && (
        <div className="w-full lg:w-1/2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300 flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex justify-between items-start bg-muted/20">
            <div>
              <div className="text-[10px] font-black text-brand-slate uppercase tracking-widest mb-1">Carrier Profile</div>
              <h2 className="text-lg font-black tracking-tight pr-8 line-clamp-1">{selectedCarrier.name}</h2>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <CheckCircle size={11} className="text-brand-green" /> Preferred Carrier
              </div>
            </div>
            <button onClick={() => setSelectedCarrierName(null)} className="p-1.5 hover:bg-muted rounded-lg transition-colors mt-0.5">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <DetailCard icon={<Package size={13} className="text-brand-navy"/>} label="Total Truck Loads" value={formatNumber(selectedCarrier.loads)} color="text-brand-navy" />
              <DetailCard icon={<MapPin size={13} className="text-brand-green"/>} label="TL (Single)" value={formatNumber(selectedCarrier.single)} color="text-brand-green" />
              <DetailCard icon={<MapPin size={13} className="text-brand-yellow"/>} label="LTL (Multi-Stop)" value={formatNumber(selectedCarrier.multi)} color="text-brand-yellow" />
              <DetailCard icon={<MapPin size={13} className="text-brand-blue"/>} label="Total Delivery Drops" value={formatNumber(selectedCarrier.stops || 0)} color="text-brand-blue" />
              <DetailCard icon={<MapPin size={13}/>} label="Zones" value={carrierZones.length} color="text-brand-slate" />
              <DetailCard icon={<Users size={13}/>} label="Customers" value={selectedCarrier.customer_count} color="text-brand-slate" />
              <DetailCard
                icon={<Activity size={13} className={cn(
                  selectedCarrier.otd_percent >= 90 ? "text-emerald-500" : selectedCarrier.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                )}/>}
                label="OTD Rate"
                value={`${selectedCarrier.otd_percent}%`}
                color={cn(
                  "font-extrabold",
                  selectedCarrier.otd_percent >= 90 ? "text-emerald-500" : selectedCarrier.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                )}
              />
              <DetailCard icon={<Clock size={13} className="text-slate-500" />} label="Avg Delay" value={selectedCarrier.otd_avg_delay > 0 ? `${selectedCarrier.otd_avg_delay} hrs` : '0.0 hrs'} color="text-slate-600" />
            </div>

            {/* OTD Delay Distribution */}
            {selectedCarrier.otd_eligible > 0 ? (
              <div className="bg-muted/30 border border-border/85 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold uppercase text-[9px] tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity size={12} className="text-emerald-500" /> OTD Delay Distribution
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {selectedCarrier.otd_eligible} stops tracked
                  </span>
                </div>
                
                {/* Horizontal Distribution Bar */}
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(selectedCarrier.otd_ontime / selectedCarrier.otd_eligible) * 100}%` }}
                    title={`On-Time: ${selectedCarrier.otd_ontime} stops`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${(selectedCarrier.otd_late_only / selectedCarrier.otd_eligible) * 100}%` }}
                    title={`Late (2-4h): ${selectedCarrier.otd_late_only} stops`}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${(selectedCarrier.otd_severe_late / selectedCarrier.otd_eligible) * 100}%` }}
                    title={`Severely Late (>4h): ${selectedCarrier.otd_severe_late} stops`}
                  />
                </div>

                {/* Legend with counts & percentages */}
                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center">
                  <div className="flex flex-col items-center p-1.5 bg-card/40 border border-border/50 rounded-lg">
                    <span className="text-emerald-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> On-Time
                    </span>
                    <span className="text-xs font-black mt-1 text-foreground">
                      {selectedCarrier.otd_ontime} <span className="text-[9px] text-muted-foreground font-normal">({Math.round((selectedCarrier.otd_ontime / selectedCarrier.otd_eligible) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-card/40 border border-border/50 rounded-lg">
                    <span className="text-amber-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Late (2-4h)
                    </span>
                    <span className="text-xs font-black mt-1 text-foreground">
                      {selectedCarrier.otd_late_only} <span className="text-[9px] text-muted-foreground font-normal">({Math.round((selectedCarrier.otd_late_only / selectedCarrier.otd_eligible) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-card/40 border border-border/50 rounded-lg">
                    <span className="text-rose-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Severe (&gt;4h)
                    </span>
                    <span className="text-xs font-black mt-1 text-foreground">
                      {selectedCarrier.otd_severe_late} <span className="text-[9px] text-muted-foreground font-normal">({Math.round((selectedCarrier.otd_severe_late / selectedCarrier.otd_eligible) * 100)}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Detail Tabs */}
            <div className="space-y-3 flex flex-col">
              <div className="flex gap-4 border-b border-border">
                <button onClick={() => setDetailTab('zones')} className={detailBtnCls('zones')}>📍 Zones ({carrierZones.length})</button>
                <button onClick={() => setDetailTab('customers')} className={detailBtnCls('customers')}>🏢 Customers ({carrierCustomers.length})</button>
                <button onClick={() => setDetailTab('loads')} className={detailBtnCls('loads')}>📦 History ({carrierLoads.length})</button>
              </div>

              <div className="pr-1">
                {detailTab === 'zones' && (
                  <div className="animate-in fade-in duration-200 space-y-3">
                    <InteractiveMap
                      stateCounts={stateLoadCounts}
                      selectedState={highlightedZone}
                      onStateClick={(s) => setHighlightedZone(prev => prev === s ? null : s)}
                      isDark={isDark}
                      label="Drops"
                      autoFocus={true}
                    />
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card border-b border-border z-10">
                        <tr>
                          <th className={`text-left py-2.5 ${SH}`}>Zone</th>
                          <th className={`text-right py-2.5 w-16 ${SH}`}>Drops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {currentZones.map((s: any, i) => {
                          const isExpanded = expandedZones.has(s.state);
                          return (
                            <React.Fragment key={s.state}>
                              <tr
                                className={cn(
                                  "transition-colors cursor-pointer",
                                  highlightedZone === s.stateCode
                                    ? "bg-brand-slate/10 text-brand-slate"
                                    : "hover:bg-muted/20"
                                )}
                                onClick={() => setHighlightedZone(prev => prev === s.stateCode ? null : s.stateCode)}
                              >
                                <td className="py-2 font-semibold">
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => toggleZoneExpanded(s.state)}
                                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                                      title={isExpanded ? "Collapse" : "Expand zones"}
                                    >
                                      {isExpanded ? (
                                        <Minus size={10} className="stroke-[3]" />
                                      ) : (
                                        <Plus size={10} className="stroke-[3]" />
                                      )}
                                    </button>
                                    <span className="truncate max-w-[150px] font-bold" title={s.state}>{s.state}</span>
                                  </div>
                                </td>
                                <td className="py-2 text-right tabular-nums font-black text-brand-blue">{s.loads}</td>
                              </tr>
                              {isExpanded && s.cities && s.cities.length > 0 && (
                                s.cities.map((city: any, idx: number) => (
                                  <tr key={`city-${idx}`} className="bg-muted/5 dark:bg-muted/5 hover:bg-muted/10 transition-colors">
                                    <td className="py-1.5 font-medium text-muted-foreground pl-8">
                                      <div className="border-l border-brand-slate/30 pl-2.5 py-0.5 truncate max-w-[170px]" title={city.name}>
                                        {city.name}
                                      </div>
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums font-bold text-brand-blue">{city.loads}</td>
                                  </tr>
                                ))
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      {carrierZones.length > 0 && (
                        <tfoot className="border-t border-border bg-muted/5 font-bold">
                          <tr>
                            <td className="py-2.5 pl-7 font-black text-foreground">Total</td>
                            <td className="py-2.5 text-right tabular-nums text-brand-blue font-black pr-1">{zonesTotalDrops}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    <Pagination
                      currentPage={zonesPage}
                      totalPages={totalZonesPages}
                      onPageChange={setZonesPage}
                    />
                  </div>
                )}

                 {detailTab === 'customers' && (
                  <div className="flex flex-col animate-in fade-in duration-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card border-b border-border z-10">
                        <tr>
                          <th className={`text-left py-2.5 ${SH}`}>Customer</th>
                          <th className={`text-center py-2.5 w-14 ${SH}`}>TL</th>
                          <th className={`text-center py-2.5 w-14 ${SH}`}>LTL</th>
                          <th className={`text-right py-2.5 w-16 ${SH}`}>Stops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {currentClients.map((c: any, i) => {
                          const isExpanded = expandedClients.has(c.name);
                          return (
                            <React.Fragment key={c.name}>
                              <tr className="hover:bg-muted/20 transition-colors">
                                <td className="py-2 font-semibold">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => toggleClientExpanded(c.name)}
                                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                                      title={isExpanded ? "Collapse" : "Expand zones"}
                                    >
                                      {isExpanded ? (
                                        <Minus size={10} className="stroke-[3]" />
                                      ) : (
                                        <Plus size={10} className="stroke-[3]" />
                                      )}
                                    </button>
                                    <span className="truncate max-w-[140px]" title={c.name}>{c.name}</span>
                                  </div>
                                </td>
                                <td className="py-2 text-center tabular-nums font-semibold text-brand-green">
                                  {c.single > 0 ? c.single : <span className="text-muted-foreground font-normal">—</span>}
                                </td>
                                <td className="py-2 text-center tabular-nums font-semibold text-brand-yellow">
                                  {c.multi > 0 ? c.multi : <span className="text-muted-foreground font-normal">—</span>}
                                </td>
                                <td className="py-2 text-right tabular-nums font-black text-brand-blue">{c.stops}</td>
                              </tr>
                              {isExpanded && c.zones && c.zones.length > 0 && (
                                c.zones.map((loc: any, idx: number) => (
                                  <tr key={`loc-${idx}`} className="bg-muted/5 dark:bg-muted/5 hover:bg-muted/10 transition-colors">
                                    <td className="py-1.5 font-medium text-muted-foreground pl-8">
                                      <div className="border-l border-brand-slate/30 pl-2.5 py-0.5 truncate max-w-[170px]" title={loc.name}>
                                        {loc.name}
                                      </div>
                                    </td>
                                    <td className="py-1.5 text-center tabular-nums font-semibold text-muted-foreground/40">—</td>
                                    <td className="py-1.5 text-center tabular-nums font-semibold text-muted-foreground/40">—</td>
                                    <td className="py-1.5 text-right tabular-nums font-bold text-brand-blue">{loc.stops}</td>
                                  </tr>
                                ))
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      {carrierCustomers.length > 0 && (
                        <tfoot className="border-t border-border bg-muted/5 font-bold">
                          <tr>
                            <td className="py-2.5 pl-7 font-black text-foreground">Total</td>
                            <td className="py-2.5 text-center tabular-nums text-brand-green font-black">{customersTotalTL > 0 ? customersTotalTL : <span className="text-muted-foreground/40 font-normal">—</span>}</td>
                            <td className="py-2.5 text-center tabular-nums text-brand-yellow font-black">{customersTotalLTL > 0 ? customersTotalLTL : <span className="text-muted-foreground/40 font-normal">—</span>}</td>
                            <td className="py-2.5 text-right tabular-nums text-brand-blue font-black pr-1">{customersTotalStops}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    <Pagination
                      currentPage={clientsPage}
                      totalPages={totalClientsPages}
                      onPageChange={setClientsPage}
                    />
                  </div>
                )}

                {detailTab === 'loads' && (
                  <div className="flex flex-col animate-in fade-in duration-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card border-b border-border z-10">
                        <tr>
                          <th className={`text-left py-2.5 px-1 ${SH}`}>Load #</th>
                          <th className={`text-left py-2.5 px-1 ${SH}`}>Date</th>
                          <th className={`text-center py-2.5 px-1 ${SH}`}>Type</th>
                          <th className={`text-left py-2.5 px-1 ${SH}`}>State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {currentLoadsList.map((l, i) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-1 font-bold">{l.uniqueid || 'N/A'}</td>
                            <td className="py-2.5 px-1 text-muted-foreground whitespace-nowrap">{l.date}</td>
                            <td className="py-2.5 px-1 text-center"><span className={badge(l.trip_type)}>{l.trip_type === 'LTL' ? 'LTL' : 'TL'}</span></td>
                            <td className="py-2.5 px-1 text-muted-foreground font-semibold">{l.state}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      currentPage={loadsPage}
                      totalPages={totalLoadsPages}
                      onPageChange={setLoadsPage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function DetailCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color?: string }) {
  return (
    <div className="bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted/60 transition-colors">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-[9px] uppercase font-black tracking-wider">{label}</span>
      </div>
      <div className={cn("text-xs font-black truncate", color || "text-foreground")}>{value}</div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-muted-foreground">
      <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="px-2 py-1 hover:text-brand-slate disabled:opacity-30 cursor-pointer">«</button>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-2 py-1 hover:text-brand-slate disabled:opacity-30 cursor-pointer">‹</button>
      <span className="text-foreground">{currentPage} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-2 py-1 hover:text-brand-slate disabled:opacity-30 cursor-pointer">›</button>
      <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 hover:text-brand-slate disabled:opacity-30 cursor-pointer">»</button>
    </div>
  );
}
