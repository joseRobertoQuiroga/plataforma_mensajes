import { Suspense } from "react";
import { StateCard } from "@/components/ui/StateCard";
import { cn } from "@/lib/utils";

const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";
const HELPER_URL = process.env.HELPER_SSR_URL || process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";

async function getTrends() {
  try {
    const res = await fetch(`${HELPER_URL}/api/dashboard/trends?days=14`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getSummary() {
  try {
    const res = await fetch(`${HELPER_URL}/api/dashboard/summary`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function ReportsContent() {
  const [trends, summary] = await Promise.all([getTrends(), getSummary()]);

  const totalLeads = summary?.leads?.total ?? 0;
  const totalSent = summary?.deliveries?.sent ?? 0;
  const totalReplied = trends?.trends?.reduce((a: number, t: any) => a + (t.deliveriesReceived ?? 0), 0) ?? 0;
  const conversion = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
  const active = summary?.campaigns?.active ?? 0;

  const maxValue = Math.max(1, ...(trends?.trends || []).map((t: any) => Math.max(t.leadsCreated || 0, t.deliveriesSent || 0, t.deliveriesReceived || 0)));
  const channels = Object.entries(trends?.channels || {}).sort((a, b) => (b[1] as number) - (a[1] as number));
  const totalChannel = channels.reduce((a, [, v]) => a + (v as number), 0) || 1;

  const kpis = [
    { label: "Leads Totales", value: String(totalLeads), trend: String(summary?.leads?.scored ?? 0) + " con score", color: "success" },
    { label: "Mensajes Enviados", value: String(totalSent), trend: String(summary?.deliveries?.today ?? 0) + " hoy", color: "primary" },
    { label: "Conversión (respuestas)", value: `${conversion}%`, trend: "últimos 14 días", color: "tertiary" },
    { label: "Campañas Activas", value: String(active), trend: String(summary?.campaigns?.total ?? 0) + " totales", color: "warning" },
  ];

  return (
    <div className="space-y-8">
      {!trends && (
        <StateCard type="error" title="Sin datos de tendencias" description="El helper no respondió. Verifica el servicio en SOAC." retryAction={true} />
      )}

      {/* KPIs reales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">{kpi.label}</h3>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-extrabold text-white">{kpi.value}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded bg-${kpi.color}/10 text-${kpi.color} border border-${kpi.color}/20`}>
                {kpi.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendencia de actividad */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5">
          <h3 className="text-lg font-bold text-white mb-6">Actividad de los últimos 14 días</h3>
          {trends?.trends?.length ? (
            <div className="h-64 flex items-end justify-between gap-1.5 border-b border-l border-white/10 pb-2 pl-2">
              {trends.trends.map((t: any, i: number) => (
                <div key={i} className="w-full flex flex-col justify-end gap-1 group" title={`${t.date}: ${t.leadsCreated} leads · ${t.deliveriesSent} enviados · ${t.deliveriesReceived} recibidos`}>
                  <div className="w-full bg-success/20 rounded-t-sm hover:bg-success/50 transition-colors" style={{ height: `${((t.leadsCreated || 0) / maxValue) * 100}%` }} />
                  <div className="w-full bg-primary/25 rounded-t-sm hover:bg-primary/50 transition-colors" style={{ height: `${((t.deliveriesSent || 0) / maxValue) * 100}%` }} />
                  <div className="w-full bg-warning/25 rounded-t-sm hover:bg-warning/50 transition-colors" style={{ height: `${((t.deliveriesReceived || 0) / maxValue) * 100}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant text-center py-10">Sin actividad registrada en el período.</p>
          )}
          <div className="flex flex-wrap justify-center gap-6 mt-4 text-sm text-on-surface-variant">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-success/40"></span> Leads creados</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-primary/40"></span> Enviados</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-warning/40"></span> Recibidos</span>
          </div>
        </div>

        {/* Distribución por canal */}
        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Distribución por Canal</h3>
          {channels.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-10">Sin entregas registradas.</p>
          ) : (
            <div className="flex-1 flex flex-col justify-center gap-6">
              {channels.slice(0, 5).map(([ch, count]) => {
                const pct = Math.round(((count as number) / totalChannel) * 100);
                const color = ch === "whatsapp" ? "bg-success" : ch === "telegram" ? "bg-primary" : ch === "twilio" ? "bg-success" : "bg-tertiary";
                return (
                  <div key={ch}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white capitalize">{ch}</span>
                      <span className="text-on-surface-variant font-medium">{pct}% ({String(count)})</span>
                    </div>
                    <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Reporte de Impacto y Actividad</h2>
          <p className="text-on-surface-variant font-medium">Analíticas en vivo del pipeline, canales y entregas.</p>
        </div>
        <div className="flex gap-3">
          <a href={`${HELPER_URL}/api/dashboard/trends?days=30`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container border border-white/10 hover:bg-surface-container-high transition-all text-white text-sm">
            API trends
          </a>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-8 pb-20 sm:pb-24 overflow-y-auto z-10">
        <Suspense fallback={
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />)}
            </div>
            <div className="h-80 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />
          </div>
        }>
          <ReportsContent />
        </Suspense>
      </main>
    </div>
  );
}