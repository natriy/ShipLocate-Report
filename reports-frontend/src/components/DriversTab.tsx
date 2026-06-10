import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, CheckCircle, AlertTriangle, PhoneOff, MessageSquare, ShieldAlert, ArrowUpDown, ChevronRight, TrendingUp, UserCheck, Smartphone, Info } from 'lucide-react';

interface DriversTabProps {
  compliance: any;
  carriers: any[];
  loads_raw: any[];
}

type SortKey = 'name' | 'total' | 'adoption_rate' | 'self_close_rate' | 'manual_close_rate';

export default function DriversTab({ compliance, carriers, loads_raw }: DriversTabProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDesc, setSortDesc] = useState(true);
  const [alertFilter, setAlertFilter] = useState<'all' | 'no-phone' | 'no-login' | 'no-close'>('all');

  // Sort and filter carriers
  const filteredCarriers = useMemo(() => {
    return carriers
      .filter(c => {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) && (c.compliance?.total || 0) > 0;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;
        if (sortKey === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortKey === 'total') {
          valA = a.compliance?.total || 0;
          valB = b.compliance?.total || 0;
        } else {
          valA = a.compliance?.[sortKey] || 0;
          valB = b.compliance?.[sortKey] || 0;
        }

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
  }, [carriers, search, sortKey, sortDesc]);

  // Extract compliance alert loads
  const alerts = useMemo(() => {
    return loads_raw
      .filter(l => {
        const comp = l.compliance || {};
        if (!comp.total) return false;
        
        if (alertFilter === 'no-phone' && comp.has_phone) return false;
        if (alertFilter === 'no-login' && (!comp.has_phone || comp.logged_in)) return false;
        if (alertFilter === 'no-close' && (!comp.logged_in || comp.driver_delivered)) return false;
        
        // General alert criteria (uncompliant)
        return !comp.has_phone || !comp.logged_in || !comp.driver_delivered;
      })
      .map(l => {
        const comp = l.compliance || {};
        let issue = 'Unknown Compliance Issue';
        let severity: 'high' | 'medium' | 'low' = 'low';
        
        if (!comp.has_phone) {
          issue = 'No phone number assigned to driver';
          severity = 'high';
        } else if (!comp.logged_in) {
          issue = 'Sms invitation sent but driver never logged in';
          severity = 'high';
        } else if (!comp.accepted) {
          issue = 'Driver logged in but never accepted load';
          severity = 'medium';
        } else if (!comp.driver_delivered) {
          issue = 'Office manually completed (driver forgot to self-close)';
          severity = 'low';
        }

        return {
          id: l.id,
          date: l.date,
          carrier: l.carrier,
          phone: l.phone || '—',
          issue,
          severity,
          close_method: comp.close_method
        };
      })
      .sort((a, b) => b.id - a.id);
  }, [loads_raw, alertFilter]);

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

  // Funnel calculations
  const totalLoads = compliance.total || 0;
  const phonePercent = totalLoads > 0 ? (compliance.has_phone / totalLoads) * 100 : 0;
  const smsPercent = totalLoads > 0 ? (compliance.has_sms / totalLoads) * 100 : 0;
  const loginPercent = totalLoads > 0 ? (compliance.logged_in / totalLoads) * 100 : 0;
  const acceptPercent = totalLoads > 0 ? (compliance.accepted / totalLoads) * 100 : 0;
  const selfClosePercent = totalLoads > 0 ? (compliance.driver_delivered / totalLoads) * 100 : 0;

  const funnelSteps = [
    { label: 'Total Shipments', count: totalLoads, pct: 100, color: 'bg-brand-blue/80' },
    { label: 'Driver Phone Assigned', count: compliance.has_phone, pct: phonePercent, color: 'bg-indigo-500/80' },
    { label: 'SMS Invitations Sent', count: compliance.has_sms, pct: smsPercent, color: 'bg-purple-500/80' },
    { label: 'Driver Logged In', count: compliance.logged_in, pct: loginPercent, color: 'bg-pink-500/80' },
    { label: 'Driver Accepted Load', count: compliance.accepted, pct: acceptPercent, color: 'bg-amber-500/80' },
    { label: 'Driver Self-Delivered', count: compliance.driver_delivered, pct: selfClosePercent, color: 'bg-emerald-500/80' },
  ];

  // Overall rates
  const adoptionRate = totalLoads > 0 ? (compliance.logged_in / totalLoads) * 100 : 0;
  const selfCloseRate = totalLoads > 0 ? (compliance.driver_delivered / totalLoads) * 100 : 0;
  const manualCloseRate = totalLoads > 0 ? (compliance.manual_close / totalLoads) * 100 : 0;
  const avgSmsResponse = compliance.sms_to_login_count > 0 ? (compliance.sms_to_login_sum / compliance.sms_to_login_count) : 0;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* ── TOP KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">App Adoption Rate</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500"><Smartphone size={14} /></div>
          </div>
          <div className="text-2xl font-black text-emerald-500">{adoptionRate.toFixed(1)}%</div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-1">
            {compliance.logged_in} of {totalLoads} logged-in drivers
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200 border-brand-green/30 bg-brand-green/5">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-green">Driver Self-Close Rate</span>
            <div className="p-1.5 bg-brand-green/10 rounded-lg text-brand-green"><CheckCircle size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-green">{selfCloseRate.toFixed(1)}%</div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-1">
            {compliance.driver_delivered} loads marked complete by driver
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200 border-brand-red/30 bg-brand-red/5">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-red">Office Manual Closes</span>
            <div className="p-1.5 bg-brand-red/10 rounded-lg text-brand-red"><AlertTriangle size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-red">{manualCloseRate.toFixed(1)}%</div>
          <div className="text-[10px] font-semibold text-brand-red/80 mt-1">
            {compliance.manual_close} dispatcher-completed loads
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-xs duration-200">
          <div className="flex justify-between items-start mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Avg App Onboarding</span>
            <div className="p-1.5 bg-brand-navy/10 rounded-lg text-brand-navy"><UserCheck size={14} /></div>
          </div>
          <div className="text-2xl font-black text-brand-navy">{avgSmsResponse.toFixed(2)} hrs</div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-1">
            Avg duration from SMS invitation to Login
          </div>
        </div>
      </div>

      {/* ── FUNNEL CHART & CARRIER AUDITING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* FUNNEL CHART (LEFT) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Driver App Adoption Funnel</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Visually track where dispatch-to-app communication fails</p>
          </div>

          <div className="space-y-3.5 pt-2">
            {funnelSteps.map((step, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-foreground">
                  <span>{step.label}</span>
                  <span className="font-extrabold tabular-nums">{step.count} ({step.pct.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-muted border border-border/30 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500 shadow-inner", step.color)} 
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-3.5 text-xs text-muted-foreground font-semibold">
            <h4 className="font-extrabold uppercase text-[9px] tracking-wider text-foreground mb-1">Audit Insights:</h4>
            Adoption drops from <span className="text-brand-blue font-bold">{phonePercent.toFixed(0)}%</span> (phone assignment) to <span className="text-brand-green font-bold">{selfClosePercent.toFixed(0)}%</span> (self-close). The largest leakage points are drivers not logging in after SMS and not closing their own loads once complete.
          </div>
        </div>

        {/* CARRIER COMPLIANCE AUDIT (RIGHT) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 space-y-4 flex flex-col min-h-[460px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Carrier Adoption Rankings</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Track individual carrier mobile tool compliance</p>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={13} />
              <input
                type="text"
                placeholder="Search carrier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1 bg-muted border border-border rounded-xl text-[11px] font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded text-muted-foreground/70">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-muted/10 flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="select-none">
                  <th onClick={() => handleSort('name')} className="px-4 py-2 cursor-pointer text-[9px] uppercase tracking-wider font-extrabold hover:text-brand-blue text-left">
                    <div className="flex items-center gap-1">
                      <span>Carrier</span>
                      {renderSortArrow('name')}
                      {renderTooltip('The name of the carrier company', 'left')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('total')} className="px-4 py-2 cursor-pointer text-[9px] uppercase tracking-wider font-extrabold hover:text-brand-blue text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>Loads</span>
                      {renderSortArrow('total')}
                      {renderTooltip('Total shipment volume hauled by this carrier', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('adoption_rate')} className="px-4 py-2 cursor-pointer text-[9px] uppercase tracking-wider font-extrabold hover:text-brand-blue text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>Login Rate</span>
                      {renderSortArrow('adoption_rate')}
                      {renderTooltip('Percentage of driver invitations that logged into the driver app', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('self_close_rate')} className="px-4 py-2 cursor-pointer text-[9px] uppercase tracking-wider font-extrabold hover:text-brand-blue text-right text-brand-green">
                    <div className="flex items-center justify-end gap-1">
                      <span>Self-Close</span>
                      {renderSortArrow('self_close_rate')}
                      {renderTooltip('Percentage of deliveries self-completed/closed by drivers in the app', 'center')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('manual_close_rate')} className="px-4 py-2 cursor-pointer text-[9px] uppercase tracking-wider font-extrabold hover:text-brand-blue text-right text-brand-red">
                    <div className="flex items-center justify-end gap-1">
                      <span>Manual Close</span>
                      {renderSortArrow('manual_close_rate')}
                      {renderTooltip('Percentage of deliveries closed manually by dispatch (driver failed to close)', 'right')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCarriers.map((c, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold text-foreground truncate max-w-[150px]" title={c.name}>
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-brand-navy tabular-nums">
                      {c.compliance?.total}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      <span className={cn(
                        c.compliance?.adoption_rate >= 80 ? "text-emerald-500" : c.compliance?.adoption_rate >= 60 ? "text-amber-500" : "text-rose-500"
                      )}>
                        {c.compliance?.adoption_rate?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-brand-green tabular-nums">
                      {c.compliance?.self_close_rate?.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-brand-red tabular-nums">
                      {c.compliance?.manual_close_rate?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ACTIONABLE COMPLIANCE ALERTS ── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-brand-red flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-brand-red animate-pulse" /> Actionable Compliance Alerts
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Historical and active loads failing compliance criteria</p>
          </div>

          <div className="flex bg-muted border border-border/50 rounded-lg p-0.5 text-[10px] font-bold">
            <button
              onClick={() => setAlertFilter('all')}
              className={cn("px-2.5 py-1 rounded-md transition-all", alertFilter === 'all' ? "bg-card text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground")}
            >
              All Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setAlertFilter('no-phone')}
              className={cn("px-2.5 py-1 rounded-md transition-all flex items-center gap-1", alertFilter === 'no-phone' ? "bg-brand-red/10 text-brand-red shadow-2xs font-extrabold" : "text-muted-foreground hover:text-brand-red")}
            >
              No Phone Assigned
            </button>
            <button
              onClick={() => setAlertFilter('no-login')}
              className={cn("px-2.5 py-1 rounded-md transition-all flex items-center gap-1", alertFilter === 'no-login' ? "bg-brand-yellow/10 text-brand-yellow shadow-2xs font-extrabold" : "text-muted-foreground hover:text-brand-yellow")}
            >
              Invited, Never Logged-In
            </button>
            <button
              onClick={() => setAlertFilter('no-close')}
              className={cn("px-2.5 py-1 rounded-md transition-all", alertFilter === 'no-close' ? "bg-card text-foreground shadow-2xs font-extrabold" : "text-muted-foreground hover:text-foreground")}
            >
              Manual Completed
            </button>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold">Load ID</th>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold">Date</th>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold">Carrier</th>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold">Phone</th>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold">Audited Failure State</th>
                  <th className="px-4 py-2.5 text-[9px] uppercase tracking-wider font-extrabold text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {alerts.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-bold text-foreground tabular-nums">{row.id}</td>
                    <td className="px-4 py-3 text-muted-foreground font-semibold tabular-nums">{row.date}</td>
                    <td className="px-4 py-3 font-bold text-brand-navy truncate max-w-[180px]" title={row.carrier}>{row.carrier}</td>
                    <td className="px-4 py-3 text-muted-foreground font-medium tabular-nums">{row.phone}</td>
                    <td className="px-4 py-3 font-bold text-foreground">{row.issue}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded-full inline-block uppercase tracking-wider",
                        row.severity === 'high' ? "bg-rose-500/10 text-rose-500" :
                        row.severity === 'medium' ? "bg-amber-500/10 text-amber-500" :
                        "bg-slate-500/10 text-slate-500"
                      )}>
                        {row.severity}
                      </span>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground font-semibold">
                      No compliance alerts matching criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
