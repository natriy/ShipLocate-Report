import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import mapData from '../assets/usa-canada-map.json';

interface InteractiveMapProps {
  stateCounts: Record<string, number>;
  selectedState: string | null;
  onStateClick: (stateCode: string) => void;
  isDark?: boolean;
  label?: string;
  autoFocus?: boolean;
}

export default function InteractiveMap({ stateCounts, selectedState, onStateClick, isDark = false, label = "Loads", autoFocus = false }: InteractiveMapProps) {
  // Zoom & Pan states centered on Kansas by default
  const [zoom, setZoom] = useState(2);
  const [pan, setPan] = useState({ x: -591, y: -691 });

  React.useEffect(() => {
    if (!autoFocus) return;
    // Calculate bounding box of active states
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let found = false;
    mapData.forEach((state: any) => {
      const count = stateCounts[state.code] || 0;
      if (count > 0) {
        found = true;
        state.polygons.forEach((poly: any) => {
          poly.forEach((pt: any) => {
            if (pt[0] < minX) minX = pt[0];
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] < minY) minY = pt[1];
            if (pt[1] > maxY) maxY = pt[1];
          });
        });
      }
    });

    if (found) {
      const w = maxX - minX;
      const h = maxY - minY;
      const cX = (minX + maxX) / 2;
      const cY = (minY + maxY) / 2;

      // Fit within 1000x650 SVG with 20% padding to fit inside detail sidepanel nicely
      const zoomX = (1000 * 0.6) / (w || 1);
      const zoomY = (650 * 0.6) / (h || 1);
      const targetZoom = Math.round(Math.max(1.2, Math.min(8, Math.min(zoomX, zoomY))) * 10) / 10;

      setZoom(targetZoom);
      setPan({
        x: Math.round(500 - cX * targetZoom),
        y: Math.round(325 - cY * targetZoom)
      });
    } else {
      // Default reset
      setZoom(2);
      setPan({ x: -591, y: -691 });
    }
  }, [stateCounts, autoFocus]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragMoveDistance, setDragMoveDistance] = useState(0);

  const [hoveredState, setHoveredState] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
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

  const maxStateLoads = useMemo(() => {
    let max = 0;
    Object.values(stateCounts).forEach(count => {
      if (count > max) max = count;
    });
    return max || 1;
  }, [stateCounts]);

  const getStateColor = (code: string) => {
    const count = stateCounts[code] || 0;
    if (count === 0) return isDark ? '#1e293b' : '#f8fafc'; // slate-800 or soft light gray
    
    // Logarithmic scaling for visual balance
    const ratio = Math.log(count + 1) / Math.log(maxStateLoads + 1);
    
    if (isDark) {
      // Interpolate from slate-800 (#1e293b) to blue-500 (#3b82f6)
      const r = Math.round(30 + (59 - 30) * ratio);
      const g = Math.round(41 + (130 - 41) * ratio);
      const b = Math.round(59 + (246 - 59) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Interpolate from soft blue (#eff6ff) to deep brand blue (#2563eb)
      const r = Math.round(239 - (239 - 37) * ratio);
      const g = Math.round(246 - (246 - 99) * ratio);
      const b = Math.round(255 - (255 - 235) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const handleStateMouseMove = (e: React.MouseEvent, state: any) => {
    const rect = (e.currentTarget as any).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left + 15,
        y: e.clientY - rect.top + 15
      });
    }
    setHoveredState(state);
  };

  const handleStateMouseLeave = () => {
    setHoveredState(null);
  };

  // Move hovered state path to the end so it renders on top of adjacent borders
  const sortedMapData = useMemo(() => {
    if (!hoveredState) return mapData;
    return [
      ...mapData.filter(s => s.code !== hoveredState.code),
      mapData.find(s => s.code === hoveredState.code)
    ];
  }, [hoveredState]);

  return (
    <div className="relative w-full h-[300px] bg-muted/5 rounded-2xl overflow-hidden flex items-center justify-center border border-border/40 animate-in fade-in duration-200">
      {/* Zoom & Pan Controls */}
      <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-xs border border-border/60 rounded-xl p-1 flex flex-col gap-1 shadow-sm z-10 select-none">
        <button
          onClick={() => setZoom(z => Math.min(8, z + 0.3))}
          className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={12} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(1, z - 0.3))}
          className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={12} />
        </button>
        <button
          onClick={() => {
            setZoom(2);
            setPan({ x: -591, y: -691 });
          }}
          className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Reset View"
        >
          <RotateCcw size={11} />
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
          {sortedMapData.map((state: any) => {
            const isHovered = hoveredState?.code === state.code;
            const isSelected = selectedState === state.code;
            const count = stateCounts[state.code] || 0;
            const hasLoads = count > 0;
            return (
              <g key={state.code}>
                {state.polygons.map((poly: any, pIdx: number) => {
                  const pathData = poly.map((pt: any, ptIdx: number) => `${ptIdx === 0 ? 'M' : 'L'}${pt[0]} ${pt[1]}`).join(' ') + ' Z';
                  return (
                    <path
                      key={`${state.code}-${pIdx}`}
                      d={pathData}
                      fill={getStateColor(state.code)}
                      stroke={isSelected ? "var(--color-brand-green)" : (isHovered ? "var(--color-brand-blue)" : (isDark ? "#334155" : "#cbd5e1"))}
                      strokeWidth={isSelected ? 2 : (isHovered ? 1.5 : 0.5)}
                      vectorEffect="non-scaling-stroke"
                      className={cn(
                        "transition-all duration-150",
                        hasLoads ? "cursor-pointer" : "cursor-default"
                      )}
                      onMouseMove={(e) => handleStateMouseMove(e, state)}
                      onMouseLeave={handleStateMouseLeave}
                      onClick={(e) => {
                        if (hasLoads && dragMoveDistance < 5) {
                          e.stopPropagation();
                          onStateClick(state.code);
                        }
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover Tooltip */}
      {hoveredState && (
        <div
          className="absolute bg-card/95 backdrop-blur-xs border border-border rounded-xl shadow-lg p-2.5 text-xs pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[140px]"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex justify-between items-center gap-3">
            <span className="font-extrabold text-foreground">{hoveredState.name} ({hoveredState.code})</span>
            <span className="bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded text-[10px] font-black">
              {stateCounts[hoveredState.code] || 0} {label}
            </span>
          </div>
        </div>
      )}

      {/* Color Legend */}
      <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-xs border border-border/60 rounded-xl px-2.5 py-1.5 flex flex-col gap-1 shadow-xs pointer-events-none">
        <span className="text-[8px] uppercase font-black text-muted-foreground tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground font-semibold">0</span>
          <div className={cn(
            "w-16 h-1.5 rounded-full border border-border/30 bg-gradient-to-r",
            isDark ? "from-[#1e293b] to-[#3b82f6]" : "from-[#eff6ff] to-[#2563eb]"
          )} />
          <span className="text-[9px] text-muted-foreground font-semibold">{maxStateLoads}</span>
        </div>
      </div>
    </div>
  );
}
