import React, { useState, useMemo } from 'react';
import { cn, exportToCSV } from '@/lib/utils';
import { Search, X, Package, Activity, MapPin, Map, Filter, Plus, Minus, ArrowDownToLine, ArrowUpFromLine, Clock, Copy, Check, Info, Truck, Download } from 'lucide-react';
import InteractiveMap from './InteractiveMap';
import mapData from '../assets/usa-canada-map.json';

interface LocationTabProps {
  customers: any[];   // Delivery receivers (куда везли)
  shippers: any[];    // Pickup origins (откуда везли)
  loads_raw: any[];
  isDark?: boolean;
}

const formatNumber = (val: number) => val.toLocaleString();
const round1d = (val: number) => Math.round(val * 10) / 10;

type ViewMode = 'deliveries' | 'pickups';
type SortKey = 'name' | 'zone' | 'loads' | 'tl' | 'ltl' | 'drops' | 'otd_percent' | 'otd_avg_delay' | 'avg_dwell_mins' | 'detention_risk';

const SH = "text-[10px] uppercase tracking-wider font-black text-muted-foreground";
const TH = `cursor-pointer px-5 py-3 ${SH} hover:text-brand-blue transition-colors select-none`;

function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-muted/40 border border-border rounded-xl p-3 hover:bg-muted/60 transition-colors">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-[9px] uppercase font-black tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-black text-foreground truncate">{value}</div>
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

export default function LocationTab({ customers, shippers, loads_raw, isDark = false }: LocationTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('deliveries');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('loads');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'carriers' | 'zones' | 'loads'>('carriers');
  const [carriersPage, setCarriersPage] = useState(1);
  const [zonesPage, setZonesPage] = useState(1);
  const [loadsPage, setLoadsPage] = useState(1);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 1500);
  };

  const [pointsSearch, setPointsSearch] = useState('');
  const [pointsSortKey, setPointsSortKey] = useState<string>('loads');
  const [pointsSortDesc, setPointsSortDesc] = useState(true);

  const [carriersSearch, setCarriersSearch] = useState('');
  const [carriersSortKey, setCarriersSortKey] = useState<string>('loads');
  const [carriersSortDesc, setCarriersSortDesc] = useState(true);

  const [loadsSearch, setLoadsSearch] = useState('');
  const [loadsSortKey, setLoadsSortKey] = useState<string>('departure_date');
  const [loadsSortDesc, setLoadsSortDesc] = useState(true);

  const handlePointsSort = (key: string) => {
    if (pointsSortKey === key) setPointsSortDesc(!pointsSortDesc);
    else { setPointsSortKey(key); setPointsSortDesc(true); }
    setZonesPage(1);
  };

  const handleCarriersSort = (key: string) => {
    if (carriersSortKey === key) setCarriersSortDesc(!carriersSortDesc);
    else { setCarriersSortKey(key); setCarriersSortDesc(true); }
    setCarriersPage(1);
  };

  const handleLoadsSort = (key: string) => {
    if (loadsSortKey === key) setLoadsSortDesc(!loadsSortDesc);
    else { setLoadsSortKey(key); setLoadsSortDesc(true); }
    setLoadsPage(1);
  };

  const renderSortArrow = (key: string, tabOrIsPoints: 'points' | 'carriers' | 'loads' | 'main' | boolean = 'points') => {
    let tab: 'points' | 'carriers' | 'loads' | 'main' = 'points';
    if (typeof tabOrIsPoints === 'boolean') {
      tab = tabOrIsPoints ? 'points' : 'carriers';
    } else {
      tab = tabOrIsPoints;
    }

    const activeKey = tab === 'points' 
      ? pointsSortKey 
      : tab === 'carriers' 
        ? carriersSortKey 
        : tab === 'loads' 
          ? loadsSortKey 
          : sortKey;
    const activeDesc = tab === 'points' 
      ? pointsSortDesc 
      : tab === 'carriers' 
        ? carriersSortDesc 
        : tab === 'loads' 
          ? loadsSortDesc 
          : sortDesc;
    if (activeKey !== key) return null;
    return (
      <span className="text-[8px] text-brand-blue font-semibold ml-0.5">
        {activeDesc ? '▼' : '▲'}
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
  const ITEMS_PER_PAGE = 25;

  const stateNames = useMemo(() => {
    const map: Record<string, string> = {};
    mapData.forEach((s: any) => { map[s.code] = s.name; });
    return map;
  }, []);

  const toggleZoneExpanded = (key: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Switch source data based on view mode
  const activeData = viewMode === 'deliveries' ? customers : shippers;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  // Reset selection when switching modes
  const handleModeSwitch = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedName(null);
    setSearch('');
    setSelectedStateFilter(null);
    setSortKey('loads');
    setSortDesc(true);
  };

  const filteredAndSorted = useMemo(() => {
    return activeData
      .filter(row => {
        const zoneStr = row.zone || '';
        if (search) {
          const q = search.toLowerCase();
          if (!row.name.toLowerCase().includes(q) && !zoneStr.toLowerCase().includes(q)) return false;
        }
        if (selectedStateFilter) {
          const locs = row.locations || {};
          if (!locs[selectedStateFilter]) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any, valB: any;
        if (sortKey === 'tl') { valA = a.tl_loads || 0; valB = b.tl_loads || 0; }
        else if (sortKey === 'ltl') { valA = a.ltl_loads || 0; valB = b.ltl_loads || 0; }
        else if (sortKey === 'drops') {
          valA = viewMode === 'deliveries' ? (a.total_drops || 0) : (a.total_pickups || 0);
          valB = viewMode === 'deliveries' ? (b.total_drops || 0) : (b.total_pickups || 0);
        }
        else if (sortKey === 'loads') {
          valA = viewMode === 'deliveries' ? (a.total_loads || 0) : (a.loads || 0);
          valB = viewMode === 'deliveries' ? (b.total_loads || 0) : (b.loads || 0);
        }
        else if (sortKey === 'otd_percent') { valA = a.otd_percent ?? 0; valB = b.otd_percent ?? 0; }
        else if (sortKey === 'otd_avg_delay') { valA = a.otd_avg_delay ?? 0; valB = b.otd_avg_delay ?? 0; }
        else if (sortKey === 'avg_dwell_mins') { valA = a.avg_dwell_mins ?? 0; valB = b.avg_dwell_mins ?? 0; }
        else if (sortKey === 'detention_risk') { valA = a.detention_risk ?? 0; valB = b.detention_risk ?? 0; }
        else { valA = a[sortKey]; valB = b[sortKey]; }
        if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = (valB || '').toLowerCase(); }
        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
  }, [activeData, search, sortKey, sortDesc, selectedStateFilter, viewMode]);

  const selected = useMemo(() => activeData.find(r => r.name === selectedName), [activeData, selectedName]);

  // Map state heat-map: for deliveries use delivery locations, for pickups use pickup locations
  const stateLoadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (selected) {
      const locs = selected.locations || {};
      Object.values(locs).forEach((loc: any) => { counts[loc.name] = loc.loads; });
    } else {
      filteredAndSorted.forEach(row => {
        const locs = row.locations || {};
        Object.values(locs).forEach((loc: any) => {
          counts[loc.name] = (counts[loc.name] || 0) + loc.loads;
        });
      });
    }
    return counts;
  }, [filteredAndSorted, selected]);

  const handleStateClick = (stateCode: string) => {
    if (selectedName) setSelectedName(null);
    setSelectedStateFilter(prev => prev === stateCode ? null : stateCode);
  };

  // ─── Detail panel data ───

  // CARRIERS sub-tab with search and sorting
  const filteredAndSortedCarriers = useMemo(() => {
    if (!selected) return [];
    let list = Object.entries(selected.carriers || {})
      .map(([name, data]: [string, any]) => ({
        name,
        loads: data.loads || 0,
        tl: data.single || data.tl || 0,
        ltl: data.multi || data.ltl || 0,
        drops: data.drops || 0,
      }));

    if (carriersSearch) {
      const q = carriersSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (carriersSortKey === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (carriersSortKey === 'tl') {
        valA = a.tl;
        valB = b.tl;
      } else if (carriersSortKey === 'ltl') {
        valA = a.ltl;
        valB = b.ltl;
      } else if (carriersSortKey === 'loads') {
        valA = a.loads;
        valB = b.loads;
      } else if (carriersSortKey === 'drops') {
        valA = a.drops;
        valB = b.drops;
      }

      if (valA < valB) return carriersSortDesc ? 1 : -1;
      if (valA > valB) return carriersSortDesc ? -1 : 1;
      return 0;
    });
  }, [selected, carriersSearch, carriersSortKey, carriersSortDesc]);

  // POINTS sub-tab (Delivery / Pickup Points) with search and sorting
  const filteredAndSortedPoints = useMemo(() => {
    if (!selected) return [];
    let list = viewMode === 'deliveries'
      ? (selected.delivery_points || [])
      : (selected.pickup_points || []);

    if (pointsSearch) {
      const q = pointsSearch.toLowerCase();
      list = list.filter((p: any) => 
        (p.address || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.state || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a: any, b: any) => {
      let valA: any = 0;
      let valB: any = 0;

      if (pointsSortKey === 'address') {
        valA = a.address || '';
        valB = b.address || '';
      } else if (pointsSortKey === 'otd_percent') {
        valA = a.otd_eligible > 0 ? (a.otd_percent ?? 0) : -1;
        valB = b.otd_eligible > 0 ? (b.otd_percent ?? 0) : -1;
      } else if (pointsSortKey === 'avg_dwell_mins') {
        valA = a.dwell_eligible > 0 ? (a.avg_dwell_mins ?? 0) : -1;
        valB = b.dwell_eligible > 0 ? (b.avg_dwell_mins ?? 0) : -1;
      } else if (pointsSortKey === 'detention_risk') {
        valA = a.dwell_eligible > 0 ? (a.detention_risk ?? 0) : -1;
        valB = b.dwell_eligible > 0 ? (b.detention_risk ?? 0) : -1;
      } else if (pointsSortKey === 'loads') {
        valA = a.loads || 0;
        valB = b.loads || 0;
      } else if (pointsSortKey === 'drops') {
        valA = viewMode === 'deliveries' ? (a.drops || 0) : (a.pickups || 0);
        valB = viewMode === 'deliveries' ? (b.drops || 0) : (b.pickups || 0);
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return pointsSortDesc ? 1 : -1;
      if (valA > valB) return pointsSortDesc ? -1 : 1;
      return 0;
    });
  }, [selected, viewMode, pointsSearch, pointsSortKey, pointsSortDesc]);

  const pointsTotalLoads = useMemo(() => filteredAndSortedPoints.reduce((s: number, p: any) => s + p.loads, 0), [filteredAndSortedPoints]);

  const pointsTotalDrops = useMemo(() => {
    return filteredAndSortedPoints.reduce((s: number, p: any) => s + (viewMode === 'deliveries' ? (p.drops || 0) : (p.pickups || 0)), 0);
  }, [filteredAndSortedPoints, viewMode]);

  // LOADS sub-tab with search and sorting
  const filteredAndSortedLoads = useMemo(() => {
    if (!selectedName) return [];
    
    let list = [];
    if (viewMode === 'deliveries') {
      list = loads_raw.filter(l => l.customers && l.customers.some((c: any) => c.name === selectedName));
    } else {
      list = loads_raw.filter(l => l.shippers && l.shippers.some((sh: any) => sh.name === selectedName));
    }

    // Map each load to its departure date and unique route states list (deliveries/customers stops only)
    const mappedList = list.map(l => {
      const allStates = (l.customers || []).map((c: any) => c.state).filter(Boolean);
      const uniqueStates = Array.from(new Set(allStates));
      return {
        ...l,
        departure_date: l.date ? l.date.split('T')[0] : 'Unknown',
        states_list: uniqueStates.join(', ') || 'Unknown'
      };
    });

    if (loadsSearch) {
      const q = loadsSearch.toLowerCase();
      return mappedList.filter(l => 
        (l.uniqueid || '').toLowerCase().includes(q) ||
        (l.states_list || '').toLowerCase().includes(q)
      );
    }

    return [...mappedList].sort((a: any, b: any) => {
      let valA: any = 0;
      let valB: any = 0;

      if (loadsSortKey === 'uniqueid') {
        valA = a.uniqueid || '';
        valB = b.uniqueid || '';
      } else if (loadsSortKey === 'departure_date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (loadsSortKey === 'trip_type') {
        valA = a.trip_type || '';
        valB = b.trip_type || '';
      } else if (loadsSortKey === 'states') {
        valA = a.states_list || '';
        valB = b.states_list || '';
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return loadsSortDesc ? 1 : -1;
      if (valA > valB) return loadsSortDesc ? -1 : 1;
      return 0;
    });
  }, [loads_raw, selectedName, viewMode, loadsSearch, loadsSortKey, loadsSortDesc]);

  const totalCarriersPages = Math.ceil(filteredAndSortedCarriers.length / ITEMS_PER_PAGE);
  const currentCarriersList = filteredAndSortedCarriers.slice((carriersPage - 1) * ITEMS_PER_PAGE, carriersPage * ITEMS_PER_PAGE);
  const totalPointsPages = Math.ceil(filteredAndSortedPoints.length / ITEMS_PER_PAGE);
  const currentPointsList = filteredAndSortedPoints.slice((zonesPage - 1) * ITEMS_PER_PAGE, zonesPage * ITEMS_PER_PAGE);
  const totalLoadsPages = Math.ceil(filteredAndSortedLoads.length / ITEMS_PER_PAGE);
  const currentLoadsList = filteredAndSortedLoads.slice((loadsPage - 1) * ITEMS_PER_PAGE, loadsPage * ITEMS_PER_PAGE);

  React.useEffect(() => {
    setCarriersPage(1); setZonesPage(1); setLoadsPage(1); setExpandedZones(new Set());
    setPointsSearch('');
    setPointsSortKey('loads');
    setPointsSortDesc(true);
    setCarriersSearch('');
    setCarriersSortKey('loads');
    setCarriersSortDesc(true);
    setLoadsSearch('');
    setLoadsSortKey('departure_date');
    setLoadsSortDesc(true);
  }, [selectedName, viewMode]);

  const badge = (type: string) => cn(
    "px-1.5 py-0.5 rounded text-[9px] font-black inline-block min-w-[28px] text-center",
    type === 'LTL' ? "bg-brand-yellow/10 text-brand-yellow" : "bg-brand-green/10 text-brand-green"
  );

  const detailBtnCls = (tab: string) => cn(
    "pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer",
    detailTab === tab ? "border-brand-blue text-brand-blue" : "border-transparent text-muted-foreground hover:text-foreground"
  );

  // Column label
  const dropColLabel = viewMode === 'deliveries' ? 'Drops' : 'Pickups';
  const dropColColor = viewMode === 'deliveries' ? 'text-brand-blue' : 'text-purple-600';
  const dropColBg = viewMode === 'deliveries' ? 'bg-brand-blue' : 'bg-purple-600';

  const mainLabel = viewMode === 'deliveries' ? 'Receiver' : 'Shipper';
  const mapLabel = viewMode === 'deliveries' ? 'Drops' : 'Pickups';
  const zonesTabLabel = viewMode === 'pickups' ? '📦 Pickup Points' : '📦 Delivery Points';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* ── HEADER & CONTROLS (Single premium compact row) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-black text-foreground tracking-tight">Location Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {viewMode === 'deliveries'
              ? 'Analyzing delivery destinations — where cargo was dropped'
              : 'Analyzing pickup origins — where cargo was loaded'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${mainLabel.toLowerCase()}...`}
              className="w-full bg-secondary border border-border rounded-full py-1.5 pl-9 pr-4 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Active state filter chip */}
          {selectedStateFilter && (
            <div className="flex items-center gap-1 bg-brand-blue/10 text-brand-blue border border-brand-blue/20 px-2.5 py-1.5 rounded-full text-xs font-bold animate-in fade-in zoom-in-95 duration-200">
              <Filter size={11} />
              <span>State: {selectedStateFilter}</span>
              <button onClick={() => setSelectedStateFilter(null)} className="hover:opacity-75 transition-opacity ml-1 cursor-pointer">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Map toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className={cn(
              "text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none",
              showMap
                ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                : "bg-secondary text-muted-foreground border-border hover:border-brand-blue hover:text-brand-blue"
            )}
          >
            <Map size={13} />
            <span>Map</span>
          </button>

          {/* Export Button */}
          <button
            onClick={() => {
              const headers = [
                viewMode === 'deliveries' ? 'Receiver (Customer) Name' : 'Shipper Name',
                'Zone/Country',
                'Loads Count',
                'OTD % (On-Time Delivery)',
                'Avg Delay (h)',
                'Avg Dwell Time (min)',
                'Detention Risk %',
                'TL (Single) Loads',
                'LTL (Multi) Loads'
              ];
              const keys = [
                'name',
                'zone',
                'loads',
                'otd_percent',
                'otd_avg_delay',
                'avg_dwell_mins',
                'detention_risk',
                'tl',
                'ltl'
              ];
              exportToCSV(filteredAndSorted, headers, keys, viewMode === 'deliveries' ? 'receivers_report' : 'shippers_report');
            }}
            className="flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer shadow-xs select-none shrink-0"
            title="Download locations report as CSV"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Segmented toggle */}
          <div className="flex items-center bg-muted border border-border rounded-xl p-0.5 gap-0.5 shadow-xs">
            <button
              onClick={() => handleModeSwitch('deliveries')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer",
                viewMode === 'deliveries'
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              <ArrowDownToLine size={13} />
              Deliveries
            </button>
            <button
              onClick={() => handleModeSwitch('pickups')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 cursor-pointer",
                viewMode === 'pickups'
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              <ArrowUpFromLine size={13} />
              Pickups
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">

        {/* LEFT: TABLE */}
        <div className={cn("space-y-4 transition-all duration-500", selectedName ? "w-full lg:w-1/2" : "w-full")}>
          {showMap && (
            <InteractiveMap
              stateCounts={stateLoadCounts}
              selectedState={selectedStateFilter}
              onStateClick={handleStateClick}
              isDark={isDark}
              label={mapLabel}
            />
          )}

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th onClick={() => handleSort('name')} className={`${TH} text-left`}>
                      <div className="flex items-center gap-1">
                        <span>{mainLabel}</span>
                        {renderSortArrow('name', 'main')}
                        {renderTooltip(`The name of the client ${mainLabel.toLowerCase()}`, 'left')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('otd_percent')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>OTD %</span>
                        {renderSortArrow('otd_percent', 'main')}
                        {renderTooltip('On-Time Delivery/Pickup rate (percentage of visits within planned window)', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('avg_dwell_mins')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Avg Dwell</span>
                        {renderSortArrow('avg_dwell_mins', 'main')}
                        {renderTooltip('Average dwell time spent at this facility (check-out minus check-in/planned)', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('detention_risk')} className={`${TH} text-right text-brand-red`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Detention Risk</span>
                        {renderSortArrow('detention_risk', 'main')}
                        {renderTooltip('Percentage of visits exceeding the 2-hour free buffer', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('tl')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>TL</span>
                        {renderSortArrow('tl', 'main')}
                        {renderTooltip('Volume of Full Truckload (TL) shipments hauled', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('ltl')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>LTL</span>
                        {renderSortArrow('ltl', 'main')}
                        {renderTooltip('Volume of Less-Than-Truckload (LTL) shipments hauled', 'center')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('loads')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Loads</span>
                        {renderSortArrow('loads', 'main')}
                        {renderTooltip('Combined volume share of all loads handled by this client', 'right')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('drops')} className={`${TH} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <span>{dropColLabel}</span>
                        {renderSortArrow('drops', 'main')}
                        {renderTooltip(`Total count of absolute physical ${dropColLabel.toLowerCase()} visits`, 'right')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredAndSorted.map((row, idx) => {
                    const totalLoads = viewMode === 'deliveries' ? round1d(row.total_loads || 0) : round1d(row.loads || 0);
                    const dropCount = viewMode === 'deliveries' ? (row.total_drops || 0) : (row.total_pickups || 0);
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedName(row.name === selectedName ? null : row.name)}
                        className={cn(
                          "hover:bg-muted/30 transition-colors group cursor-pointer",
                          selectedName === row.name ? "bg-brand-blue/5 border-l-2 border-l-brand-blue" : ""
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold group-hover:text-brand-blue transition-colors truncate max-w-[220px]" title={row.name}>{row.name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{row.zone}</div>
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
                          {row.dwell_eligible > 0 ? (
                            <span className="font-bold text-foreground">
                              {row.avg_dwell_mins < 60 ? `${row.avg_dwell_mins}m` : `${(row.avg_dwell_mins / 60).toFixed(1)}h`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums">
                          {row.dwell_eligible > 0 ? (
                            <span className={cn(
                              "font-black text-xs px-1.5 py-0.5 rounded",
                              row.detention_risk >= 30 ? "bg-rose-500/10 text-rose-500" :
                              row.detention_risk >= 10 ? "bg-amber-500/10 text-amber-500" :
                              "bg-emerald-500/10 text-emerald-500"
                            )}>
                              {row.detention_risk}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-brand-green font-bold">
                          {row.tl_loads > 0 ? round1d(row.tl_loads) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums text-brand-yellow font-bold">
                          {row.ltl_loads > 0 ? round1d(row.ltl_loads) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right tabular-nums font-black text-brand-navy">
                          {formatNumber(totalLoads)}
                        </td>
                        <td className={`px-5 py-4 text-right tabular-nums font-bold ${dropColColor}`}>
                          {dropCount > 0 ? formatNumber(dropCount) : <span className="text-muted-foreground font-normal">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: DETAIL PANEL */}
        {selected && (
          <div className="w-full lg:w-1/2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300 flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex justify-between items-start bg-muted/20">
              <div>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-widest mb-1",
                  viewMode === 'deliveries' ? "text-brand-blue" : "text-purple-600"
                )}>
                  {viewMode === 'deliveries' ? 'Receiver Profile' : 'Shipper Profile'}
                </div>
                <h2 className="text-lg font-black tracking-tight pr-8 line-clamp-1">{selected.name}</h2>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin size={11} /> {selected.zone}
                </div>
              </div>
              <button
                onClick={() => setSelectedName(null)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors mt-0.5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <DetailCard
                  icon={<Package size={13} className="text-brand-navy" />}
                  label="Total Loads"
                  value={formatNumber(round1d(viewMode === 'deliveries' ? (selected.total_loads || 0) : (selected.loads || 0)))}
                />
                <DetailCard
                  icon={<Activity size={13} className="text-slate-500" />}
                  label="TL / LTL"
                  value={`${round1d(selected.tl_loads || 0)} / ${round1d(selected.ltl_loads || 0)}`}
                />
                <DetailCard
                  icon={<MapPin size={13} className={viewMode === 'deliveries' ? "text-brand-blue" : "text-purple-600"} />}
                  label={viewMode === 'deliveries' ? 'Total Drops' : 'Total Pickups'}
                  value={formatNumber(viewMode === 'deliveries' ? (selected.total_drops || 0) : (selected.total_pickups || 0))}
                />
                <DetailCard
                  icon={<ArrowDownToLine size={13} className="text-slate-500" />}
                  label="Top Carrier"
                  value={selected.top_carrier || '—'}
                />
                <DetailCard
                  icon={<Activity size={13} className={cn(
                    selected.otd_percent >= 90 ? "text-emerald-500" : selected.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                  )}/>}
                  label="OTD Rate"
                  value={selected.otd_eligible > 0 ? `${selected.otd_percent}%` : 'No data'}
                />
                <DetailCard
                  icon={<Clock size={13} className="text-slate-500" />}
                  label="Avg Delay"
                  value={selected.otd_eligible > 0 && selected.otd_avg_delay > 0 ? `${selected.otd_avg_delay} hrs` : '0.0 hrs'}
                />
              </div>

              {/* Detention & Dwell Audit */}
              {selected.dwell_eligible > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                        ⚠️ Detention & Facility Efficiency Audit
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Auditing driver wait times at {selected.name}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                      selected.detention_risk >= 30 ? "bg-rose-500 text-white" :
                      selected.detention_risk >= 10 ? "bg-amber-500 text-white" :
                      "bg-emerald-500 text-white"
                    )}>
                      {selected.detention_risk >= 30 ? 'High Risk' : selected.detention_risk >= 10 ? 'Medium Risk' : 'Low Risk'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
                      <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Avg Dwell Time</div>
                      <div className="text-sm font-extrabold text-foreground">
                        {selected.avg_dwell_mins < 60 ? `${selected.avg_dwell_mins}m` : `${(selected.avg_dwell_mins / 60).toFixed(1)}h`}
                      </div>
                    </div>
                    <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
                      <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Detention Rate</div>
                      <div className="text-sm font-extrabold text-rose-500">{selected.detention_risk}%</div>
                    </div>
                    <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
                      <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Avg Detention</div>
                      <div className="text-sm font-extrabold text-foreground">
                        {selected.dwell_detention_count > 0 ? (selected.avg_detention_mins < 60 ? `${selected.avg_detention_mins}m` : `${(selected.avg_detention_mins / 60).toFixed(1)}h`) : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-semibold text-muted-foreground">
                    Out of <span className="font-extrabold text-foreground">{selected.dwell_eligible}</span> tracked visits, <span className="font-extrabold text-rose-500">{selected.dwell_detention_count}</span> exceeded the 2-hour free buffer. 
                    {selected.dwell_detention_count > 0 && (
                      <span> Total excess detention time: <span className="font-extrabold text-foreground">{(selected.dwell_detention_mins / 60).toFixed(1)} hours</span>. Estimated detention cost impact: <span className="font-extrabold text-brand-red">${Math.round((selected.dwell_detention_mins / 60) * 50).toLocaleString()}</span> (at $50/hr).</span>
                    )}
                  </div>
                </div>
              )}

              {/* Detail Tabs */}
              <div className="space-y-3 flex flex-col">
                <div className="flex gap-4 border-b border-border">
                  <button onClick={() => setDetailTab('carriers')} className={detailBtnCls('carriers')}>
                    🚛 Carriers ({filteredAndSortedCarriers.length})
                  </button>
                  <button onClick={() => setDetailTab('zones')} className={detailBtnCls('zones')}>
                    {zonesTabLabel} ({filteredAndSortedPoints.length})
                  </button>
                  <button onClick={() => setDetailTab('loads')} className={detailBtnCls('loads')}>
                    📦 Loads ({filteredAndSortedLoads.length})
                  </button>
                </div>

                <div className="pr-1">
                  {/* CARRIERS tab */}
                  {detailTab === 'carriers' && (() => {
                    return (
                      <div className="flex flex-col animate-in fade-in duration-200 gap-4 mt-1 pr-1">
                        {/* Carrier search input */}
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                          <div className="border border-border/40 bg-muted/10 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 flex-1">
                            <Truck size={13} className="text-brand-navy" />
                            <span>
                              {viewMode === 'pickups'
                                ? `Carriers picking up from ${selected.name}`
                                : `Carriers delivering to ${selected.name}`}
                            </span>
                          </div>
                          <div className="relative w-full sm:w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search carriers..."
                              className="w-full bg-secondary border border-border rounded-xl py-1.5 pl-8 pr-7 text-xs outline-hidden focus:border-brand-blue transition-all"
                              value={carriersSearch}
                              onChange={e => {
                                setCarriersSearch(e.target.value);
                                setCarriersPage(1);
                              }}
                            />
                            {carriersSearch && (
                              <button
                                onClick={() => setCarriersSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-card border-b border-border z-10">
                              {(() => {
                                const PTH = cn("cursor-pointer py-2.5 px-2 hover:text-brand-blue transition-colors select-none", SH);
                                return (
                                  <tr>
                                    <th onClick={() => handleCarriersSort('name')} className={`${PTH} text-left`}>
                                      <div className="flex items-center gap-1">
                                        <span>Carrier Name</span>
                                        {renderSortArrow('name', false)}
                                        {renderTooltip('The name of the carrier company', 'left')}
                                      </div>
                                    </th>
                                    <th onClick={() => handleCarriersSort('tl')} className={`${PTH} text-right`}>
                                      <div className="flex items-center justify-end gap-1">
                                        <span>TL</span>
                                        {renderSortArrow('tl', false)}
                                        {renderTooltip('Volume of Full Truckload (TL) shipments hauled', 'center')}
                                      </div>
                                    </th>
                                    <th onClick={() => handleCarriersSort('ltl')} className={`${PTH} text-right`}>
                                      <div className="flex items-center justify-end gap-1">
                                        <span>LTL</span>
                                        {renderSortArrow('ltl', false)}
                                        {renderTooltip('Volume of Less-Than-Truckload (LTL) shipments hauled', 'center')}
                                      </div>
                                    </th>
                                    <th onClick={() => handleCarriersSort('loads')} className={`${PTH} text-right`}>
                                      <div className="flex items-center justify-end gap-1">
                                        <span>Total Loads</span>
                                        {renderSortArrow('loads', false)}
                                        {renderTooltip('Combined volume share of all loads handled by this carrier', 'right')}
                                      </div>
                                    </th>
                                    <th onClick={() => handleCarriersSort('drops')} className={`${PTH} text-right`}>
                                      <div className="flex items-center justify-end gap-1">
                                        <span>{dropColLabel}</span>
                                        {renderSortArrow('drops', false)}
                                        {renderTooltip(`Total count of absolute physical ${dropColLabel.toLowerCase()} visits`, 'right')}
                                      </div>
                                    </th>
                                  </tr>
                                );
                              })()}
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {currentCarriersList.map((c: any, idx: number) => {
                                return (
                                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-2 font-medium text-foreground truncate max-w-[150px]" title={c.name}>
                                      {c.name || 'Unknown Carrier'}
                                    </td>
                                    <td className="py-2.5 px-2 text-right tabular-nums text-brand-green font-bold">
                                      {c.tl > 0 ? round1d(c.tl) : <span className="text-muted-foreground/30">—</span>}
                                    </td>
                                    <td className="py-2.5 px-2 text-right tabular-nums text-brand-yellow font-bold">
                                      {c.ltl > 0 ? round1d(c.ltl) : <span className="text-muted-foreground/30">—</span>}
                                    </td>
                                    <td className="py-2.5 px-2 text-right tabular-nums font-black text-brand-navy">
                                      {round1d(c.loads)}
                                    </td>
                                    <td className={cn("py-2.5 px-2 text-right tabular-nums font-bold", dropColColor)}>
                                      {c.drops || 0}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {filteredAndSortedCarriers.length > 0 && (
                              <tfoot className="border-t border-border bg-muted/5 font-bold">
                                <tr>
                                  <td className="py-2.5 px-2 font-black text-foreground">Total Carriers: {filteredAndSortedCarriers.length}</td>
                                  <td className="py-2.5 px-2 text-right tabular-nums font-black text-brand-green">
                                    {round1d(filteredAndSortedCarriers.reduce((sum, c) => sum + c.tl, 0))}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums font-black text-brand-yellow">
                                    {round1d(filteredAndSortedCarriers.reduce((sum, c) => sum + c.ltl, 0))}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums font-black text-brand-navy">
                                    {round1d(filteredAndSortedCarriers.reduce((sum, c) => sum + c.loads, 0))}
                                  </td>
                                  <td className={cn("py-2.5 px-2 text-right tabular-nums font-black", dropColColor)}>
                                    {filteredAndSortedCarriers.reduce((sum, c) => sum + (c.drops || 0), 0)}
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                        <Pagination currentPage={carriersPage} totalPages={totalCarriersPages} onPageChange={setCarriersPage} />
                      </div>
                    );
                  })()}

                  {/* POINTS / DESTINATIONS tab */}
                  {detailTab === 'zones' && (
                    <div className="flex flex-col animate-in fade-in duration-200 gap-4">
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                        <div className={cn(
                          "border rounded-xl px-3 py-2.5 text-xs font-semibold flex items-center gap-2 flex-1",
                          viewMode === 'pickups' 
                            ? "bg-purple-600/5 border-purple-600/20 text-purple-600 dark:text-purple-400"
                            : "bg-brand-blue/5 border-brand-blue/20 text-brand-blue dark:text-brand-blue"
                        )}>
                          <MapPin size={13} />
                          <span>
                            {viewMode === 'pickups'
                              ? `Showing shipper pickup facilities for ${selected.name}`
                              : `Showing customer delivery points/facilities for ${selected.name}`}
                          </span>
                        </div>
                        
                        {/* Point search input */}
                        <div className="relative w-full sm:w-48">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search locations..."
                            className="w-full bg-secondary border border-border rounded-xl py-1.5 pl-8 pr-7 text-xs outline-hidden focus:border-brand-blue transition-all"
                            value={pointsSearch}
                            onChange={e => {
                              setPointsSearch(e.target.value);
                              setZonesPage(1);
                            }}
                          />
                          {pointsSearch && (
                            <button
                              onClick={() => setPointsSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card border-b border-border z-10">
                            {(() => {
                              const PTH = cn("cursor-pointer py-2.5 px-2 hover:text-brand-blue transition-colors select-none", SH);
                              return (
                                <tr>
                                  <th onClick={() => handlePointsSort('address')} className={`${PTH} text-left`}>
                                    <div className="flex items-center gap-1">
                                      <span>Address / Location</span>
                                      {renderSortArrow('address')}
                                      {renderTooltip('Full address and city/state of the client facility', 'left')}
                                    </div>
                                  </th>
                                  <th onClick={() => handlePointsSort('otd_percent')} className={`${PTH} text-right`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>OTD %</span>
                                      {renderSortArrow('otd_percent')}
                                      {renderTooltip('On-Time Delivery/Pickup rate (percentage of visits within planned window)', 'center')}
                                    </div>
                                  </th>
                                  <th onClick={() => handlePointsSort('avg_dwell_mins')} className={`${PTH} text-right`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>Avg Dwell</span>
                                      {renderSortArrow('avg_dwell_mins')}
                                      {renderTooltip('Average dwell time spent at this facility (check-out minus check-in/planned)', 'center')}
                                    </div>
                                  </th>
                                  <th onClick={() => handlePointsSort('detention_risk')} className={`${PTH} text-right`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>Detention Risk</span>
                                      {renderSortArrow('detention_risk')}
                                      {renderTooltip('Percentage of visits exceeding the 2-hour free buffer', 'center')}
                                    </div>
                                  </th>
                                  <th onClick={() => handlePointsSort('loads')} className={`${PTH} text-right w-16`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>Loads</span>
                                      {renderSortArrow('loads')}
                                      {renderTooltip('Volume share of loads delivered or picked up at this point', 'right')}
                                    </div>
                                  </th>
                                  <th onClick={() => handlePointsSort('drops')} className={`${PTH} text-right w-16`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>{dropColLabel}</span>
                                      {renderSortArrow('drops')}
                                      {renderTooltip(`Total count of absolute physical ${dropColLabel.toLowerCase()} visits`, 'right')}
                                    </div>
                                  </th>
                                </tr>
                              );
                            })()}
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {currentPointsList.map((pt: any, idx: number) => {
                              const isCopied = copiedAddr === pt.address;
                              return (
                                <tr key={idx} className="hover:bg-muted/20 transition-colors group">
                                  <td className="py-2.5 px-2 font-medium">
                                    <div className="flex items-center gap-2">
                                      <div className="font-bold text-foreground truncate max-w-[190px]" title={pt.address}>
                                        {pt.address || 'No Address'}
                                      </div>
                                      {pt.address && (
                                        <button
                                          onClick={() => handleCopy(pt.address)}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted border border-border/40 rounded transition-all cursor-pointer text-muted-foreground hover:text-foreground"
                                          title={isCopied ? "Copied!" : "Copy address"}
                                        >
                                          {isCopied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                                      {pt.city || 'Unknown City'}, {pt.state || '??'}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums">
                                    {pt.otd_eligible > 0 ? (
                                      <span className={cn(
                                        "font-extrabold text-xs",
                                        pt.otd_percent >= 90 ? "text-emerald-500" : pt.otd_percent >= 75 ? "text-amber-500" : "text-rose-500"
                                      )}>
                                        {pt.otd_percent}%
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/60 text-[10px]">No data</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums">
                                    {pt.dwell_eligible > 0 ? (
                                      <span className="font-bold text-foreground text-xs">
                                        {pt.avg_dwell_mins < 60 ? `${pt.avg_dwell_mins}m` : `${(pt.avg_dwell_mins / 60).toFixed(1)}h`}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/60">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums">
                                    {pt.dwell_eligible > 0 ? (
                                      <span className={cn(
                                        "font-black text-[10px] px-1.5 py-0.5 rounded",
                                        pt.detention_risk >= 30 ? "bg-rose-500/10 text-rose-500" :
                                        pt.detention_risk >= 10 ? "bg-amber-500/10 text-amber-500" :
                                        "bg-emerald-500/10 text-emerald-500"
                                      )}>
                                        {pt.detention_risk}%
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/60">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-right tabular-nums font-black text-xs text-brand-navy">
                                    {round1d(pt.loads)}
                                  </td>
                                  <td className={cn("py-2.5 px-2 text-right tabular-nums font-bold text-xs", dropColColor)}>
                                    {viewMode === 'deliveries' ? (pt.drops || 0) : (pt.pickups || 0)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {filteredAndSortedPoints.length > 0 && (
                            <tfoot className="border-t border-border bg-muted/5 font-bold">
                              <tr>
                                <td className="py-2.5 px-2 font-black text-foreground">Total Points: {filteredAndSortedPoints.length}</td>
                                <td colSpan={3}></td>
                                <td className="py-2.5 px-2 text-right tabular-nums font-black text-brand-navy">
                                  {round1d(pointsTotalLoads)}
                                </td>
                                <td className={cn("py-2.5 px-2 text-right tabular-nums font-black", dropColColor)}>
                                  {pointsTotalDrops}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      <Pagination currentPage={zonesPage} totalPages={totalPointsPages} onPageChange={setZonesPage} />
                    </div>
                  )}

                  {/* LOADS tab */}
                  {detailTab === 'loads' && (
                    <div className="flex flex-col animate-in fade-in duration-200 gap-4 mt-1 pr-1">
                      {/* Loads search input */}
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                        <div className="border border-border/40 bg-muted/10 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 flex-1">
                          <Package size={13} className="text-brand-navy" />
                          <span>
                            {viewMode === 'pickups'
                              ? `Loads origin stops at ${selected.name}`
                              : `Loads destination stops at ${selected.name}`}
                          </span>
                        </div>
                        <div className="relative w-full sm:w-48">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search loads..."
                            className="w-full bg-secondary border border-border rounded-xl py-1.5 pl-8 pr-7 text-xs outline-hidden focus:border-brand-blue transition-all"
                            value={loadsSearch}
                            onChange={e => {
                              setLoadsSearch(e.target.value);
                              setLoadsPage(1);
                            }}
                          />
                          {loadsSearch && (
                            <button
                              onClick={() => setLoadsSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card border-b border-border z-10">
                            {(() => {
                              const PTH = cn("cursor-pointer py-2.5 px-2 hover:text-brand-blue transition-colors select-none", SH);
                              return (
                                <tr>
                                  <th onClick={() => handleLoadsSort('uniqueid')} className={`${PTH} text-left`}>
                                    <div className="flex items-center gap-1">
                                      <span>Load #</span>
                                      {renderSortArrow('uniqueid', 'loads')}
                                      {renderTooltip('System load tracker number', 'left')}
                                    </div>
                                  </th>
                                  <th onClick={() => handleLoadsSort('departure_date')} className={`${PTH} text-left`}>
                                    <div className="flex items-center gap-1">
                                      <span>Departure Date</span>
                                      {renderSortArrow('departure_date', 'loads')}
                                      {renderTooltip('Hauled load dispatch/departure date', 'center')}
                                    </div>
                                  </th>
                                  <th onClick={() => handleLoadsSort('trip_type')} className={`${PTH} text-center`}>
                                    <div className="flex items-center justify-center gap-1">
                                      <span>Type</span>
                                      {renderSortArrow('trip_type', 'loads')}
                                      {renderTooltip('Hauled volume type: Truckload (TL) vs Less-Than-Truckload (LTL)', 'center')}
                                    </div>
                                  </th>
                                  <th onClick={() => handleLoadsSort('states')} className={`${PTH} text-right`}>
                                    <div className="flex items-center justify-end gap-1">
                                      <span>States</span>
                                      {renderSortArrow('states', 'loads')}
                                      {renderTooltip('Unique delivery destination states for this load (comma-separated)', 'right')}
                                    </div>
                                  </th>
                                </tr>
                              );
                            })()}
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {currentLoadsList.map((l: any, i: number) => (
                              <tr key={i} className="hover:bg-muted/20 transition-colors">
                                <td className="py-2.5 px-2 font-bold">
                                  <a 
                                    href="#"
                                    className="text-brand-blue hover:text-brand-blue/80 hover:underline font-bold transition-all"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      console.log(`Load clicked: ${l.uniqueid}`);
                                    }}
                                  >
                                    {l.uniqueid || 'N/A'}
                                  </a>
                                </td>
                                <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
                                  {l.departure_date}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <span className={badge(l.trip_type)}>{l.trip_type}</span>
                                </td>
                                <td className="py-2.5 px-2 text-right text-muted-foreground font-semibold">
                                  {l.states_list}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {filteredAndSortedLoads.length > 0 && (
                            <tfoot className="border-t border-border bg-muted/5 font-bold">
                              <tr>
                                <td colSpan={4} className="py-2.5 px-2 font-black text-foreground">
                                  Total Loads: {filteredAndSortedLoads.length}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                      <Pagination currentPage={loadsPage} totalPages={totalLoadsPages} onPageChange={setLoadsPage} />
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
