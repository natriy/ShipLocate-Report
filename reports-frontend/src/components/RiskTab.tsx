import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldAlert, Users, Truck, MapPin, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';

interface RiskTabProps {
  carriers: any[];
  customers: any[];
  zones: any[];
  loads_raw: any[];
  insurance: {
    expired: { carrier: string; expiry: string; loads: number }[];
    expiring_soon: { carrier: string; expiry: string; loads: number }[];
    total_expired: number;
    total_expiring: number;
  };
  currency?: string;
}

export default function RiskTab({ carriers, customers, zones, loads_raw, insurance, currency }: RiskTabProps) {
  const totalLoads = loads_raw.length || 1;
  const [insuranceSubTab, setInsuranceSubTab] = useState<'expired' | 'expiring'>('expired');

  const formatCurrency = (val: number) => {
    return currency === 'CAD' ? `C$${Math.round(val).toLocaleString()}` : `$${Math.round(val).toLocaleString()}`;
  };

  const carrierStats = useMemo(() => {
    const sorted = [...carriers].sort((a, b) => b.loads - a.loads);
    const top1 = (sorted[0]?.loads / totalLoads) * 100 || 0;
    const top3 = sorted.slice(0, 3).reduce((acc, c) => acc + c.loads, 0) / totalLoads * 100 || 0;
    const top5 = sorted.slice(0, 5).reduce((acc, c) => acc + c.loads, 0) / totalLoads * 100 || 0;
    return { list: sorted.slice(0, 8), top1, top3, top5, riskLevel: top1 > 40 ? 'HIGH' : top1 >= 20 ? 'MEDIUM' : 'LOW' };
  }, [carriers, totalLoads]);

  const customerStats = useMemo(() => {
    const getLoads = (c: any) => c.total_loads != null ? c.total_loads : c.loads;
    const sorted = [...customers].sort((a, b) => getLoads(b) - getLoads(a));
    const top1 = (getLoads(sorted[0]) / totalLoads) * 100 || 0;
    const top3 = sorted.slice(0, 3).reduce((acc, c) => acc + getLoads(c), 0) / totalLoads * 100 || 0;
    const top10 = sorted.slice(0, 10).reduce((acc, c) => acc + getLoads(c), 0) / totalLoads * 100 || 0;
    return { list: sorted.slice(0, 10), top1, top3, top10, riskLevel: top1 > 40 ? 'HIGH' : top1 >= 20 ? 'MEDIUM' : 'LOW' };
  }, [customers, totalLoads]);

  const zoneStats = useMemo(() => {
    const sorted = [...zones].sort((a, b) => b.loads - a.loads);
    const top1 = (sorted[0]?.loads / totalLoads) * 100 || 0;
    const top2 = (sorted.slice(0, 2).reduce((acc, z) => acc + z.loads, 0) / totalLoads) * 100 || 0;
    return { list: sorted.slice(0, 6), top1, top2, riskLevel: top1 > 40 ? 'HIGH' : top1 >= 20 ? 'MEDIUM' : 'LOW' };
  }, [zones, totalLoads]);

  const safeInsurance = useMemo(() => {
    return insurance || { expired: [], expiring_soon: [], total_expired: 0, total_expiring: 0 };
  }, [insurance]);

  const insuranceRisk = useMemo(() => {
    const expiredList = safeInsurance.expired || [];
    const expiringList = safeInsurance.expiring_soon || [];

    let expiredLoads = 0;
    let expiredSpend = 0;
    let expiringLoads = 0;
    let expiringSpend = 0;

    const expiredCarrierDetails = expiredList.map(item => {
      const activeData = carriers.find(c => c.name === item.carrier) || { loads: 0, spend: 0 };
      expiredLoads += activeData.loads;
      expiredSpend += activeData.spend;
      return {
        ...item,
        activeLoads: activeData.loads,
        activeSpend: activeData.spend,
      };
    }).sort((a, b) => b.activeLoads - a.activeLoads || b.loads - a.loads);

    const expiringCarrierDetails = expiringList.map(item => {
      const activeData = carriers.find(c => c.name === item.carrier) || { loads: 0, spend: 0 };
      expiringLoads += activeData.loads;
      expiringSpend += activeData.spend;
      return {
        ...item,
        activeLoads: activeData.loads,
        activeSpend: activeData.spend,
      };
    }).sort((a, b) => b.activeLoads - a.activeLoads || b.loads - a.loads);

    const activeExpiredCarriersCount = expiredCarrierDetails.filter(c => c.activeLoads > 0).length;
    const activeExpiringCarriersCount = expiringCarrierDetails.filter(c => c.activeLoads > 0).length;

    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (activeExpiredCarriersCount > 0 || expiredSpend > 50000) {
      riskLevel = 'HIGH';
    } else if (activeExpiringCarriersCount > 0 || expiredLoads > 0) {
      riskLevel = 'MEDIUM';
    }

    return {
      expiredList: expiredCarrierDetails,
      expiringList: expiringCarrierDetails,
      expiredLoads,
      expiredSpend,
      expiringLoads,
      expiringSpend,
      activeExpiredCarriersCount,
      activeExpiringCarriersCount,
      riskLevel
    };
  }, [carriers, safeInsurance]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Top Risk KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskKPICard title="Carrier Risk" value={`${carrierStats.top1.toFixed(1)}%`} subValue="Top carrier share" level={carrierStats.riskLevel} icon={<Truck size={18}/>} />
        <RiskKPICard title="Customer Risk" value={`${customerStats.top10.toFixed(1)}%`} subValue="Top 10 customers" level={customerStats.riskLevel} icon={<Users size={18}/>} />
        <RiskKPICard title="Zone Risk" value={`${zoneStats.top2.toFixed(1)}%`} subValue="Top 2 zones" level={zoneStats.riskLevel} icon={<MapPin size={18}/>} />
        <RiskKPICard title="Insurance Risk" value={`${insuranceRisk.activeExpiredCarriersCount} active expired`} subValue={`${insuranceRisk.expiredLoads} loads exposed`} level={insuranceRisk.riskLevel} icon={<ShieldAlert size={18}/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Carrier Concentration */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1 h-5 bg-brand-slate rounded-full" />
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Carrier Concentration</h3>
          </div>
          <div className="space-y-4">
            {carrierStats.list.map((c, i) => {
              const pct = (c.loads / totalLoads * 100);
              const barColor = i === 0 ? 'bg-brand-red' : i < 3 ? 'bg-brand-yellow' : 'bg-brand-slate';
              const textColor = i === 0 ? 'text-brand-red' : i < 3 ? 'text-brand-yellow' : 'text-brand-slate';
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[65%]">{c.name}</span>
                    <span className={cn("text-xs font-black tabular-nums", textColor)}>
                      {pct.toFixed(1)}% <span className="text-muted-foreground font-normal text-[10px]">({c.loads})</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8 pt-5 border-t border-border">
            <StatBlock label="Top carrier" value={`${carrierStats.top1.toFixed(1)}%`} color="text-brand-red" />
            <StatBlock label="Top 3" value={`${carrierStats.top3.toFixed(1)}%`} color="text-brand-yellow" />
            <StatBlock label="Top 5" value={`${carrierStats.top5.toFixed(1)}%`} color="text-brand-slate" />
          </div>
        </div>

        {/* Customer Concentration */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1 h-5 bg-brand-yellow rounded-full" />
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customer Concentration</h3>
          </div>
          <div className="space-y-1">
            {customerStats.list.map((c, i) => {
              const cLoads = c.total_loads != null ? c.total_loads : c.loads;
              const pct = (cLoads / totalLoads * 100).toFixed(1);
              return (
                <div key={i} className={cn(
                  "flex justify-between items-center py-2.5 border-b transition-colors",
                  i === 0 ? "border-brand-yellow/30" : "border-border/50"
                )}>
                  <span className={cn("text-xs font-semibold truncate max-w-[70%]", i === 0 ? "text-foreground" : "text-muted-foreground")}>{c.name}</span>
                  <span className={cn("text-xs font-black tabular-nums flex items-center gap-1.5", i === 0 ? "text-brand-yellow" : "text-brand-blue")}>
                    {pct}% <span className="text-muted-foreground font-normal text-[10px]">({Math.round(cLoads * 10) / 10})</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-border">
            <StatBlock label="Top customer" value={`${customerStats.top1.toFixed(1)}%`} color="text-brand-yellow" />
            <StatBlock label="Top 3" value={`${customerStats.top3.toFixed(1)}%`} color="text-foreground" />
            <StatBlock label="Top 10" value={`${customerStats.top10.toFixed(1)}%`} color="text-brand-blue" />
          </div>
        </div>

        {/* Zone Concentration */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1 h-5 bg-brand-green rounded-full" />
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Zone Concentration</h3>
          </div>
          <div className="space-y-5">
            {zoneStats.list.map((z, i) => {
              const pct = z.loads / totalLoads * 100;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-foreground">{z.zone}</span>
                    <span className="text-brand-green tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insurance Compliance & Risk Audit */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="w-1 h-5 bg-brand-red rounded-full" />
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Insurance Risk Audit</h3>
              </div>
              <div className="flex p-0.5 bg-muted rounded-lg border border-border/60">
                <button
                  onClick={() => setInsuranceSubTab('expired')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
                    insuranceSubTab === 'expired'
                      ? "bg-card text-brand-red shadow-xs border border-border/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Expired ({safeInsurance.total_expired})
                </button>
                <button
                  onClick={() => setInsuranceSubTab('expiring')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer",
                    insuranceSubTab === 'expiring'
                      ? "bg-card text-brand-yellow shadow-xs border border-border/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Expiring &lt;90d ({safeInsurance.total_expiring})
                </button>
              </div>
            </div>

            {/* Active Exposure Alert banner */}
            {insuranceSubTab === 'expired' ? (
              <div className={cn(
                "p-3.5 rounded-xl border mb-5 flex items-start gap-3 text-xs leading-relaxed",
                insuranceRisk.expiredLoads > 0
                  ? "bg-brand-red/5 border-brand-red/25 text-brand-red font-semibold"
                  : "bg-emerald-500/5 border-emerald-500/20 text-emerald-500 font-semibold"
              )}>
                <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  {insuranceRisk.expiredLoads > 0 ? (
                    <div>
                      CRITICAL EXPOSURE: <span className="font-extrabold">{insuranceRisk.expiredLoads} loads</span> hauled by expired carriers in this period, totaling <span className="font-extrabold">{formatCurrency(insuranceRisk.expiredSpend)}</span> in liability.
                    </div>
                  ) : (
                    <div>
                      No active exposure. All carriers hauling loads in this period have valid insurance.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(
                "p-3.5 rounded-xl border mb-5 flex items-start gap-3 text-xs leading-relaxed",
                insuranceRisk.expiringLoads > 0
                  ? "bg-brand-yellow/5 border-brand-yellow/25 text-brand-yellow font-semibold"
                  : "bg-emerald-500/5 border-emerald-500/20 text-emerald-500 font-semibold"
              )}>
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  {insuranceRisk.expiringLoads > 0 ? (
                    <div>
                      IMPENDING RISK: <span className="font-extrabold">{insuranceRisk.expiringLoads} loads</span> hauled by carriers expiring within 90 days, totaling <span className="font-extrabold">{formatCurrency(insuranceRisk.expiringSpend)}</span>.
                    </div>
                  ) : (
                    <div>
                      No impending exposure from carriers expiring within 90 days.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable list */}
            <div className="space-y-2 overflow-y-auto max-h-[280px] pr-1">
              {(insuranceSubTab === 'expired' ? insuranceRisk.expiredList : insuranceRisk.expiringList).map((c, i) => {
                const isActive = c.activeLoads > 0;
                return (
                  <div key={i} className={cn(
                    "flex justify-between items-center p-3 rounded-xl border transition-colors group",
                    isActive 
                      ? insuranceSubTab === 'expired'
                        ? "bg-brand-red/5 border-brand-red/20 hover:border-brand-red/40"
                        : "bg-brand-yellow/5 border-brand-yellow/20 hover:border-brand-yellow/40"
                      : "bg-muted/20 border-border hover:border-muted-foreground/30"
                  )}>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {c.carrier}
                        {isActive && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            insuranceSubTab === 'expired' ? "bg-brand-red text-white" : "bg-brand-yellow text-black"
                          )}>
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Calendar size={10} /> {c.expiry}</span>
                        <span>•</span>
                        {isActive ? (
                          <span className="font-bold text-foreground">
                            {c.activeLoads} loads ({formatCurrency(c.activeSpend)})
                          </span>
                        ) : (
                          <span>0 active loads in period ({c.loads} historical)</span>
                        )}
                      </div>
                    </div>
                    {isActive ? (
                      <AlertTriangle size={14} className={insuranceSubTab === 'expired' ? "text-brand-red animate-pulse" : "text-brand-yellow"} />
                    ) : (
                      <CheckCircle2 size={14} className="text-muted-foreground/45" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function RiskKPICard({ title, value, subValue, level, icon }: any) {
  const styles = {
    HIGH:   'border-brand-red/40   text-brand-red   bg-brand-red/5',
    MEDIUM: 'border-brand-yellow/40 text-brand-yellow bg-brand-yellow/5',
    LOW:    'border-brand-green/40  text-brand-green  bg-brand-green/5',
  };
  return (
    <div className={cn("border rounded-2xl p-5 relative overflow-hidden transition-all hover:scale-[1.02] duration-200", styles[level as keyof typeof styles])}>
      <div className="flex justify-between items-start mb-4">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{title}</div>
        <div className="p-2 bg-black/10 rounded-lg">{icon}</div>
      </div>
      <div className="text-3xl font-black mb-1.5">{value}</div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold">
        {level === 'LOW' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
        <span className="uppercase">{level}</span>
        <span className="opacity-50 font-medium">· {subValue}</span>
      </div>
      <div className="absolute -right-5 -bottom-5 opacity-5 pointer-events-none">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 90 })}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: any) {
  return (
    <div className="text-center">
      <div className={cn("text-xl font-black", color)}>{value}</div>
      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
