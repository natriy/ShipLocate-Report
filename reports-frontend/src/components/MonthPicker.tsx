import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type MonthYear = { year: number; month: number };

interface MonthPickerProps {
  value: MonthYear;
  onChange: (val: MonthYear) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtMY(my: MonthYear) { return `${MONTH_NAMES[my.month - 1]} ${my.year}`; }

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'year' | 'decade'>('year');
  const [navYear, setNavYear] = useState<number>(value.year);
  const ref = useRef<HTMLDivElement>(null);

  // Sync navYear when external value changes
  useEffect(() => {
    setNavYear(value.year);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMonthClick = (y: number, m: number) => {
    onChange({ year: y, month: m });
    setOpen(false);
  };

  const handleYearClick = (y: number) => {
    setNavYear(y);
    setView('year');
  };

  const decadeStart = Math.floor(navYear / 10) * 10;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(o => !o);
          setView('year');
          setNavYear(value.year);
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-muted text-foreground border border-border rounded-lg text-xs font-bold transition-all cursor-pointer select-none min-w-[90px] justify-between",
          open && "border-brand-green bg-brand-green/5 text-brand-green"
        )}
      >
        <span>{fmtMY(value)}</span>
        <ChevronDown size={12} className={cn("text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 bg-white border border-border rounded-2xl shadow-lg p-3 w-[260px] animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col text-foreground">
          {/* Calendar Picker Header */}
          <div className="flex justify-center items-center border border-border/60 rounded-xl p-1 mb-2.5 bg-muted/20">
            {view === 'year' ? (
              <button
                onClick={() => setView('decade')}
                className="text-xs font-black text-foreground hover:text-brand-green flex items-center gap-1 px-2.5 py-0.5 rounded-md hover:bg-muted/60 transition-all cursor-pointer"
                title="Switch to Decade View"
              >
                <span>{navYear}</span>
                <span className="text-[7px] text-muted-foreground font-semibold">▼</span>
              </button>
            ) : (
              <button
                onClick={() => setView('year')}
                className="text-xs font-black text-foreground hover:text-brand-green flex items-center gap-1 px-2.5 py-0.5 rounded-md hover:bg-muted/60 transition-all cursor-pointer"
                title="Switch to Year View"
              >
                <span>{decadeStart} - {decadeStart + 9}</span>
                <span className="text-[7px] text-muted-foreground font-semibold">▲</span>
              </button>
            )}
          </div>

          {/* Grid Panel */}
          <div className="min-h-[100px] flex flex-col justify-center">
            {view === 'year' ? (
              <div className="grid grid-cols-4 gap-1 animate-in fade-in duration-200">
                {MONTH_NAMES.map((name, idx) => {
                  const m = idx + 1;
                  const isSelected = value.year === navYear && value.month === m;
                  return (
                    <button
                      key={m}
                      onClick={() => handleMonthClick(navYear, m)}
                      className={cn(
                        "text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer",
                        isSelected
                          ? "bg-brand-green text-white shadow-xs font-bold"
                          : "hover:bg-brand-green/10 hover:text-brand-green text-foreground",
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1 animate-in fade-in duration-200">
                {Array.from({ length: 12 }, (_, i) => {
                  const y = decadeStart + i;
                  const isSelected = value.year === y;
                  const isCurrentNav = y === navYear;

                  return (
                    <button
                      key={y}
                      onClick={() => handleYearClick(y)}
                      className={cn(
                        "text-[11px] font-semibold py-1.5 rounded-lg transition-all cursor-pointer",
                        isSelected
                          ? "bg-brand-green text-white shadow-xs font-bold"
                          : isCurrentNav
                            ? "border border-brand-green/40 text-brand-green"
                            : "hover:bg-brand-green/10 hover:text-brand-green text-foreground",
                      )}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
