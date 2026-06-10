import React, { useState, useMemo, useRef, useEffect } from 'react';
import realData from '@/lib/real-data.json';
import { Truck, MapPin, Activity, DollarSign, Package, Plus, X, Check, TrendingUp, TrendingDown, Minus, Sun, Moon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import OverviewTab from '@/components/OverviewTab';
import CarriersTab from '@/components/CarriersTab';
import ZonesTab from '@/components/ZonesTab';
import RiskTab from '@/components/RiskTab';
import LocationTab from '@/components/LocationTab';
import LanesTab from '@/components/LanesTab';
import MonthPicker from '@/components/MonthPicker';
import DriversTab from '@/components/DriversTab';
import TransitTab from '@/components/TransitTab';

const formatCurrency = (val: number | null) => val != null ? `$${val.toLocaleString()}` : '—';
const formatNumber = (val: number) => val.toLocaleString();

type MonthYear = { year: number; month: number };

// Comparison year colors
const COMPARE_COLORS = ['#2563eb', '#d97706', '#7c3aed'];

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const YEARS = [
  { value: 2024, label: '2024' },
  { value: 2025, label: '2025' },
  { value: 2026, label: '2026' },
];

const COMPARE_OPTIONS = [
  { value: 1, label: '1 year ago' },
  { value: 2, label: '2 years ago' },
  { value: 3, label: '3 years ago' },
  { value: 4, label: '4 years ago' },
  { value: 5, label: '5 years ago' },
];

// ─── Compute default range: last 6 months from latest date in data ───
function computeDefaultRange(loads_raw: any[]): { start: MonthYear; end: MonthYear } {
  if (!loads_raw.length) return { start: { year: 2026, month: 1 }, end: { year: 2026, month: 5 } };
  const latest = loads_raw
    .filter(l => l.date)
    .map(l => l.date.substring(0, 7))
    .sort()
    .at(-1)!;
  const [ly, lm] = latest.split('-').map(Number);
  let sm = lm - 5;
  let sy = ly;
  if (sm <= 0) { sm += 12; sy -= 1; }
  return { start: { year: sy, month: sm }, end: { year: ly, month: lm } };
}

function getDatesInRange(start: MonthYear, end: MonthYear): string[] {
  const dates: string[] = [];
  const curr = new Date(Date.UTC(start.year, start.month - 1, 1));
  const last = new Date(Date.UTC(end.year, end.month, 0));
  while (curr <= last) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currency, setCurrency] = useState<'USD' | 'CAD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.36);

  const formatCurrency = (val: number | null) => {
    if (val == null) return '—';
    return currency === 'CAD' ? `C$${Math.round(val).toLocaleString()}` : `$${Math.round(val).toLocaleString()}`;
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const { loads } = realData as any;
  const loads_raw: any[] = loads || [];

  // ─── Default range: last 6 months ───
  const defaultRange = useMemo(() => computeDefaultRange(loads_raw), []);

  const [startDate, setStartDate] = useState<MonthYear>(defaultRange.start);
  const [endDate, setEndDate] = useState<MonthYear>(defaultRange.end);

  // ─── Comparison offsets (max 2) ───
  const [compareOffsets, setCompareOffsets] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (compareRef.current && !compareRef.current.contains(e.target as Node)) {
        setCompareOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleCompareOffset = (offset: number) => {
    setCompareOffsets(prev => {
      if (prev.includes(offset)) {
        return prev.filter(o => o !== offset);
      }
      if (prev.length < 2) {
        return [...prev, offset].sort();
      }
      return prev;
    });
  };

  // Date handlers are now fully delegated to DateRangePicker component

  // ─── Core aggregation function (cross-year aware) ───
  const getAggregatedData = (start: MonthYear, end: MonthYear, curr: string = 'USD', rate: number = 1.36) => {
    const startKey = start.year * 12 + start.month;
    const endKey   = end.year * 12 + end.month;

    const filtered: any[] = [];

    const parseDate = (str: string) => {
      if (!str) return NaN;
      let clean = str;
      if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
        clean = str + 'Z';
      }
      return new Date(clean).getTime();
    };

    const globalOTDStats = { otd_eligible: 0, otd_ontime: 0, otd_late: 0, otd_total_delay: 0, otd_late_only: 0, otd_severe_late: 0 };

    const globalDwellStats = {
      dwell_eligible: 0,
      dwell_total_mins: 0,
      dwell_detention_count: 0,
      dwell_detention_mins: 0
    };

    const globalCompliance = {
      total: 0,
      has_phone: 0,
      has_sms: 0,
      logged_in: 0,
      accepted: 0,
      driver_delivered: 0,
      manual_close: 0,
      never_app: 0,
      close_methods: {
        driver_self: 0,
        office_manual: 0,
        office_auto: 0,
        still_open: 0
      } as Record<string, number>,
      sms_to_login_sum: 0,
      sms_to_login_count: 0,
      sms_to_accept_sum: 0,
      sms_to_accept_count: 0
    };

    const globalArrivalStats = {
      arr_eligible: 0,
      arr_ontime: 0,
      arr_late: 0,
      arr_total_delay: 0
    };

    const globalHourlyDelays: Record<number, { hour: number; count: number; total_delay_mins: number }> = {};
    for (let h = 0; h < 24; h++) {
      globalHourlyDelays[h] = { hour: h, count: 0, total_delay_mins: 0 };
    }

    const WEEKDAY_NAMES_LIST = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const globalWeekdayDelays: Record<string, { day: string; count: number; total_delay_mins: number }> = {};
    WEEKDAY_NAMES_LIST.forEach(day => {
      globalWeekdayDelays[day] = { day, count: 0, total_delay_mins: 0 };
    });

    const processStopArrival = (stop: any, targetMapEntry: any, isGlobal: boolean = false) => {
      if (stop.entered_at && stop.planned_at) {
        const planned = parseDate(stop.planned_at);
        const entered = parseDate(stop.entered_at);
        if (!isNaN(planned) && !isNaN(entered)) {
          const delayMins = (entered - planned) / (60 * 1000);
          targetMapEntry.arr_eligible = (targetMapEntry.arr_eligible || 0) + 1;
          if (delayMins <= 30) {
            targetMapEntry.arr_ontime = (targetMapEntry.arr_ontime || 0) + 1;
          } else {
            targetMapEntry.arr_late = (targetMapEntry.arr_late || 0) + 1;
            targetMapEntry.arr_total_delay = (targetMapEntry.arr_total_delay || 0) + delayMins;
          }

          if (isGlobal) {
            const dt = new Date(planned);
            const hour = dt.getUTCHours();
            const dayName = WEEKDAY_NAMES_LIST[dt.getUTCDay()];

            if (globalHourlyDelays[hour]) {
              globalHourlyDelays[hour].count++;
              globalHourlyDelays[hour].total_delay_mins += Math.max(0, delayMins);
            }
            if (globalWeekdayDelays[dayName]) {
              globalWeekdayDelays[dayName].count++;
              globalWeekdayDelays[dayName].total_delay_mins += Math.max(0, delayMins);
            }
          }
        }
      }
    };

    const processStopOTD = (stop: any, targetMapEntry: any) => {
      if (stop.planned_at && stop.completed_at) {
        const planned = parseDate(stop.planned_at);
        const completed = parseDate(stop.completed_at);
        if (!isNaN(planned) && !isNaN(completed)) {
          const delayMins = (completed - planned) / (60 * 1000);
          targetMapEntry.otd_eligible = (targetMapEntry.otd_eligible || 0) + 1;
          if (delayMins <= 120) {
            targetMapEntry.otd_ontime = (targetMapEntry.otd_ontime || 0) + 1;
          } else {
            targetMapEntry.otd_late = (targetMapEntry.otd_late || 0) + 1;
            targetMapEntry.otd_total_delay = (targetMapEntry.otd_total_delay || 0) + delayMins;
            if (delayMins <= 240) {
              targetMapEntry.otd_late_only = (targetMapEntry.otd_late_only || 0) + 1;
            } else {
              targetMapEntry.otd_severe_late = (targetMapEntry.otd_severe_late || 0) + 1;
            }
          }
        }
      }
    };

    const processStopDwell = (stop: any, targetMapEntry: any) => {
      if (stop.dwell_mins !== undefined && stop.dwell_mins !== null) {
        targetMapEntry.dwell_eligible = (targetMapEntry.dwell_eligible || 0) + 1;
        targetMapEntry.dwell_total_mins = (targetMapEntry.dwell_total_mins || 0) + stop.dwell_mins;
        if (stop.dwell_mins > 120) {
          targetMapEntry.dwell_detention_count = (targetMapEntry.dwell_detention_count || 0) + 1;
          targetMapEntry.dwell_detention_mins = (targetMapEntry.dwell_detention_mins || 0) + (stop.dwell_mins - 120);
        }
      }
    };

    let cy = start.year, cm = start.month;
    while (cy * 12 + cm <= endKey) {
      const queryMonthKey = `${cy}-${String(cm).padStart(2, '0')}`;
      const monthLoads = loads_raw
        .filter((l: any) => l.month === queryMonthKey)
        .map((l: any) => {
          if (curr === 'CAD') {
            const clone = { ...l };
            clone.total_spend = (l.total_spend || 0) * rate;
            if (l.customers) {
              clone.customers = l.customers.map((c: any) => ({
                ...c,
                spend_share: (c.spend_share || 0) * rate
              }));
            }
            return clone;
          }
          return l;
        });
      filtered.push(...monthLoads);

      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }

    const totalSpend = filtered.reduce((sum: number, l: any) => sum + (l.total_spend || 0), 0);
    const totalLoads = filtered.length;

    // Day of Week — average loads per weekday occurrence in selected range
    const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dowRaw:    Record<string, number> = { Sunday:0, Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0 };
    const dowTLRaw:  Record<string, number> = { Sunday:0, Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0 };
    const dowLTLRaw: Record<string, number> = { Sunday:0, Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0 };
    filtered.forEach((l: any) => {
      if (l.dow) {
        dowRaw[l.dow]++;
        if (l.trip_type === 'TL') dowTLRaw[l.dow]++;
        else if (l.trip_type === 'LTL') dowLTLRaw[l.dow]++;
      }
    });
    // Count how many of each weekday fall in the date range
    const dowCount: Record<string, number> = { Sunday:0, Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0 };

    // Monthly Summary (initialize all months in range)
    const monthlyMap: Record<string, any> = {};
    let cyM = start.year, cmM = start.month;
    while (cyM * 12 + cmM <= endKey) {
      const monthStr = `${cyM}-${String(cmM).padStart(2, '0')}`;
      monthlyMap[monthStr] = { month: monthStr, loads: 0, tl: 0, ltl: 0, spend: 0 };
      cmM++;
      if (cmM > 12) { cmM = 1; cyM++; }
    }
    filtered.forEach((l: any) => {
      if (monthlyMap[l.month]) {
        monthlyMap[l.month].loads++;
        if (l.trip_type === 'TL') {
          monthlyMap[l.month].tl++;
        } else if (l.trip_type === 'LTL') {
          monthlyMap[l.month].ltl++;
        }
        monthlyMap[l.month].spend += (l.total_spend || 0);
      }
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Daily Summary (initialize all dates in range)
    const dailyMap: Record<string, any> = {};
    const dateList = getDatesInRange(start, end);
    dateList.forEach(d => {
      dailyMap[d] = { date: d, tl: 0, ltl: 0, total: 0 };
    });
    filtered.forEach((l: any) => {
      if (l.date && dailyMap[l.date]) {
        dailyMap[l.date].total++;
        if (l.trip_type === 'TL') {
          dailyMap[l.date].tl++;
        } else if (l.trip_type === 'LTL') {
          dailyMap[l.date].ltl++;
        }
      }
    });
    const daily = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Count weekday occurrences in range (reuse dateList)
    dateList.forEach(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dowCount[WEEKDAY_NAMES[dt.getUTCDay()]]++;
    });
    // Build averaged dow object
    const dow: Record<string, { avg: number; tl: number; ltl: number }> = {};
    WEEKDAY_NAMES.forEach(day => {
      const cnt = dowCount[day] || 1;
      dow[day] = {
        avg: Math.round((dowRaw[day] / cnt) * 10) / 10,
        tl:  Math.round((dowTLRaw[day] / cnt) * 10) / 10,
        ltl: Math.round((dowLTLRaw[day] / cnt) * 10) / 10,
      };
    });

    // Customers, Carriers, Zones, Shippers
    const custMap: Record<string, any> = {};
    const carrMap: Record<string, any> = {};
    const zonesMap: Record<string, any> = {};
    const shippersMap: Record<string, any> = {};
    const lanesMap: Record<string, any> = {};

    filtered.forEach((l: any) => {
      const cCarrier = l.carrier || 'Unknown';
      if (!carrMap[cCarrier]) {
        carrMap[cCarrier] = {
          name: cCarrier, spend: 0, loads: 0, single: 0, multi: 0, stops: 0, customers: {}, zones: {},
          dwell_eligible: 0, dwell_total_mins: 0, dwell_detention_count: 0, dwell_detention_mins: 0,
          arr_eligible: 0, arr_ontime: 0, arr_late: 0, arr_total_delay: 0
        };
      }
      carrMap[cCarrier].spend += (l.total_spend || 0);
      carrMap[cCarrier].loads++;
      carrMap[cCarrier].stops += (l.customers || []).length;
      if (l.trip_type === 'LTL') carrMap[cCarrier].multi++; else carrMap[cCarrier].single++;

      // Aggregating Driver Compliance
      const comp = l.compliance;
      if (comp) {
        if (!carrMap[cCarrier].compliance) {
          carrMap[cCarrier].compliance = {
            total: 0,
            has_phone: 0,
            has_sms: 0,
            logged_in: 0,
            accepted: 0,
            driver_delivered: 0,
            manual_close: 0,
            never_app: 0,
            close_methods: {
              driver_self: 0,
              office_manual: 0,
              office_auto: 0,
              still_open: 0
            },
            sms_to_login_sum: 0,
            sms_to_login_count: 0,
            sms_to_accept_sum: 0,
            sms_to_accept_count: 0
          };
        }
        
        globalCompliance.total++;
        if (comp.has_phone) globalCompliance.has_phone++;
        if (comp.has_sms) globalCompliance.has_sms++;
        if (comp.logged_in) globalCompliance.logged_in++;
        if (comp.accepted) globalCompliance.accepted++;
        if (comp.driver_delivered) globalCompliance.driver_delivered++;
        if (comp.manual_close) globalCompliance.manual_close++;
        if (comp.never_app) globalCompliance.never_app++;
        
        const method = comp.close_method || 'still_open';
        globalCompliance.close_methods[method] = (globalCompliance.close_methods[method] || 0) + 1;
        
        if (comp.sms_to_login_h != null) {
          globalCompliance.sms_to_login_sum += comp.sms_to_login_h;
          globalCompliance.sms_to_login_count++;
        }
        if (comp.sms_to_accept_h != null) {
          globalCompliance.sms_to_accept_sum += comp.sms_to_accept_h;
          globalCompliance.sms_to_accept_count++;
        }

        const carrComp = carrMap[cCarrier].compliance;
        carrComp.total++;
        if (comp.has_phone) carrComp.has_phone++;
        if (comp.has_sms) carrComp.has_sms++;
        if (comp.logged_in) carrComp.logged_in++;
        if (comp.accepted) carrComp.accepted++;
        if (comp.driver_delivered) carrComp.driver_delivered++;
        if (comp.manual_close) carrComp.manual_close++;
        if (comp.never_app) carrComp.never_app++;
        carrComp.close_methods[method] = (carrComp.close_methods[method] || 0) + 1;
        if (comp.sms_to_login_h != null) {
          carrComp.sms_to_login_sum += comp.sms_to_login_h;
          carrComp.sms_to_login_count++;
        }
        if (comp.sms_to_accept_h != null) {
          carrComp.sms_to_accept_sum += comp.sms_to_accept_h;
          carrComp.sms_to_accept_count++;
        }
      }

      (l.customers || []).forEach((c: any) => {
        const cName = c.name;
        const cSpend = c.spend_share || 0;
        const cState = c.state || 'Unknown';
        const cZoneMeso = c.zone?.mesoName || 'Unknown';
        const cZoneMacro = c.zone?.macroName || 'Unknown';

        if (!custMap[cName]) {
          custMap[cName] = {
            name: cName,
            spend: 0,
            loads: 0,
            single: 0,
            multi: 0,
            tl_loads: 0,
            ltl_loads: 0,
            total_loads: 0,
            total_drops: 0,
            carriers: {},
            locations: {},
            delivery_points: {},
            zone: '',
            dwell_eligible: 0,
            dwell_total_mins: 0,
            dwell_detention_count: 0,
            dwell_detention_mins: 0,
            arr_eligible: 0,
            arr_ontime: 0,
            arr_late: 0,
            arr_total_delay: 0
          };
        }
        processStopOTD(c, custMap[cName]);
        processStopOTD(c, carrMap[cCarrier]);
        processStopOTD(c, globalOTDStats);
        
        processStopDwell(c, custMap[cName]);
        processStopDwell(c, carrMap[cCarrier]);
        processStopDwell(c, globalDwellStats);

        processStopArrival(c, custMap[cName]);
        processStopArrival(c, carrMap[cCarrier]);
        processStopArrival(c, globalArrivalStats, true);

        const total_drops_on_load = (l.customers || []).length || 1;
        const drop_share = 1 / total_drops_on_load;

        const cAddress = c.address || 'Unknown Address';
        if (!custMap[cName].delivery_points[cAddress]) {
          custMap[cName].delivery_points[cAddress] = {
            address: cAddress,
            city: c.city || 'Unknown',
            state: cState,
            loads: 0,
            drops: 0,
            otd_eligible: 0,
            otd_ontime: 0,
            otd_late: 0,
            otd_total_delay: 0,
            dwell_eligible: 0,
            dwell_total_mins: 0,
            dwell_detention_count: 0,
            dwell_detention_mins: 0,
            arr_eligible: 0,
            arr_ontime: 0,
            arr_late: 0,
            arr_total_delay: 0
          };
        }
        const dp = custMap[cName].delivery_points[cAddress];
        dp.loads += drop_share;
        dp.drops = (dp.drops || 0) + 1;
        processStopOTD(c, dp);
        processStopDwell(c, dp);
        processStopArrival(c, dp);


        custMap[cName].spend += cSpend;
        custMap[cName].loads++;
        custMap[cName].total_drops = (custMap[cName].total_drops || 0) + 1;
        if (l.trip_type === 'LTL') {
          custMap[cName].multi++;
          custMap[cName].ltl_loads += drop_share;
        } else {
          custMap[cName].single++;
          custMap[cName].tl_loads += 1.0;
        }
        custMap[cName].total_loads += drop_share;

        const isCanada = cZoneMacro.toLowerCase().includes('canada') ||
          ['QC','ON','BC','AB','SK','MB','NS','NB','PE','NL','YT','NT','NU'].includes(cState);
        const flag = isCanada ? '🇨🇦 Canada' : '🇺🇸 USA';
        if (!custMap[cName].zone) {
          custMap[cName].zone = flag;
        } else if (custMap[cName].zone !== flag && !custMap[cName].zone.includes('/')) {
          custMap[cName].zone = '🇺🇸 USA / 🇨🇦 Canada';
        }

        if (!custMap[cName].carriers[cCarrier]) {
          custMap[cName].carriers[cCarrier] = { single: 0, multi: 0, loads: 0, drops: 0 };
        }
        const cc = custMap[cName].carriers[cCarrier];
        cc.drops += 1;
        cc.loads += drop_share;
        if (l.trip_type === 'LTL') {
          cc.multi += drop_share;
        } else {
          cc.single += 1.0;
        }
        if (!custMap[cName].locations[cState]) {
          custMap[cName].locations[cState] = { name: cState, loads: 0, single: 0, multi: 0, cities: {} };
        }
        custMap[cName].locations[cState].loads++;
        if (l.trip_type === 'LTL') custMap[cName].locations[cState].multi++;
        else custMap[cName].locations[cState].single++;

        const cCity = c.city || 'Unknown';
        if (!custMap[cName].locations[cState].cities[cCity]) {
          custMap[cName].locations[cState].cities[cCity] = { name: cCity, loads: 0, single: 0, multi: 0 };
        }
        custMap[cName].locations[cState].cities[cCity].loads++;
        if (l.trip_type === 'LTL') custMap[cName].locations[cState].cities[cCity].multi++;
        else custMap[cName].locations[cState].cities[cCity].single++;

        if (!carrMap[cCarrier].customers[cName]) {
          carrMap[cCarrier].customers[cName] = { loads: 0, spend: 0, single: 0, multi: 0, locations: {} };
        }
        carrMap[cCarrier].customers[cName].loads++;
        carrMap[cCarrier].customers[cName].spend += cSpend;
        if (l.trip_type === 'LTL') {
          carrMap[cCarrier].customers[cName].multi++;
        } else {
          carrMap[cCarrier].customers[cName].single++;
        }
        
        const locationKey = `${cCity}, ${cState}`;
        if (!carrMap[cCarrier].customers[cName].locations[locationKey]) {
          carrMap[cCarrier].customers[cName].locations[locationKey] = { stops: 0, spend: 0, single: 0, multi: 0 };
        }
        carrMap[cCarrier].customers[cName].locations[locationKey].stops++;
        carrMap[cCarrier].customers[cName].locations[locationKey].spend += cSpend;
        if (l.trip_type === 'LTL') {
          carrMap[cCarrier].customers[cName].locations[locationKey].multi++;
        } else {
          carrMap[cCarrier].customers[cName].locations[locationKey].single++;
        }

        if (!carrMap[cCarrier].zones[cZoneMeso]) carrMap[cCarrier].zones[cZoneMeso] = { loads: 0, spend: 0 };
        carrMap[cCarrier].zones[cZoneMeso].loads++;
        carrMap[cCarrier].zones[cZoneMeso].spend += cSpend;

        if (!zonesMap[cZoneMeso]) {
          zonesMap[cZoneMeso] = { zone: cZoneMeso, macro: cZoneMacro, loads: 0, spend: 0, single: 0, multi: 0, carriers: {}, customers: {}, load_ids: new Set() };
        }
        if (!zonesMap[cZoneMeso].load_ids.has(l.id)) {
          zonesMap[cZoneMeso].loads++;
          zonesMap[cZoneMeso].load_ids.add(l.id);
          if (l.trip_type === 'LTL') zonesMap[cZoneMeso].multi++; else zonesMap[cZoneMeso].single++;
        }
        zonesMap[cZoneMeso].spend += cSpend;
        zonesMap[cZoneMeso].carriers[cCarrier] = (zonesMap[cZoneMeso].carriers[cCarrier] || 0) + 1;
        if (!zonesMap[cZoneMeso].customers[cName]) zonesMap[cZoneMeso].customers[cName] = { name: cName, loads: 0, spend: 0 };
        zonesMap[cZoneMeso].customers[cName].loads++;
        zonesMap[cZoneMeso].customers[cName].spend += cSpend;
      }); // end l.customers.forEach

      // ─── Shippers aggregation (at filtered.forEach level) ───
      (l.shippers || []).forEach((sh: any) => {
        const shName = sh.name || 'Unknown';
        const shState = sh.state || 'Unknown';
        const shCity = sh.city || 'Unknown';
        const shZoneMeso = sh.zone?.mesoName || 'Unknown';
        const shZoneMacro = sh.zone?.macroName || 'Unknown';

        if (!shippersMap[shName]) {
          shippersMap[shName] = {
            name: shName,
            loads: 0,
            tl_loads: 0,
            ltl_loads: 0,
            total_pickups: 0,
            carriers: {},
            locations: {},
            destinations: {},
            pickup_points: {},
            zone: '',
            dwell_eligible: 0,
            dwell_total_mins: 0,
            dwell_detention_count: 0,
            dwell_detention_mins: 0,
            arr_eligible: 0,
            arr_ontime: 0,
            arr_late: 0,
            arr_total_delay: 0
          };
        }
        processStopOTD(sh, shippersMap[shName]);
        processStopOTD(sh, carrMap[cCarrier]);
        processStopOTD(sh, globalOTDStats);

        processStopDwell(sh, shippersMap[shName]);
        processStopDwell(sh, carrMap[cCarrier]);
        processStopDwell(sh, globalDwellStats);

        processStopArrival(sh, shippersMap[shName]);
        processStopArrival(sh, carrMap[cCarrier]);
        processStopArrival(sh, globalArrivalStats, true);

        const shAddress = sh.address || 'Unknown Address';
        if (!shippersMap[shName].pickup_points[shAddress]) {
          shippersMap[shName].pickup_points[shAddress] = {
            address: shAddress,
            city: shCity,
            state: shState,
            loads: 0,
            pickups: 0,
            otd_eligible: 0,
            otd_ontime: 0,
            otd_late: 0,
            otd_total_delay: 0,
            dwell_eligible: 0,
            dwell_total_mins: 0,
            dwell_detention_count: 0,
            dwell_detention_mins: 0,
            arr_eligible: 0,
            arr_ontime: 0,
            arr_late: 0,
            arr_total_delay: 0
          };
        }
        const pp = shippersMap[shName].pickup_points[shAddress];
        pp.loads += 1; // Pickups are 1.0 load
        pp.pickups = (pp.pickups || 0) + 1;
        processStopOTD(sh, pp);
        processStopDwell(sh, pp);
        processStopArrival(sh, pp);

        shippersMap[shName].total_pickups += 1;
        shippersMap[shName].loads += 1;
        if (l.trip_type === 'LTL') {
          shippersMap[shName].ltl_loads += 1;
        } else {
          shippersMap[shName].tl_loads += 1;
        }

        const isCanadaSh = shZoneMacro.toLowerCase().includes('canada') ||
          ['QC','ON','BC','AB','SK','MB','NS','NB','PE','NL','YT','NT','NU'].includes(shState);
        const flagSh = isCanadaSh ? '🇨🇦 Canada' : '🇺🇸 USA';
        if (!shippersMap[shName].zone) {
          shippersMap[shName].zone = flagSh;
        } else if (shippersMap[shName].zone !== flagSh && !shippersMap[shName].zone.includes('/')) {
          shippersMap[shName].zone = '🇺🇸 USA / 🇨🇦 Canada';
        }

        if (!shippersMap[shName].carriers[cCarrier]) {
          shippersMap[shName].carriers[cCarrier] = { loads: 0, tl: 0, ltl: 0 };
        }
        shippersMap[shName].carriers[cCarrier].loads += 1;
        if (l.trip_type === 'LTL') shippersMap[shName].carriers[cCarrier].ltl += 1;
        else shippersMap[shName].carriers[cCarrier].tl += 1;

        if (!shippersMap[shName].locations[shState]) {
          shippersMap[shName].locations[shState] = { name: shState, loads: 0, cities: {} };
        }
        shippersMap[shName].locations[shState].loads += 1;
        if (!shippersMap[shName].locations[shState].cities[shCity]) {
          shippersMap[shName].locations[shState].cities[shCity] = { name: shCity, loads: 0 };
        }
        shippersMap[shName].locations[shState].cities[shCity].loads += 1;

        (l.customers || []).forEach((dest: any) => {
          const destState = dest.state || 'Unknown';
          const destZone = dest.zone?.mesoName || 'Unknown';
          const destCity = dest.city || 'Unknown';
          if (!shippersMap[shName].destinations[destState]) {
            shippersMap[shName].destinations[destState] = { name: destState, zone: destZone, loads: 0, cities: {} };
          }
          shippersMap[shName].destinations[destState].loads += 1;
          if (!shippersMap[shName].destinations[destState].cities[destCity]) {
            shippersMap[shName].destinations[destState].cities[destCity] = { name: destCity, loads: 0 };
          }
          shippersMap[shName].destinations[destState].cities[destCity].loads += 1;
        });
      });

      // Lanes aggregation
      const lShippers = l.shippers || [];
      const lCustomers = l.customers || [];
      if ((l.total_spend || 0) > 0 && lShippers.length > 0 && lCustomers.length > 0) {
        const numShippers = lShippers.length;
        const numCustomers = lCustomers.length;
        lShippers.forEach((sh: any) => {
          const shName = sh.name || 'Unknown';
          const shCity = sh.city || 'Unknown';
          const shState = sh.state || 'Unknown';
          lCustomers.forEach((cust: any) => {
            const custName = cust.name || 'Unknown';
            const custCity = cust.city || 'Unknown';
            const custState = cust.state || 'Unknown';
            const laneKey = `${shName} ➔ ${custName}`;
            const dropShare = 1 / numCustomers;
            const loadContrib = dropShare / numShippers;
            const spendShare = (cust.spend_share || 0) / numShippers;

            if (!lanesMap[laneKey]) {
              lanesMap[laneKey] = {
                key: laneKey,
                shipper: shName,
                receiver: custName,
                shipperCity: `${shCity}, ${shState}`,
                receiverCity: `${custCity}, ${custState}`,
                loads: 0,
                spend: 0,
                tl_loads: 0,
                ltl_loads: 0,
                carriers: {},
                arr_eligible: 0,
                arr_ontime: 0,
                arr_late: 0,
                arr_total_delay: 0
              };
            }
            const lane = lanesMap[laneKey];
            lane.loads += loadContrib;
            lane.spend += spendShare;
            if (l.trip_type === 'LTL') {
              lane.ltl_loads += loadContrib;
            } else {
              lane.tl_loads += loadContrib;
            }
            if (!lane.carriers[cCarrier]) {
              lane.carriers[cCarrier] = {
                name: cCarrier,
                loads: 0,
                spend: 0,
                tl_loads: 0,
                ltl_loads: 0,
                arr_eligible: 0,
                arr_ontime: 0,
                arr_late: 0,
                arr_total_delay: 0
              };
            }
            const lc = lane.carriers[cCarrier];
            lc.loads += loadContrib;
            lc.spend += spendShare;
            if (l.trip_type === 'LTL') {
              lc.ltl_loads += loadContrib;
            } else {
              lc.tl_loads += loadContrib;
            }
            processStopOTD(cust, lane);
            processStopOTD(cust, lc);
            processStopArrival(cust, lane);
            processStopArrival(cust, lc);
          });
        });
      }
    }); // end filtered.forEach

    const customers = Object.values(custMap).map((c: any) => {
      const eligible = c.otd_eligible || 0;
      const ontime = c.otd_ontime || 0;
      const late = c.otd_late || 0;
      const totalDelay = c.otd_total_delay || 0;
      const otdPercent = eligible > 0 ? (ontime / eligible) * 100 : 0;
      const avgDelayHours = late > 0 ? (totalDelay / late) / 60 : 0;

      // Dwell times
      const dwellEligible = c.dwell_eligible || 0;
      const dwellTotalMins = c.dwell_total_mins || 0;
      const dwellDetentionCount = c.dwell_detention_count || 0;
      const dwellDetentionMins = c.dwell_detention_mins || 0;
      const avgDwellMins = dwellEligible > 0 ? (dwellTotalMins / dwellEligible) : 0;
      const detentionRisk = dwellEligible > 0 ? (dwellDetentionCount / dwellEligible) * 100 : 0;
      const avgDetentionMins = dwellDetentionCount > 0 ? (dwellDetentionMins / dwellDetentionCount) : 0;

      // Arrival delays
      const arrEligible = c.arr_eligible || 0;
      const arrOntime = c.arr_ontime || 0;
      const arrLate = c.arr_late || 0;
      const arrTotalDelay = c.arr_total_delay || 0;
      const otaPercent = arrEligible > 0 ? (arrOntime / arrEligible) * 100 : 0;
      const avgArrDelayHours = arrLate > 0 ? (arrTotalDelay / arrLate) / 60 : 0;

      const deliveryPointsList = Object.values(c.delivery_points || {}).map((dp: any) => {
        const dpEligible = dp.otd_eligible || 0;
        const dpOntime = dp.otd_ontime || 0;
        const dpLate = dp.otd_late || 0;
        const dpTotalDelay = dp.otd_total_delay || 0;
        const dpOtdPercent = dpEligible > 0 ? (dpOntime / dpEligible) * 100 : 100;
        const dpAvgDelayHours = dpLate > 0 ? (dpTotalDelay / dpLate) / 60 : 0;

        const dpDwellEligible = dp.dwell_eligible || 0;
        const dpDwellTotalMins = dp.dwell_total_mins || 0;
        const dpDwellDetentionCount = dp.dwell_detention_count || 0;
        const dpDwellDetentionMins = dp.dwell_detention_mins || 0;
        const dpAvgDwellMins = dpDwellEligible > 0 ? (dpDwellTotalMins / dpDwellEligible) : 0;
        const dpDetentionRisk = dpDwellEligible > 0 ? (dpDwellDetentionCount / dpDwellEligible) * 100 : 0;
        const dpAvgDetentionMins = dpDwellDetentionCount > 0 ? (dpDwellDetentionMins / dpDwellDetentionCount) : 0;

        const dpArrEligible = dp.arr_eligible || 0;
        const dpArrOntime = dp.arr_ontime || 0;
        const dpArrLate = dp.arr_late || 0;
        const dpArrTotalDelay = dp.arr_total_delay || 0;
        const dpOtaPercent = dpArrEligible > 0 ? (dpArrOntime / dpArrEligible) * 100 : 100;
        const dpAvgArrDelayHours = dpArrLate > 0 ? (dpArrTotalDelay / dpArrLate) / 60 : 0;

        return {
          ...dp,
          otd_eligible: dpEligible,
          otd_ontime: dpOntime,
          otd_percent: Math.round(dpOtdPercent * 10) / 10,
          otd_avg_delay: Math.round(dpAvgDelayHours * 10) / 10,
          dwell_eligible: dpDwellEligible,
          dwell_total_mins: dpDwellTotalMins,
          dwell_detention_count: dpDwellDetentionCount,
          dwell_detention_mins: dpDwellDetentionMins,
          avg_dwell_mins: Math.round(dpAvgDwellMins),
          detention_risk: Math.round(dpDetentionRisk * 10) / 10,
          avg_detention_mins: Math.round(dpAvgDetentionMins),
          arr_eligible: dpArrEligible,
          arr_ontime: dpArrOntime,
          arr_late: dpArrLate,
          arr_total_delay: dpArrTotalDelay,
          ota_percent: Math.round(dpOtaPercent * 10) / 10,
          avg_arr_delay: Math.round(dpAvgArrDelayHours * 10) / 10
        };
      }).sort((a, b) => b.loads - a.loads);

      return {
        ...c,
        otd_eligible: eligible,
        otd_ontime: ontime,
        otd_percent: Math.round(otdPercent * 10) / 10,
        otd_avg_delay: Math.round(avgDelayHours * 10) / 10,
        dwell_eligible: dwellEligible,
        dwell_total_mins: dwellTotalMins,
        dwell_detention_count: dwellDetentionCount,
        dwell_detention_mins: dwellDetentionMins,
        avg_dwell_mins: Math.round(avgDwellMins),
        detention_risk: Math.round(detentionRisk * 10) / 10,
        avg_detention_mins: Math.round(avgDetentionMins),
        arr_eligible: arrEligible,
        arr_ontime: arrOntime,
        arr_late: arrLate,
        arr_total_delay: arrTotalDelay,
        ota_percent: Math.round(otaPercent * 10) / 10,
        avg_arr_delay: Math.round(avgArrDelayHours * 10) / 10,
        top_carrier: Object.entries(c.carriers).sort((a: any, b: any) => b[1].loads - a[1].loads)[0]?.[0] || null,
        delivery_points: deliveryPointsList
      };
    });
    const carriers = Object.values(carrMap).map((c: any) => {
      const eligible = c.otd_eligible || 0;
      const ontime = c.otd_ontime || 0;
      const late = c.otd_late || 0;
      const totalDelay = c.otd_total_delay || 0;
      const otdPercent = eligible > 0 ? (ontime / eligible) * 100 : 0;
      const avgDelayHours = late > 0 ? (totalDelay / late) / 60 : 0;

      // Dwell times
      const dwellEligible = c.dwell_eligible || 0;
      const dwellTotalMins = c.dwell_total_mins || 0;
      const dwellDetentionCount = c.dwell_detention_count || 0;
      const dwellDetentionMins = c.dwell_detention_mins || 0;
      const avgDwellMins = dwellEligible > 0 ? (dwellTotalMins / dwellEligible) : 0;
      const detentionRisk = dwellEligible > 0 ? (dwellDetentionCount / dwellEligible) * 100 : 0;
      const avgDetentionMins = dwellDetentionCount > 0 ? (dwellDetentionMins / dwellDetentionCount) : 0;

      // Compliance
      const comp = c.compliance || { total: 0 };
      const totalComp = comp.total || 0;
      const adoption_rate = totalComp > 0 ? (comp.logged_in / totalComp) * 100 : 100;
      const self_close_rate = totalComp > 0 ? (comp.driver_delivered / totalComp) * 100 : 0;
      const manual_close_rate = totalComp > 0 ? (comp.manual_close / totalComp) * 100 : 0;
      const phone_assigned_rate = totalComp > 0 ? (comp.has_phone / totalComp) * 100 : 0;
      const avg_sms_to_login = comp.sms_to_login_count > 0 ? (comp.sms_to_login_sum / comp.sms_to_login_count) : null;

      return {
        ...c,
        avg: c.loads > 0 ? Math.round(c.spend / c.loads) : 0,
        customer_count: Object.keys(c.customers).length,
        rate: eligible > 0 ? Math.round(otdPercent * 10) / 10 : 100,
        otd_eligible: eligible,
        otd_ontime: ontime,
        otd_percent: eligible > 0 ? Math.round(otdPercent * 10) / 10 : 100,
        otd_avg_delay: Math.round(avgDelayHours * 10) / 10,
        otd_late_only: c.otd_late_only || 0,
        otd_severe_late: c.otd_severe_late || 0,
        dwell_eligible: dwellEligible,
        dwell_total_mins: dwellTotalMins,
        dwell_detention_count: dwellDetentionCount,
        dwell_detention_mins: dwellDetentionMins,
        avg_dwell_mins: Math.round(avgDwellMins),
        detention_risk: Math.round(detentionRisk * 10) / 10,
        avg_detention_mins: Math.round(avgDetentionMins),
        arr_eligible: c.arr_eligible || 0,
        arr_ontime: c.arr_ontime || 0,
        arr_late: c.arr_late || 0,
        arr_total_delay: c.arr_total_delay || 0,
        ota_percent: (c.arr_eligible || 0) > 0 ? Math.round(((c.arr_ontime || 0) / c.arr_eligible) * 100 * 10) / 10 : 100,
        avg_arr_delay: (c.arr_late || 0) > 0 ? Math.round(((c.arr_total_delay || 0) / c.arr_late) / 60 * 10) / 10 : 0,
        compliance: {
          total: totalComp,
          logged_in: comp.logged_in || 0,
          driver_delivered: comp.driver_delivered || 0,
          manual_close: comp.manual_close || 0,
          has_phone: comp.has_phone || 0,
          adoption_rate: Math.round(adoption_rate * 10) / 10,
          self_close_rate: Math.round(self_close_rate * 10) / 10,
          manual_close_rate: Math.round(manual_close_rate * 10) / 10,
          phone_assigned_rate: Math.round(phone_assigned_rate * 10) / 10,
          avg_sms_to_login: avg_sms_to_login != null ? Math.round(avg_sms_to_login * 10) / 10 : null
        },
        top_customer: Object.entries(c.customers).sort((a: any, b: any) => b[1].loads - a[1].loads)[0]?.[0] || null,
        top_zone: Object.entries(c.zones).sort((a: any, b: any) => b[1].loads - a[1].loads)[0]?.[0] || null
      };
    });
    const zones = Object.values(zonesMap).map((z: any) => {
      const { load_ids, ...rest } = z;
      return { ...rest, avg: rest.loads > 0 ? Math.round(rest.spend / rest.loads) : 0 };
    });

    let totalPickups = 0;
    let totalDeliveries = 0;
    let tlStops = 0;
    let ltlStops = 0;

    filtered.forEach((l: any) => {
      const picks = l.picks_count || 1;
      const drops = l.drops_count || (l.customers || []).length;
      totalPickups += picks;
      totalDeliveries += drops;
      if (l.trip_type === 'LTL') {
        ltlStops += drops;
      } else {
        tlStops += drops;
      }
    });

    const shippers = Object.values(shippersMap).map((s: any) => {
      const eligible = s.otd_eligible || 0;
      const ontime = s.otd_ontime || 0;
      const late = s.otd_late || 0;
      const totalDelay = s.otd_total_delay || 0;
      const otdPercent = eligible > 0 ? (ontime / eligible) * 100 : 0;
      const avgDelayHours = late > 0 ? (totalDelay / late) / 60 : 0;

      // Dwell times
      const dwellEligible = s.dwell_eligible || 0;
      const dwellTotalMins = s.dwell_total_mins || 0;
      const dwellDetentionCount = s.dwell_detention_count || 0;
      const dwellDetentionMins = s.dwell_detention_mins || 0;
      const avgDwellMins = dwellEligible > 0 ? (dwellTotalMins / dwellEligible) : 0;
      const detentionRisk = dwellEligible > 0 ? (dwellDetentionCount / dwellEligible) * 100 : 0;
      const avgDetentionMins = dwellDetentionCount > 0 ? (dwellDetentionMins / dwellDetentionCount) : 0;

      // Arrival delays
      const arrEligible = s.arr_eligible || 0;
      const arrOntime = s.arr_ontime || 0;
      const arrLate = s.arr_late || 0;
      const arrTotalDelay = s.arr_total_delay || 0;
      const otaPercent = arrEligible > 0 ? (arrOntime / arrEligible) * 100 : 0;
      const avgArrDelayHours = arrLate > 0 ? (arrTotalDelay / arrLate) / 60 : 0;

      const pickupPointsList = Object.values(s.pickup_points || {}).map((pp: any) => {
        const ppEligible = pp.otd_eligible || 0;
        const ppOntime = pp.otd_ontime || 0;
        const ppLate = pp.otd_late || 0;
        const ppTotalDelay = pp.otd_total_delay || 0;
        const ppOtdPercent = ppEligible > 0 ? (ppOntime / ppEligible) * 100 : 100;
        const ppAvgDelayHours = ppLate > 0 ? (ppTotalDelay / ppLate) / 60 : 0;

        const ppDwellEligible = pp.dwell_eligible || 0;
        const ppDwellTotalMins = pp.dwell_total_mins || 0;
        const ppDwellDetentionCount = pp.dwell_detention_count || 0;
        const ppDwellDetentionMins = pp.dwell_detention_mins || 0;
        const ppAvgDwellMins = ppDwellEligible > 0 ? (ppDwellTotalMins / ppDwellEligible) : 0;
        const ppDetentionRisk = ppDwellEligible > 0 ? (ppDwellDetentionCount / ppDwellEligible) * 100 : 0;
        const ppAvgDetentionMins = ppDwellDetentionCount > 0 ? (ppDwellDetentionMins / ppDwellDetentionCount) : 0;

        const ppArrEligible = pp.arr_eligible || 0;
        const ppArrOntime = pp.arr_ontime || 0;
        const ppArrLate = pp.arr_late || 0;
        const ppArrTotalDelay = pp.arr_total_delay || 0;
        const ppOtaPercent = ppArrEligible > 0 ? (ppArrOntime / ppArrEligible) * 100 : 100;
        const ppAvgArrDelayHours = ppArrLate > 0 ? (ppArrTotalDelay / ppArrLate) / 60 : 0;

        return {
          ...pp,
          otd_eligible: ppEligible,
          otd_ontime: ppOntime,
          otd_percent: Math.round(ppOtdPercent * 10) / 10,
          otd_avg_delay: Math.round(ppAvgDelayHours * 10) / 10,
          dwell_eligible: ppDwellEligible,
          dwell_total_mins: ppDwellTotalMins,
          dwell_detention_count: ppDwellDetentionCount,
          dwell_detention_mins: ppDwellDetentionMins,
          avg_dwell_mins: Math.round(ppAvgDwellMins),
          detention_risk: Math.round(ppDetentionRisk * 10) / 10,
          avg_detention_mins: Math.round(ppAvgDetentionMins),
          arr_eligible: ppArrEligible,
          arr_ontime: ppArrOntime,
          arr_late: ppArrLate,
          arr_total_delay: ppArrTotalDelay,
          ota_percent: Math.round(ppOtaPercent * 10) / 10,
          avg_arr_delay: Math.round(ppAvgArrDelayHours * 10) / 10
        };
      }).sort((a, b) => b.loads - a.loads);

      return {
        ...s,
        otd_eligible: eligible,
        otd_ontime: ontime,
        otd_percent: Math.round(otdPercent * 10) / 10,
        otd_avg_delay: Math.round(avgDelayHours * 10) / 10,
        dwell_eligible: dwellEligible,
        dwell_total_mins: dwellTotalMins,
        dwell_detention_count: dwellDetentionCount,
        dwell_detention_mins: dwellDetentionMins,
        avg_dwell_mins: Math.round(avgDwellMins),
        detention_risk: Math.round(detentionRisk * 10) / 10,
        avg_detention_mins: Math.round(avgDetentionMins),
        arr_eligible: arrEligible,
        arr_ontime: arrOntime,
        arr_late: arrLate,
        arr_total_delay: arrTotalDelay,
        ota_percent: Math.round(otaPercent * 10) / 10,
        avg_arr_delay: Math.round(avgArrDelayHours * 10) / 10,
        top_carrier: Object.entries(s.carriers).sort((a: any, b: any) => b[1].loads - a[1].loads)[0]?.[0] || null,
        pickup_points: pickupPointsList
      };
    });

    const lanes = Object.values(lanesMap).map((lane: any) => {
      const carriersList = Object.values(lane.carriers).map((c: any) => {
        const eligible = c.otd_eligible || 0;
        const ontime = c.otd_ontime || 0;
        const late = c.otd_late || 0;
        const totalDelay = c.otd_total_delay || 0;
        const otdPercent = eligible > 0 ? (ontime / eligible) * 100 : 0;
        const avgDelayHours = late > 0 ? (totalDelay / late) / 60 : 0;
        const arrEligible = c.arr_eligible || 0;
        const arrOntime = c.arr_ontime || 0;
        const arrLate = c.arr_late || 0;
        const arrTotalDelay = c.arr_total_delay || 0;
        const otaPercent = arrEligible > 0 ? (arrOntime / arrEligible) * 100 : 100;
        const avgArrDelayHours = arrLate > 0 ? (arrTotalDelay / arrLate) / 60 : 0;
        return {
          ...c,
          avg_rate: c.loads > 0 ? c.spend / c.loads : 0,
          otd_eligible: eligible,
          otd_ontime: ontime,
          otd_percent: eligible > 0 ? Math.round(otdPercent * 10) / 10 : 100,
          otd_avg_delay: Math.round(avgDelayHours * 10) / 10,
          arr_eligible: arrEligible,
          arr_ontime: arrOntime,
          arr_late: arrLate,
          arr_total_delay: arrTotalDelay,
          ota_percent: Math.round(otaPercent * 10) / 10,
          avg_arr_delay: Math.round(avgArrDelayHours * 10) / 10
        };
      });

      // Sort carriers by loads to find dominant carrier
      const sortedByLoads = [...carriersList].sort((a: any, b: any) => b.loads - a.loads);
      const dominantCarrier = sortedByLoads[0]?.name || 'Unknown';

      // Sort carriers by average rate to find cheapest carrier
      const viableCarriers = carriersList.filter(c => c.loads > 0 && c.spend > 0);
      const cheapestCarrierObj = viableCarriers.length > 0
        ? [...viableCarriers].sort((a, b) => a.avg_rate - b.avg_rate)[0]
        : null;

      const cheapestCarrier = cheapestCarrierObj ? cheapestCarrierObj.name : 'Unknown';
      const cheapestRate = cheapestCarrierObj ? cheapestCarrierObj.avg_rate : 0;

      // Calculate rate leakage (savings potential)
      let leakage = 0;
      if (cheapestCarrierObj) {
        carriersList.forEach((c: any) => {
          if (c.name !== cheapestCarrier) {
            const diff = c.avg_rate - cheapestRate;
            if (diff > 0) {
              leakage += diff * c.loads;
            }
          }
        });
      }

      const carriersCount = carriersList.length;

      const eligible = lane.otd_eligible || 0;
      const ontime = lane.otd_ontime || 0;
      const late = lane.otd_late || 0;
      const totalDelay = lane.otd_total_delay || 0;
      const otdPercent = eligible > 0 ? (ontime / eligible) * 100 : 0;
      const avgDelayHours = late > 0 ? (totalDelay / late) / 60 : 0;

      const arrEligible = lane.arr_eligible || 0;
      const arrOntime = lane.arr_ontime || 0;
      const arrLate = lane.arr_late || 0;
      const arrTotalDelay = lane.arr_total_delay || 0;
      const otaPercent = arrEligible > 0 ? (arrOntime / arrEligible) * 100 : 100;
      const avgArrDelayHours = arrLate > 0 ? (arrTotalDelay / arrLate) / 60 : 0;

      return {
        ...lane,
        otd_eligible: eligible,
        otd_ontime: ontime,
        otd_percent: eligible > 0 ? Math.round(otdPercent * 10) / 10 : 100,
        otd_avg_delay: Math.round(avgDelayHours * 10) / 10,
        arr_eligible: arrEligible,
        arr_ontime: arrOntime,
        arr_late: arrLate,
        arr_total_delay: arrTotalDelay,
        ota_percent: Math.round(otaPercent * 10) / 10,
        avg_arr_delay: Math.round(avgArrDelayHours * 10) / 10,
        avg_rate: lane.loads > 0 ? lane.spend / lane.loads : 0,
        carriers: carriersList.sort((a, b) => b.loads - a.loads),
        dominant_carrier: dominantCarrier,
        cheapest_carrier: cheapestCarrier,
        cheapest_rate: cheapestRate,
        leakage: Math.round(leakage * 10) / 10,
        carriers_count: carriersCount
      };
    });

    const globalEligible = globalOTDStats.otd_eligible || 0;
    const globalOntime = globalOTDStats.otd_ontime || 0;
    const globalLate = globalOTDStats.otd_late || 0;
    const globalTotalDelay = globalOTDStats.otd_total_delay || 0;
    const globalOtdPercent = globalEligible > 0 ? (globalOntime / globalEligible) * 100 : 0;
    const globalAvgDelayHours = globalLate > 0 ? (globalTotalDelay / globalLate) / 60 : 0;

    return { 
      filtered, 
      totalLoads, 
      totalSpend, 
      avgLoad: totalLoads > 0 ? totalSpend / totalLoads : 0, 
      singleStops: filtered.filter((l: any) => l.trip_type === 'TL').length, 
      multiStops: filtered.filter((l: any) => l.trip_type === 'LTL').length, 
      totalPickups,
      totalDeliveries,
      tlStops,
      ltlStops,
      dow, 
      monthly, 
      daily,
      customers, 
      carriers, 
      zones,
      shippers,
      lanes,
      globalCompliance,
      globalDwell: {
        eligible: globalDwellStats.dwell_eligible || 0,
        total_mins: globalDwellStats.dwell_total_mins || 0,
        detention_count: globalDwellStats.dwell_detention_count || 0,
        detention_mins: globalDwellStats.dwell_detention_mins || 0,
        avg_dwell_mins: globalDwellStats.dwell_eligible > 0 ? Math.round(globalDwellStats.dwell_total_mins / globalDwellStats.dwell_eligible) : 0,
        detention_risk: globalDwellStats.dwell_eligible > 0 ? Math.round((globalDwellStats.dwell_detention_count / globalDwellStats.dwell_eligible) * 100 * 10) / 10 : 0
      },
      globalOTD: {
        eligible: globalEligible,
        ontime: globalOntime,
        late: globalLate,
        severe_late: globalOTDStats.otd_severe_late || 0,
        late_only: globalOTDStats.otd_late_only || 0,
        percent: Math.round(globalOtdPercent * 10) / 10,
        avgDelay: Math.round(globalAvgDelayHours * 10) / 10
      },
      globalArrival: {
        eligible: globalArrivalStats.arr_eligible || 0,
        ontime: globalArrivalStats.arr_ontime || 0,
        late: globalArrivalStats.arr_late || 0,
        percent: (globalArrivalStats.arr_eligible || 0) > 0 ? Math.round(((globalArrivalStats.arr_ontime || 0) / globalArrivalStats.arr_eligible) * 100 * 10) / 10 : 100,
        avgDelay: (globalArrivalStats.arr_late || 0) > 0 ? Math.round(((globalArrivalStats.arr_total_delay || 0) / globalArrivalStats.arr_late) / 60 * 10) / 10 : 0
      },
      globalHourlyDelays: Object.values(globalHourlyDelays).map(h => ({
        hour: h.hour,
        label: `${h.hour % 12 === 0 ? 12 : h.hour % 12} ${h.hour >= 12 ? 'PM' : 'AM'}`,
        avgDelay: h.count > 0 ? Math.round((h.total_delay_mins / h.count) / 60 * 10) / 10 : 0,
        count: h.count
      })),
      globalWeekdayDelays: WEEKDAY_NAMES_LIST.map(day => {
        const w = globalWeekdayDelays[day];
        return {
          day: w.day,
          avgDelay: w.count > 0 ? Math.round((w.total_delay_mins / w.count) / 60 * 10) / 10 : 0,
          count: w.count
        };
      })
    };
  };

  // ─── Primary data ───
  const primaryData = useMemo(
    () => getAggregatedData(startDate, endDate, currency, exchangeRate),
    [startDate, endDate, loads_raw, currency, exchangeRate]
  );

  // ─── Comparison data — shift primary range back by offset ───
  const comparisonDataList = useMemo(
    () =>
      compareOffsets.map((offset, idx) => {
        const cs = { year: startDate.year - offset, month: startDate.month };
        const ce = { year: endDate.year - offset, month: endDate.month };
        return {
          year: offset,
          label: `${offset} yr ago`,
          color: COMPARE_COLORS[idx],
          data: getAggregatedData(cs, ce, currency, exchangeRate)
        };
      }),
    [compareOffsets, startDate, endDate, loads_raw, currency, exchangeRate]
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <div className="p-6">
        {/* HEADER */}
        <header className="mb-6 pb-5 border-b border-border flex flex-wrap justify-between items-end gap-4">
          <div className="flex-1 min-w-[300px]">
            <h1 className="text-2xl font-black tracking-tight text-foreground">FMS Fresh Produce</h1>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">Operations Report</p>
          </div>

          {/* DATE CONTROLS & THEME TOGGLE */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Day / Night Toggle Pill */}
            <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-xs select-none">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                  theme === 'light'
                    ? "bg-brand-blue/10 text-brand-blue shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Light Mode"
              >
                <Sun size={13} />
                <span className="hidden sm:inline">Day</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                  theme === 'dark'
                    ? "bg-brand-blue/10 text-brand-blue shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Dark Mode"
              >
                <Moon size={13} />
                <span className="hidden sm:inline">Night</span>
              </button>
            </div>

            {/* Currency Switch Toggle Pill */}
            <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-xs select-none gap-0.5">
              <button
                onClick={() => setCurrency('USD')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                  currency === 'USD'
                    ? "bg-brand-blue/10 text-brand-blue shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="US Dollars"
              >
                <span>USD</span>
              </button>
              <button
                onClick={() => setCurrency('CAD')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                  currency === 'CAD'
                    ? "bg-brand-blue/10 text-brand-blue shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Canadian Dollars"
              >
                <span>CAD</span>
              </button>

              {currency === 'CAD' && (
                <div className="flex items-center gap-1.5 px-2.5 text-xs font-bold text-muted-foreground border-l border-border/50 ml-1.5 h-6 animate-in slide-in-from-left duration-200">
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-black">1 USD =</span>
                  <input
                    type="text"
                    value={exchangeRate}
                    onChange={(e) => {
                      // Allow typing decimals by letting state be a string or number, but parse it
                      const rawVal = e.target.value;
                      const val = parseFloat(rawVal);
                      if (!isNaN(val) && val > 0) {
                        setExchangeRate(val);
                      } else if (rawVal === '') {
                        setExchangeRate(0);
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val) || val <= 0) {
                        setExchangeRate(1.36); // Reset default on blur if invalid
                      }
                    }}
                    className="w-12 px-1 py-0.5 bg-muted dark:bg-muted/20 border border-border/80 rounded text-center text-xs font-black text-brand-blue focus:outline-hidden focus:border-brand-blue"
                  />
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-black">CAD</span>
                </div>
              )}
            </div>

            {/* DATE CONTROLS */}
            <div className="flex flex-wrap items-center gap-2 bg-card text-card-foreground px-3 py-1.5 rounded-xl border border-border shadow-xs">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Start:</span>
              <MonthPicker
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  if (val.year * 12 + val.month > endDate.year * 12 + endDate.month) {
                    setEndDate(val);
                  }
                }}
              />

              <span className="text-muted-foreground font-semibold px-1">→</span>

              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">End:</span>
              <MonthPicker
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  if (val.year * 12 + val.month < startDate.year * 12 + startDate.month) {
                    setStartDate(val);
                  }
                }}
              />

            {/* Divider */}
            {(compareOffsets.length > 0 || COMPARE_OPTIONS.length > 0) && (
              <div className="w-px h-5 bg-border mx-1" />
            )}

            {/* Comparison offset chips */}
            {compareOffsets.map((offset, idx) => {
              const startYr = startDate.year - offset;
              const endYr = endDate.year - offset;
              const yearSpanLabel = startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`;
              return (
                <div key={offset} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border"
                  style={{ borderColor: COMPARE_COLORS[idx] + '60', backgroundColor: COMPARE_COLORS[idx] + '10', color: COMPARE_COLORS[idx] }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                  vs {offset} yr ago ({yearSpanLabel})
                  <button onClick={() => toggleCompareOffset(offset)} className="ml-1 hover:opacity-70 transition-opacity">
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            {/* Compare Dropdown */}
            <div className="relative flex items-center" ref={compareRef}>
              <button
                type="button"
                onClick={() => setCompareOpen(o => !o)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold transition-all bg-card",
                  compareOffsets.length > 0 || compareOpen
                    ? "border-brand-green bg-brand-green/5 text-brand-green shadow-xs"
                    : "border-border text-foreground hover:border-brand-green/50 hover:bg-muted"
                )}
              >
                <Plus size={11} />
                <span>Compare</span>
                {compareOffsets.length > 0 && (
                  <span className="bg-brand-green text-white text-[9px] font-black rounded-full px-1.5 py-0.5 ml-1">
                    {compareOffsets.length}
                  </span>
                )}
              </button>

              {compareOpen && (
                <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[150px] animate-in fade-in slide-in-from-top-1 duration-100">
                  {COMPARE_OPTIONS.map(opt => {
                    const isSelected = compareOffsets.includes(opt.value);
                    const isDisabled = !isSelected && compareOffsets.length >= 2;
                    return (
                      <button
                        key={opt.value}
                        disabled={isDisabled}
                        type="button"
                        onClick={() => toggleCompareOffset(opt.value)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-xs text-left font-semibold transition-colors",
                          isDisabled
                            ? "text-muted-foreground/30 cursor-not-allowed bg-muted/30"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check size={12} className="text-brand-green" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

        {/* KPI ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
          <KPICard
            title="Total Truck Loads" 
            value={formatNumber(primaryData.totalLoads)} 
            subValue={`${formatNumber(primaryData.totalPickups)} PICKs • ${formatNumber(primaryData.totalDeliveries)} DROPs`}
            primaryVal={primaryData.totalLoads} 
            icon={<Package size={14} />} 
            color="text-brand-navy"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.totalLoads }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="On-Time Delivery (OTD)" 
            value={`${primaryData.globalOTD.percent}%`} 
            subValue={`${formatNumber(primaryData.globalOTD.ontime)} of ${formatNumber(primaryData.globalOTD.eligible)} stops`}
            primaryVal={primaryData.globalOTD.percent} 
            icon={<Clock size={14} />} 
            color="text-emerald-500"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.globalOTD.percent }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="TRUCK LOADS WITH SINGLE DROP (TL)" 
            value={formatNumber(primaryData.singleStops)} 
            subValue={`${formatNumber(primaryData.tlStops)} DROPs`}
            primaryVal={primaryData.singleStops} 
            icon={<MapPin size={14} />} 
            color="text-brand-green"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.singleStops }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="TRUCK LOADS WITH MULTI-STOP (LTL)" 
            value={formatNumber(primaryData.multiStops)} 
            subValue={`${formatNumber(primaryData.ltlStops)} DROPs`}
            primaryVal={primaryData.multiStops} 
            icon={<MapPin size={14} />} 
            color="text-[#d97706]"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.multiStops }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="Total Delivery Drops" 
            value={formatNumber(primaryData.totalDeliveries)} 
            subValue="Delivery Drops"
            primaryVal={primaryData.totalDeliveries} 
            icon={<MapPin size={14} />} 
            color="text-brand-blue"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.totalDeliveries }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="Total Pickups" 
            value={formatNumber(primaryData.totalPickups)} 
            subValue="Pickup Points"
            primaryVal={primaryData.totalPickups} 
            icon={<MapPin size={14} />} 
            color="text-purple-600"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.totalPickups }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
          <KPICard
            title="Active Carriers" 
            value={formatNumber(primaryData.carriers.length)} 
            primaryVal={primaryData.carriers.length} 
            icon={<Truck size={14} />} 
            color="text-brand-slate"
            compares={comparisonDataList.map(c => ({ label: c.label, color: c.color, value: c.data.carriers.length }))}
            formatDelta={(v, pv) => formatDelta(v, pv, true)}
          />
        </div>

        {/* TABS */}
        <div className="flex flex-wrap p-1 bg-muted border border-border/60 rounded-xl gap-1 mb-6 inline-flex">
          <TabButton id="overview"   label="📊 Overview"   active={activeTab} onClick={setActiveTab} />
          <TabButton id="location"   label="📍 Location"   active={activeTab} onClick={setActiveTab} />
          <TabButton id="carriers"   label="🚛 Carrier"    active={activeTab} onClick={setActiveTab} />
          <TabButton id="lanes"      label="🛣️ Lanes"      active={activeTab} onClick={setActiveTab} />
          <TabButton id="transit"    label="⏱️ Transit"    active={activeTab} onClick={setActiveTab} />
          <TabButton id="drivers"    label="📱 Drivers"    active={activeTab} onClick={setActiveTab} />
          <TabButton id="risk"       label="🎯 Risks"      active={activeTab} onClick={setActiveTab} />
        </div>

        {/* TAB CONTENT */}
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-sm min-h-[500px]">
          {activeTab === 'overview' && (
            <OverviewTab
              monthly={primaryData.monthly}
              daily={primaryData.daily}
              dow={primaryData.dow}
              customers={primaryData.customers}
              carriers={primaryData.carriers}
              comparisonList={comparisonDataList}
              currency={currency}
            />
          )}

          {activeTab === 'lanes' && (
            <LanesTab lanes={primaryData.lanes} loads_raw={primaryData.filtered} isDark={theme === 'dark'} currency={currency} />
          )}
          {activeTab === 'carriers' && (
            <CarriersTab carriers={primaryData.carriers} loads_raw={primaryData.filtered} isDark={theme === 'dark'} currency={currency} />
          )}
          {activeTab === 'drivers' && (
            <DriversTab compliance={primaryData.globalCompliance} carriers={primaryData.carriers} loads_raw={primaryData.filtered} />
          )}
          {activeTab === 'location' && (
            <LocationTab
              customers={primaryData.customers}
              shippers={primaryData.shippers}
              loads_raw={primaryData.filtered}
              isDark={theme === 'dark'}
            />
          )}
          {activeTab === 'zones' && (
            <ZonesTab zones={primaryData.zones} customers={primaryData.customers} carriers={primaryData.carriers} loads_raw={primaryData.filtered} isDark={theme === 'dark'} />
          )}
          {activeTab === 'transit' && (
            <TransitTab
              globalArrival={primaryData.globalArrival}
              globalOTD={primaryData.globalOTD}
              globalDwell={primaryData.globalDwell}
              globalHourlyDelays={primaryData.globalHourlyDelays}
              globalWeekdayDelays={primaryData.globalWeekdayDelays}
              carriers={primaryData.carriers}
              lanes={primaryData.lanes}
            />
          )}
          {activeTab === 'risk' && (
            <RiskTab
              carriers={primaryData.carriers}
              customers={primaryData.customers}
              zones={primaryData.zones}
              loads_raw={primaryData.filtered}
              insurance={realData.insurance}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delta helpers ───
function formatDelta(val: number, prevVal: number, higherBetter: boolean, prefix = '') {
  if (prevVal === 0) return null;
  const diff = val - prevVal;
  const pct = Math.round((diff / prevVal) * 100);
  return { diff, pct, positive: higherBetter ? diff > 0 : diff < 0 };
}

// ─── Sub-components ───
function KPICard({ title, value, subValue, primaryVal, color, icon, compares, formatDelta: fmtDelta }: {
  title: string; value: string | number; subValue?: React.ReactNode; primaryVal: number; color: string; icon: React.ReactNode;
  compares: { label: string; color: string; value: number }[];
  formatDelta: (v: number, pv: number) => { diff: number; pct: number; positive: boolean } | null;
}) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-xs transition-all hover:shadow-sm hover:border-muted-foreground/30 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold">{title}</div>
        <div className="text-muted-foreground opacity-60 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      </div>
      <div className={cn("text-2xl font-black tracking-tight", color)}>{value}</div>
      {subValue && (
        <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">
          {subValue}
        </div>
      )}
      {compares.map(c => {
        const delta = fmtDelta(primaryVal, c.value);
        return (
          <div key={c.label} className="flex items-center gap-1 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-[10px] font-bold" style={{ color: c.color }}>vs {c.label}</span>
            {delta ? (
              <span className={cn("text-[10px] font-bold flex items-center gap-0.5", delta.positive ? "text-brand-green" : "text-brand-red")}>
                {delta.positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {delta.pct > 0 ? '+' : ''}{delta.pct}%
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Minus size={9} /> no data</span>
            )}
          </div>
        );
      })}
      <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-brand-green/5 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
    </div>
  );
}

function TabButton({ id, label, active, onClick }: { id: string; label: string; active: string; onClick: (id: string) => void }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer",
        isActive
          ? "bg-card text-brand-green shadow-xs border border-border/50 ring-1 ring-brand-green/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
      )}
    >
      {label}
    </button>
  );
}
