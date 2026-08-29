import { Suspense } from "react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { StateCard } from "@/components/ui/StateCard";

const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";
const HELPER_URL = process.env.HELPER_SSR_URL || process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";

async function getHealthData() {
  try {
    const res = await fetch(`${HELPER_URL}/api/internal/health-detailed`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getRecentLeads() {
  try {
    const res = await fetch(`${HELPER_URL}/api/leads`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.slice(0, 5);
  } catch {
    return [];
  }
}

async function getInterests() {
  try {
    const res = await fetch(`${HELPER_URL}/api/interests?limit=8`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
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

async function getNotifications() {
  try {
    const res = await fetch(`${HELPER_URL}/api/notifications`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

function SparklineGreen() {
  return (
    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
      <path d="M0 30 Q10 25 20 20 T40 25 T60 15 T80 20 T100 5" fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <path d="M0 30 Q10 25 20 20 T40 25 T60 15 T80 20 T100 5 L100 40 L0 40 Z" fill="url(#successGradient)" opacity={0.3} />
      <defs>
        <linearGradient id="successGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SparklineBlue() {
  return (
    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
      <path d="M0 25 Q10 20 20 25 T40 15 T60 10 T80 15 T100 5" fill="none" stroke="#7dd3fc" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <path d="M0 25 Q10 20 20 25 T40 15 T60 10 T80 15 T100 5 L100 40 L0 40 Z" fill="url(#accentGradient)" opacity={0.3} />
      <defs>
        <linearGradient id="accentGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

async function DashboardContent() {
  const [health, recentLeadsData, interests, summary, trends, notifications] = await Promise.all([
    getHealthData(), getRecentLeads(), getInterests(), getSummary(), getTrends(), getNotifications(),
  ]);

  const leads = health?.modules?.leads?.total ?? 0;
  const leadsScored = health?.modules?.leads?.scored ?? 0;
  const campaigns = health?.modules?.campaigns?.total ?? 0;
  const campaignsActive = health?.modules?.campaigns?.active ?? 0;
  const channels = health?.modules?.channels ?? [];
  const whatsapp = channels.find((c: any) => c.channel === "whatsapp");
  const telegram = channels.find((c: any) => c.channel === "telegram");
  const configuredChannels = channels.filter((c: any) => c.configured).length;
  const isOnline = health?.status === "ok" || health?.dependencies?.postgresql?.status === "connected";
  const elasticStatus = health?.dependencies?.elastic?.status ?? "unknown";
  const version = health?.version ?? "—";

  const scoringRate = leads > 0 ? Math.round((leadsScored / leads) * 100) : 0;
  const pipelineHealth = campaignsActive > 0 ? Math.min(100, Math.round((campaignsActive / campaigns) * 100 + 40)) : 30;

  const metrics = [
    {
      label: "Tasa de Scoring IA",
      value: `${scoringRate}%`,
      badge: scoringRate >= 70 ? `${scoringRate}% calificados` : "Pendientes",
      badgeColor: scoringRate >= 70 ? "text-success bg-success/10 border-success/20" : "text-warning bg-warning/10 border-warning/20",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      iconBg: "bg-success/10 text-success",
      hoverShadow: "hover:shadow-[0_15px_40px_rgba(16,185,129,0.15)] hover:border-success/30",
      chart: <SparklineGreen />,
      href: "/leads",
    },
    {
      label: "Campañas Activas",
      value: `${campaignsActive}`,
      badge: `${campaigns} total`,
      badgeColor: "text-primary bg-primary/10 border-primary/20",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
          <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      iconBg: "bg-primary/10 text-primary",
      hoverShadow: "hover:shadow-[0_15px_40px_rgba(125,211,252,0.15)] hover:border-primary/30",
      chart: <SparklineBlue />,
      href: "/campaigns",
    },
    {
      label: "Leads en Sistema",
      value: `${leads}`,
      badge: `${leadsScored} con score`,
      badgeColor: "text-tertiary bg-tertiary/10 border-tertiary/20",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      iconBg: "bg-tertiary/10 text-tertiary",
      hoverShadow: "hover:shadow-[0_15px_40px_rgba(200,160,240,0.15)] hover:border-tertiary/30",
      chart: (
        <div className="flex gap-1 h-8 items-end">
          {[40, 55, 45, 70, 85, 75, 95].map((h, i) => (
            <div key={i} className="flex-1 bg-tertiary/20 rounded-t-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
      ),
      href: "/leads",
    },
    {
      label: "Salud del Pipeline",
      value: `${pipelineHealth}`,
      badge: pipelineHealth >= 60 ? "Estable" : "Atención",
      badgeColor: pipelineHealth >= 60
        ? "text-warning bg-warning/10 border-warning/20"
        : "text-danger bg-danger/10 border-danger/20",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      ),
      iconBg: "bg-warning/10 text-warning",
      hoverShadow: "hover:shadow-[0_15px_40px_rgba(245,158,11,0.15)] hover:border-warning/30",
      chart: (
        <div className="flex gap-1 h-8 items-end">
          {[20, 40, 30, 60, 50, 70, pipelineHealth].map((h, i) => (
            <div key={i} className="flex-1 bg-warning/20 rounded-t-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
      ),
      href: "/pipeline",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-24">
      {!isOnline && (
        <div className="mb-6">
          <StateCard
            type="error"
            title="Error de Conexión"
            description="El Helper Node o la base de datos principal no están respondiendo. Verifique los servicios en SOAC."
            retryAction={true}
          />
        </div>
      )}

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {metrics.map((m, i) => (
          <Link
            key={i}
            href={m.href}
            className={`glass-card rounded-2xl p-6 ${m.hoverShadow} duration-300 group block cursor-pointer border border-white/10 hover:border-opacity-100 transition-all`}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider group-hover:text-white transition-colors">
                {m.label}
              </h3>
              <span className={`p-2 rounded-lg ${m.iconBg}`}>{m.icon}</span>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-4xl font-extrabold text-white">{m.value}</span>
              <span className={`text-xs font-semibold mb-1 px-2 py-0.5 rounded-md border ${m.badgeColor}`}>
                {m.badge}
              </span>
            </div>
            <div className="h-10 w-full">{m.chart}</div>
          </Link>
        ))}
      </section>

      {/* Estado Diario */}
      <section className="glass-card rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Estado Diario del Negocio</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className="text-xs text-on-surface-variant px-2 py-1 bg-white/5 rounded border border-white/5">Resumen ejecutivo</span>
        </div>
        {summary ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-white">{summary.deliveries?.today ?? 0}</p>
              <p className="text-xs text-on-surface-variant mt-1">Mensajes hoy</p>
            </div>
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-success">{summary.leads?.total ?? 0}</p>
              <p className="text-xs text-on-surface-variant mt-1">Leads en sistema</p>
            </div>
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-primary">{summary.leads?.scored ?? 0}</p>
              <p className="text-xs text-on-surface-variant mt-1">Con score IA</p>
            </div>
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-warning">{summary.campaigns?.active ?? 0}</p>
              <p className="text-xs text-on-surface-variant mt-1">Campañas activas</p>
            </div>
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-tertiary">{summary.deliveries?.sent ?? 0}</p>
              <p className="text-xs text-on-surface-variant mt-1">Enviados totales</p>
            </div>
            <div className="bg-surface-container/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-2xl font-extrabold text-danger">{summary.leads?.topLead ? `${summary.leads.topLead.score}°` : "—"}</p>
              <p className="text-xs text-on-surface-variant mt-1 truncate">{summary.leads?.topLead?.name || "Top lead"}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant text-center py-4">Sin datos de resumen disponibles.</p>
        )}
      </section>

      {/* Intereses de clientes */}
      <section className="glass-card rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Intereses Detectados en Clientes</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Análisis profundo de mensajes y campos de los leads para priorizar ofertas.</p>
          </div>
          <Link href="/leads" className="text-xs text-primary hover:text-white transition-colors px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
            Ver leads →
          </Link>
        </div>
        {interests.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-4">Aún no hay suficientes datos para analizar intereses.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {interests.map((it: any) => (
              <div key={it.term} className="bg-surface-container/50 rounded-xl p-4 border border-white/5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="font-bold text-white capitalize truncate">{it.term}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${it.avgScore >= 70 ? "text-danger bg-danger/10 border-danger/30" : it.avgScore >= 40 ? "text-warning bg-warning/10 border-warning/30" : "text-primary bg-primary/10 border-primary/30"}`}>
                    {it.avgScore}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(100, it.count * 20)}%` }} />
                  </div>
                  <span className="text-xs text-on-surface-variant">{it.count} leads</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(it.channels || []).slice(0, 3).map((c: string) => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize">{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Charts section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Channel Effectiveness */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Efectividad de Canales</h3>
            <span className="text-xs text-on-surface-variant px-2 py-1 bg-white/5 rounded border border-white/5">
              {configuredChannels} activos
            </span>
          </div>
          <div className="space-y-5">
            {[
              { label: "WhatsApp", pct: whatsapp?.configured ? 55 : 0, color: "bg-success", dot: "bg-success" },
              { label: "Telegram", pct: telegram?.configured ? 30 : 0, color: "bg-primary", dot: "bg-primary" },
              { label: "Email", pct: 0, color: "bg-tertiary/50", dot: "bg-tertiary/50" },
            ].map((ch) => (
              <div key={ch.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ch.dot}`} /> {ch.label}
                  </span>
                  <span className="text-on-surface-variant">{ch.pct}%</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                  <div className={`${ch.color} h-2.5 rounded-full transition-all duration-1000`} style={{ width: `${ch.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Estado del Sistema</h3>
            <span className="text-xs text-on-surface-variant px-2 py-1 bg-white/5 rounded border border-white/5">
              v{version}
            </span>
          </div>
          <div className="space-y-4">
            {[
              { name: "Helper Node", status: isOnline, label: isOnline ? "Online" : "Offline" },
              { name: "PostgreSQL", status: health?.dependencies?.postgresql?.status === "connected", label: health?.dependencies?.postgresql?.status ?? "—" },
              { name: "Redis", status: health?.dependencies?.redis?.status === "available", label: health?.dependencies?.redis?.status ?? "—" },
              { name: "Elasticsearch", status: elasticStatus.includes("connected"), label: elasticStatus },
              { name: "Weaviate RAG", status: health?.dependencies?.weaviate?.status === "connected", label: health?.dependencies?.weaviate?.status ?? "—" },
              { name: "Motor LLM", status: health?.dependencies?.llm?.status === "configured", label: health?.dependencies?.llm?.model ?? "No config." },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-none ${svc.status ? "bg-success" : "bg-danger"}`} />
                  <span className="text-sm text-white">{svc.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${svc.status ? "text-success bg-success/10 border-success/20" : "text-danger bg-danger/10 border-danger/20"}`}>
                  {svc.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alertas del SOAC */}
      <section className="glass-card rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Alertas y Eventos del Sistema</h3>
          <Link href="/automation" className="text-xs text-primary hover:text-white transition-colors px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
            Ver automatización →
          </Link>
        </div>
        {notifications.length === 0 ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-success">Sin incidentes ni alertas en las últimas 24h — todo operando normal.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any, i: number) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${n.type === "incident" ? "bg-danger/10 border-danger/20" : n.type === "security" ? "bg-warning/10 border-warning/20" : "bg-primary/10 border-primary/20"}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${n.type === "incident" ? "bg-danger animate-pulse" : n.type === "security" ? "bg-warning" : "bg-primary"}`} />
                <p className="text-sm text-white flex-1">{n.text}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-on-surface-variant capitalize">{n.type}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Leads Table */}
      <section className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Leads Recientes</h3>
          <Link href="/leads" className="text-xs text-primary hover:text-white transition-colors px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentLeadsData.length === 0 ? (
            <div className="p-6">
              <StateCard type="empty" title="Sin Leads Registrados" description="No hay leads recientes o el CRM devolvió 0 registros." />
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Score IA</th>
                  <th className="px-6 py-4">Canal</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLeadsData.map((lead: any, i: number) => {
                  const isHigh = lead.score >= 80;
                  const isMid = lead.score >= 50 && lead.score < 80;
                  const color = isHigh
                    ? "bg-success/20 text-success border-success/30"
                    : isMid
                    ? "bg-warning/20 text-warning border-warning/30"
                    : "bg-primary/20 text-primary border-primary/30";

                  return (
                    <tr key={i} className="hover:bg-white/[0.03] transition-colors group/row cursor-pointer">
                      <td className="px-6 py-5 font-medium text-white">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold border text-xs`}>
                            {lead.name?.charAt(0) || "U"}
                          </div>
                          {lead.name}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-md font-semibold text-xs tracking-wide ${color}`}>
                          {lead.score || 0}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${lead.channel === "whatsapp" ? "bg-success" : lead.channel === "telegram" ? "bg-primary" : "bg-tertiary"}`} />
                          <span className="capitalize">{lead.channel}</span>
                        </span>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant capitalize">{lead.status || "nuevo"}</td>
                      <td className="px-6 py-5 text-right">
                        <Link href="/leads" className="text-on-surface-variant hover:text-white opacity-0 group-hover/row:opacity-100 transition-all">
                          <svg className="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-tertiary/5 rounded-full blur-[150px] pointer-events-none" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-start z-10 flex-none gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-1">Dashboard de Negocio</h2>
          <p className="text-on-surface-variant text-sm font-medium">
            Métricas clave y estado general de la plataforma
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/reports"
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-white bg-white/5 border border-white/10 rounded-xl transition-all"
          >
            Ver Reportes
          </Link>
          <Link
            href="/campaigns"
            className="px-4 py-2 text-sm font-medium text-white bg-primary/20 border border-primary/30 rounded-xl hover:bg-primary/30 transition-all"
          >
            + Nueva Campaña
          </Link>
        </div>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
