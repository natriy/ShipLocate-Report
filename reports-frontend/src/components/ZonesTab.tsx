import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Users, Truck, Package, Activity, ChevronDown, ChevronRight, Info, Map, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import mapData from '../assets/usa-canada-map.json';

interface ZonesTabProps {
  zones: any[];
  customers: any[];
  carriers: any[];
  loads_raw: any[];
  isDark?: boolean;
}

const formatNumber = (val: number) => val.toLocaleString();

const SH = "text-[10px] uppercase tracking-wider font-black text-muted-foreground";
const TH = `cursor-pointer px-5 py-3 ${SH} hover:text-brand-blue transition-colors select-none`;

type SortKey = 'name' | 'loads' | 'single' | 'multi';

const STATE_TO_MESO: Record<string, string[]> = {
  // Canada
  QC: ["Quebec"],
  ON: ["Ontario"],
  NB: ["Atlantic Canada"],
  NS: ["Atlantic Canada"],
  PE: ["Atlantic Canada"],
  NL: ["Atlantic Canada"],
  
  // USA Northeast
  ME: ["New England"],
  NH: ["New England"],
  VT: ["New England"],
  MA: ["New England"],
  RI: ["New England"],
  CT: ["New England"],
  NY: ["New York City / LI", "Upstate New York"],
  NJ: ["North Jersey", "South Jersey"],
  PA: ["Eastern PA", "Western PA"],
  
  // Mid-Atlantic
  MD: ["Capital Region"],
  DE: ["Capital Region"],
  DC: ["Capital Region"],
  VA: ["Capital Region"],
  
  // Southeast
  NC: ["Carolinas"],
  SC: ["Carolinas"],
  GA: ["Georgia"],
  FL: ["Florida"],
  
  // Midwest / Heartland
  OH: ["Ohio Valley"],
  IN: ["Ohio Valley"],
  KY: ["Ohio Valley"],
  WV: ["Ohio Valley"],
  MI: ["Michigan"],
  IL: ["Chicagoland"],
  WI: ["Upper Midwest"],
  MN: ["Upper Midwest"],
  IA: ["Heartland"],
  MO: ["Heartland"],
  KS: ["Heartland"],
  NE: ["Heartland"],
  ND: ["Heartland"],
  SD: ["Heartland"],
  
  // South / Texas
  TX: ["Texas"],
  AL: ["Deep South"],
  TN: ["Deep South"],
  MS: ["Deep South"],
  AR: ["Deep South"],
  LA: ["Deep South"],
  OK: ["Deep South"]
};

export default function ZonesTab({ zones, customers, carriers, loads_raw, isDark = false }: ZonesTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('loads');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'customers' | 'carriers' | 'loads'>('customers');
  const [customersPage, setCustomersPage] = useState(1);
  const [carriersPage, setCarriersPage] = useState(1);
  const [loadsPage, setLoadsPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  const [expandedMacros, setExpandedMacros] = useState<Set<string>>(new Set());

  // Interactive map states
  const [showMap, setShowMap] = useState(true);
  const [hoveredState, setHoveredState] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [stateMenu, setStateMenu] = useState<{
    code: string;
    name: string;
    mesos: string[];
    x: number;
    y: number;
  } | null>(null);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(2);
  const [pan, setPan] = useState({ x: -591, y: -691 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragMoveDistance, setDragMoveDistance] = useState(0);

  // Drag & Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragMoveDistance(0);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dist = Math.sqrt(
      Math.pow(e.clientX - dragStartPos.x, 2) + 
      Math.pow(e.clientY - dragStartPos.y, 2)
    );
    setDragMoveDistance(dist);
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Close sub-zone menu on outside clicks
  useEffect(() => {
    if (!stateMenu) return;
    const handler = () => setStateMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [stateMenu]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const toggleMacro = (name: string) => {
    setExpandedMacros(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const macroMap = useMemo(() => {
    const map: Record<string, any> = {};
    zones.forEach(z => {
      const m = z.macro || 'Unknown Region';
      if (!map[m]) map[m] = { name: m, spend: 0, loads: 0, single: 0, multi: 0, children: [] };
      map[m].spend += z.spend;
      map[m].loads += z.loads;
      map[m].single += z.single;
      map[m].multi += z.multi;
      map[m].children.push(z);
    });
    return Object.values(map).sort((a: any, b: any) => {
      const va = a[sortKey], vb = b[sortKey];
      return sortDesc ? vb - va : va - vb;
    });
  }, [zones, sortKey, sortDesc]);

  // Meso load counts helpers
  const getMesoLoads = (mesoName: string) => {
    const z = zones.find(item => item.zone === mesoName);
    return z ? z.loads : 0;
  };

  const getStateLoads = (code: string) => {
    const mesos = STATE_TO_MESO[code] || [];
    return mesos.reduce((sum, meso) => sum + getMesoLoads(meso), 0);
  };

  const maxStateLoads = useMemo(() => {
    let max = 0;
    mapData.forEach((state: any) => {
      const total = getStateLoads(state.code);
      if (total > max) max = total;
    });
    return max || 1;
  }, [zones]);

  const getStateColor = (code: string) => {
    const count = getStateLoads(code);
    if (count === 0) return isDark ? '#1e293b' : '#f8fafc'; // slate-800 or soft light gray
    
    // Logarithmic scaling for better visualization of highly skewed load counts
    const ratio = Math.log(count + 1) / Math.log(maxStateLoads + 1);
    
    if (isDark) {
      // Interpolate from slate-800 (#1e293b) to blue-500 (#3b82f6)
      const r = Math.round(30 + (59 - 30) * ratio);
      const g = Math.round(41 + (130 - 41) * ratio);
      const b = Math.round(59 + (246 - 59) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Interpolate from very soft blue (#eff6ff) to deep brand blue (#2563eb)
      const r = Math.round(239 - (239 - 37) * ratio);
      const g = Math.round(246 - (246 - 99) * ratio);
      const b = Math.round(255 - (255 - 235) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const handleMouseMove = (e: React.MouseEvent, state: any) => {
    const rect = (e.currentTarget as any).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    }
    setHoveredState(state);
  };

  const handleMouseLeave = () => {
    setHoveredState(null);
  };

  const handleStateClick = (e: React.MouseEvent, stateCode: string, stateName: string) => {
    const mesos = STATE_TO_MESO[stateCode] || [];
    if (mesos.length === 0) return;
    
    if (mesos.length === 1) {
      setSelectedZoneName(selectedZoneName === mesos[0] ? null : mesos[0]);
      setStateMenu(null);
    } else {
      const rect = (e.currentTarget as any).ownerSVGElement?.getBoundingClientRect();
      if (rect) {
        setStateMenu({
          code: stateCode,
          name: stateName,
          mesos,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  // Move hovered state paths to the end so it renders on top of adjacent states
  const sortedMapData = useMemo(() => {
    if (!hoveredState) return mapData;
    return [
      ...mapData.filter(s => s.code !== hoveredState.code),
      mapData.find(s => s.code === hoveredState.code)
    ];
  }, [hoveredState]);

  const selectedZone = useMemo(() => zones.find(z => z.zone === selectedZoneName), [zones, selectedZoneName]);
  const zoneCustomers = useMemo(() => selectedZone ? Object.values(selectedZone.customers || {}) : [], [selectedZone]);
  const zoneCarriers = useMemo(() =>
    selectedZoneName ? carriers.filter(c => c.zones && c.zones[selectedZoneName]) : [],
    [carriers, selectedZoneName]);
  const zoneLoads = useMemo(() => {
    if (!selectedZoneName) return [];
    return (loads_raw || [])
      .filter(l => l.customers && l.customers.some((c: any) => c.zone?.mesoName === selectedZoneName))
      .map(l => {
        const cData = l.customers.find((c: any) => c.zone?.mesoName === selectedZoneName);
        return { ...l, stop_date: cData?.stop_date || l.date };
      })
      .sort((a, b) => new Date(b.stop_date).getTime() - new Date(a.stop_date).getTime());
  }, [loads_raw, selectedZoneName]);

  const totalCustomersPages = Math.ceil(zoneCustomers.length / ITEMS_PER_PAGE);
  const sortedZoneCustomers = useMemo(() => [...zoneCustomers].sort((a: any, b: any) => b.loads - a.loads), [zoneCustomers]);
  const currentCustomers = sortedZoneCustomers.slice((customersPage - 1) * ITEMS_PER_PAGE, customersPage * ITEMS_PER_PAGE);

  const totalCarriersPages = Math.ceil(zoneCarriers.length / ITEMS_PER_PAGE);
  const sortedZoneCarriers = useMemo(() => {
    if (!selectedZoneName) return [];
    return [...zoneCarriers].sort((a, b) => b.zones[selectedZoneName].loads - a.zones[selectedZoneName].loads);
  }, [zoneCarriers, selectedZoneName]);
  const currentCarriers = sortedZoneCarriers.slice((carriersPage - 1) * ITEMS_PER_PAGE, carriersPage * ITEMS_PER_PAGE);

  const totalLoadsPages = Math.ceil(zoneLoads.length / ITEMS_PER_PAGE);
  const currentLoads = zoneLoads.slice((loadsPage - 1) * ITEMS_PER_PAGE, loadsPage * ITEMS_PER_PAGE);

  React.useEffect(() => {
    setCustomersPage(1);
    setCarriersPage(1);
    setLoadsPage(1);
  }, [selectedZoneName]);

  const detailBtnCls = (tab: string) => cn(
    "pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer",
    detailTab === tab ? "border-brand-blue text-brand-blue" : "border-transparent text-muted-foreground hover:text-foreground"
  );

  const badge = (type: string) => cn(
    "px-1.5 py-0.5 rounded text-[9px] font-black inline-block min-w-[28px] text-center",
    type === 'LTL' ? "bg-brand-yellow/10 text-brand-yellow" : "bg-brand-green/10 text-brand-green"
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* GEOGRAPHIC MAP */}
      {!selectedZoneName && (
        <div className="bg-card border border-border rounded-2xl shadow-xs p-5 flex flex-col relative transition-all duration-300">
          <div className={cn("flex justify-between items-center shrink-0", showMap ? "mb-4" : "")}>
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-brand-blue rounded-full inline-block" />
              Geographic Load Distribution
            </h3>
            <button
              onClick={() => setShowMap(!showMap)}
              className="text-[10px] uppercase font-black text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 hover:bg-muted rounded-lg transition-all cursor-pointer select-none"
            >
              <Map size={11} className="text-muted-foreground/80" />
              Interactive Map
              <ChevronDown size={12} className={cn("transition-transform duration-200 text-muted-foreground/60", showMap ? "rotate-180" : "")} />
            </button>
          </div>

          {showMap && (
            <div className="relative w-full h-[380px] bg-muted/5 rounded-xl overflow-hidden flex items-center justify-center border border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Zoom & Pan Control Buttons */}
              <div className="absolute top-4 left-4 bg-card border border-border/60 rounded-xl p-1 flex flex-col gap-1 shadow-sm z-10 select-none">
                <button
                  onClick={() => setZoom(z => Math.min(8, z + 0.3))}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(1, z - 0.3))}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => {
                    setZoom(2);
                    setPan({ x: -591, y: -691 });
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Reset View"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              <svg
                viewBox="0 0 1000 650"
                className={cn(
                  "w-full h-full p-2 select-none outline-hidden transition-all duration-75",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {sortedMapData.map((state: any) => (
                    <g key={state.code}>
                      {state.polygons.map((poly: any, pIdx: number) => {
                        const pathData = poly.map((pt: any, ptIdx: number) => `${ptIdx === 0 ? 'M' : 'L'}${pt[0]} ${pt[1]}`).join(' ') + ' Z';
                        const isHovered = hoveredState?.code === state.code;
                        const hasLoads = getStateLoads(state.code) > 0;
                        return (
                          <path
                            key={`${state.code}-${pIdx}`}
                            d={pathData}
                            fill={getStateColor(state.code)}
                            stroke={isHovered ? "var(--color-brand-blue)" : (isDark ? "#334155" : "#cbd5e1")}
                            strokeWidth={isHovered ? 1.5 : 0.5}
                            vectorEffect="non-scaling-stroke"
                            className={cn(
                              "transition-all duration-150",
                              hasLoads ? "cursor-pointer" : "cursor-default"
                            )}
                            onMouseMove={(e) => handleMouseMove(e, state)}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => {
                              // Only trigger state selection click if we didn't drag/pan the map
                              if (hasLoads && dragMoveDistance < 5) {
                                e.stopPropagation();
                                handleStateClick(e, state.code, state.name);
                              }
                            }}
                          />
                        );
                      })}
                    </g>
                  ))}
                </g>
              </svg>

              {/* Custom Tooltip */}
              {hoveredState && (
                <div
                  className="absolute bg-card border border-border rounded-xl shadow-lg p-3 text-xs pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[170px]"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-extrabold text-foreground">{hoveredState.name} ({hoveredState.code})</span>
                      <span className="bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded text-[10px] font-black">
                        {getStateLoads(hoveredState.code)} Loads
                      </span>
                    </div>
                    {(() => {
                      const mesos = STATE_TO_MESO[hoveredState.code] || [];
                      const total = getStateLoads(hoveredState.code);
                      if (mesos.length > 1 && total > 0) {
                        return (
                          <div className="pt-1.5 border-t border-border/50 space-y-1 text-[10px]">
                            {mesos.map(meso => {
                              const count = getMesoLoads(meso);
                              return (
                                <div key={meso} className="flex justify-between text-muted-foreground">
                                  <span>{meso}</span>
                                  <span className="font-semibold text-foreground">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Sub-zone Menu Selector Popover */}
              {stateMenu && (
                <div
                  className="absolute bg-card border border-border rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col min-w-[180px]"
                  style={{ left: stateMenu.x, top: stateMenu.y }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center px-2 py-1 border-b border-border/50 mb-1.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">{stateMenu.name} Regions</span>
                    <button onClick={() => setStateMenu(null)} className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer">
                      <X size={10} />
                    </button>
                  </div>
                  {stateMenu.mesos.map(meso => {
                    const isSelected = selectedZoneName === meso;
                    const count = getMesoLoads(meso);
                    return (
                      <button
                        key={meso}
                        onClick={() => {
                          setSelectedZoneName(isSelected ? null : meso);
                          setStateMenu(null);
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex justify-between items-center transition-colors cursor-pointer",
                          isSelected
                            ? "bg-brand-blue/10 text-brand-blue"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <span>{meso}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Color Legend */}
              <div className="absolute bottom-4 right-4 bg-card border border-border/60 rounded-xl px-3 py-2 flex flex-col gap-1.5 shadow-xs pointer-events-none">
                <span className="text-[9px] uppercase font-black text-muted-foreground tracking-wider">Load Volume</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold">0</span>
                  <div className={cn(
                    "w-24 h-2 rounded-full border border-border/50 bg-gradient-to-r",
                    isDark ? "from-[#1e293b] to-[#3b82f6]" : "from-[#eff6ff] to-[#2563eb]"
                  )} />
                  <span className="text-[10px] text-muted-foreground font-semibold">{maxStateLoads}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* LEFT: TABLE */}
        <div className={cn("space-y-4 transition-all duration-500", selectedZoneName ? "w-full lg:w-1/2" : "w-full")}>
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th onClick={() => handleSort('name')} className={TH}>Region / Zone</th>
                    <th onClick={() => handleSort('loads')} className={`${TH} text-right`}>Loads</th>
                    <th onClick={() => handleSort('single')} className={`${TH} text-right`}>TL</th>
                    <th onClick={() => handleSort('multi')} className={`${TH} text-right`}>LTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {macroMap.map((macro, idx) => {
                    const isExpanded = expandedMacros.has(macro.name);
                    return (
                      <React.Fragment key={`macro-${idx}`}>
                        <tr
                          onClick={() => toggleMacro(macro.name)}
                          className="hover:bg-muted/30 transition-colors cursor-pointer bg-muted/10"
                        >
                          <td className="px-5 py-4 font-black flex items-center gap-2.5">
                            {isExpanded
                              ? <ChevronDown size={13} className="text-brand-blue shrink-0" />
                              : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
                            {macro.name}
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums font-black">{formatNumber(macro.loads)}</td>
                          <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-green">{formatNumber(macro.single)}</td>
                          <td className="px-5 py-4 text-right tabular-nums font-bold text-brand-yellow">{formatNumber(macro.multi)}</td>
                        </tr>
                        {isExpanded && macro.children
                          .sort((a: any, b: any) => b.loads - a.loads)
                          .map((meso: any, mIdx: number) => (
                            <tr
                              key={`meso-${idx}-${mIdx}`}
                              onClick={() => setSelectedZoneName(meso.zone === selectedZoneName ? null : meso.zone)}
                              className={cn(
                                "hover:bg-muted/30 transition-colors cursor-pointer text-xs",
                                selectedZoneName === meso.zone ? "bg-brand-blue/5 border-l-2 border-l-brand-blue" : ""
                              )}
                            >
                              <td className="px-5 py-3 pl-11 font-semibold flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />
                                {meso.zone}
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-blue">{formatNumber(meso.loads)}</td>
                              <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-green">{formatNumber(meso.single)}</td>
                              <td className="px-5 py-3 text-right tabular-nums font-semibold text-brand-yellow">{formatNumber(meso.multi)}</td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: DETAIL PANEL */}
        {selectedZone && (
          <div className="w-full lg:w-1/2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300 flex flex-col sticky top-6">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex justify-between items-start bg-muted/20 shrink-0">
              <div>
                <div className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">{selectedZone.macro || 'Zone Details'}</div>
                <h2 className="text-lg font-black tracking-tight">{selectedZone.zone}</h2>
              </div>
              <button onClick={() => setSelectedZoneName(null)} className="p-1.5 hover:bg-muted rounded-lg transition-colors mt-0.5 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1 flex flex-col min-h-0">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                <DetailCard icon={<Package size={13}/>} label="Loads" value={formatNumber(selectedZone.loads)} />
                <DetailCard icon={<Activity size={13}/>} label="LTL" value={formatNumber(selectedZone.multi)} />
                <DetailCard icon={<Activity size={13}/>} label="TL" value={formatNumber(selectedZone.single)} />
                <DetailCard icon={<Users size={13}/>} label="Customers" value={zoneCustomers.length} />
                <DetailCard icon={<Truck size={13}/>} label="Carriers" value={zoneCarriers.length} />
              </div>

              {/* Tabs */}
              <div className="flex flex-col flex-1 min-h-0 space-y-3">
                <div className="flex gap-4 border-b border-border shrink-0">
                  <button onClick={() => setDetailTab('customers')} className={detailBtnCls('customers')}>🏢 Customers ({zoneCustomers.length})</button>
                  <button onClick={() => setDetailTab('carriers')} className={detailBtnCls('carriers')}>🚛 Carriers ({zoneCarriers.length})</button>
                  <button onClick={() => setDetailTab('loads')} className={detailBtnCls('loads')}>📦 Loads ({zoneLoads.length})</button>
                </div>

                <div className="pr-1">
                  {detailTab === 'customers' && (
                    <div className="flex flex-col animate-in fade-in duration-200">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border z-10">
                          <tr>
                            <th className={`text-left py-2.5 px-2 ${SH}`}>Customer</th>
                            <th className={`text-center py-2.5 px-2 w-16 ${SH}`}>Loads</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {currentCustomers.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-2 font-semibold truncate max-w-[160px]" title={c.name}>{c.name}</td>
                              <td className="py-2.5 px-2 text-center tabular-nums text-muted-foreground">{c.loads}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Pagination
                        currentPage={customersPage}
                        totalPages={totalCustomersPages}
                        onPageChange={setCustomersPage}
                      />
                    </div>
                  )}

                  {detailTab === 'carriers' && (
                    <div className="flex flex-col animate-in fade-in duration-200">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border z-10">
                          <tr>
                            <th className={`text-left py-2.5 px-2 ${SH}`}>Carrier</th>
                            <th className={`text-center py-2.5 px-2 w-16 ${SH}`}>Loads</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {currentCarriers.map((c, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-2 font-semibold truncate max-w-[160px]" title={c.name}>{c.name}</td>
                              <td className="py-2.5 px-2 text-center tabular-nums font-bold">{c.zones[selectedZoneName!].loads}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Pagination
                        currentPage={carriersPage}
                        totalPages={totalCarriersPages}
                        onPageChange={setCarriersPage}
                      />
                    </div>
                  )}

                  {detailTab === 'loads' && (
                    <div className="flex flex-col animate-in fade-in duration-200">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border z-10">
                          <tr>
                            <th className={`text-left py-2.5 px-2 ${SH}`}>Load #</th>
                            <th className={`text-left py-2.5 px-2 ${SH}`}>Date</th>
                            <th className={`text-left py-2.5 px-2 ${SH}`}>Customer</th>
                            <th className={`text-center py-2.5 px-2 ${SH}`}>Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {currentLoads.map((l, i) => (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-2 font-bold">{l.uniqueid || 'N/A'}</td>
                              <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">{l.stop_date?.split('T')[0] || l.date}</td>
                              <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[120px]" title={
                                (l.customers || []).filter((c: any) => c.zone?.mesoName === selectedZoneName).map((c: any) => c.name).join(', ')
                              }>
                                {(l.customers || []).filter((c: any) => c.zone?.mesoName === selectedZoneName).map((c: any) => c.name).join(', ')}
                              </td>
                              <td className="py-2.5 px-2 text-center"><span className={badge(l.trip_type)}>{l.trip_type === 'LTL' ? 'LTL' : 'TL'}</span></td>
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

function DetailCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
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

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (p: number) => void }) {
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
