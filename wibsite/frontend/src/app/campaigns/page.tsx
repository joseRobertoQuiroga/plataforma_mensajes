"use client";
import { useState, useEffect, useCallback } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { Select, Textarea, Switch } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, channelLabel, channelClasses, scoreClasses } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  draft: { label: "Borrador", cls: "bg-surface-container-high text-on-surface-variant border-outline-variant", dot: "bg-outline-variant" },
  scheduled: { label: "Programada", cls: "bg-primary/10 text-primary border-primary/30", dot: "bg-primary animate-pulse" },
  sending: { label: "Enviando", cls: "bg-success/10 text-success border-success/30", dot: "bg-success animate-pulse" },
  paused: { label: "Pausada", cls: "bg-warning/10 text-warning border-warning/30", dot: "bg-warning" },
  completed: { label: "Completada", cls: "bg-tertiary/10 text-tertiary border-tertiary/30", dot: "bg-tertiary" },
};

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "messenger", label: "Messenger" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

function CampaignForm({ initial, onSaved, onClose }: { initial?: any; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    channel: initial?.channel || "whatsapp",
    message_template: initial?.message_template || "",
    template_name: initial?.template_name || "",
    scheduled_at: initial?.scheduled_at || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast("error", "El nombre es obligatorio");
    if (!form.message_template.trim()) return toast("error", "El mensaje es obligatorio");
    setSaving(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/campaigns`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, scheduled_at: form.scheduled_at || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al crear campaña");
      }
      toast("success", "Campaña creada", form.name);
      onSaved();
      onClose();
    } catch (e: any) {
      toast("error", "No se pudo crear", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-on-surface-variant">Nombre *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Promoción lanzamiento Q3"
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
      </div>
      <div>
        <label className="text-xs font-medium text-on-surface-variant">Descripción</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Objetivo de la campaña"
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Canal" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS} />
        <div>
          <label className="text-xs font-medium text-on-surface-variant">Programar (opcional)</label>
          <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
        </div>
      </div>
      <Textarea label="Mensaje / Plantilla *" value={form.message_template} onChange={(v) => setForm({ ...form, message_template: v })}
        placeholder="Hola {{name}}, tenemos una oferta especial: {{offer}}..." rows={4} />
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold disabled:opacity-50">
          {saving ? "Creando..." : initial ? "Guardar cambios" : "Crear campaña"}
        </button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CampaignDetail({ campaign, onClose, onChanged }: { campaign: any; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const load = useCallback(() => {
    fetch(`${HELPER_URL}/api/campaigns/${campaign.id}/stats`, { headers: { "x-api-key": HELPER_API_KEY } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
    fetch(`${HELPER_URL}/api/campaigns/${campaign.id}/leads`, { headers: { "x-api-key": HELPER_API_KEY } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLeads(Array.isArray(d) ? d : d.leads || []))
      .catch(() => {});
  }, [campaign.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const action = async (path: string, method: string, successMsg: string, body?: any) => {
    try {
      const res = await fetch(`${HELPER_URL}${path}`, {
        method, headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error("Request failed");
      toast("success", successMsg);
      onChanged();
      load();
    } catch (e: any) {
      toast("error", "Acción fallida", e.message);
    }
  };

  const metric = (label: string, value: any, cls?: string) => (
    <div className="bg-surface-container rounded-xl p-3 text-center">
      <p className={cn("text-xl font-bold", cls || "text-white")}>{value ?? 0}</p>
      <p className="text-[11px] text-on-surface-variant mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/5 bg-surface-container/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{campaign.name}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", STATUS_META[campaign.status]?.cls)}>
                {STATUS_META[campaign.status]?.label || campaign.status}
              </span>
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", channelClasses(campaign.channel))}>
                {channelLabel(campaign.channel)}
              </span>
              {campaign.audience_size !== undefined && (
                <span className="text-xs text-on-surface-variant">{campaign.audience_size} destinatarios</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} /></svg>
          </button>
        </div>
        {campaign.description && <p className="text-sm text-on-surface-variant mt-2">{campaign.description}</p>}
        <p className="text-xs text-on-surface-variant mt-2">Creada: {formatDate(campaign.created_at)}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {campaign.status !== "sending" && campaign.status !== "completed" && (
            <button onClick={() => action(`/api/campaigns/${campaign.id}/start`, "POST", "Campaña iniciada")}
              className="px-4 py-2 rounded-lg bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold">
              ▶ Iniciar ahora
            </button>
          )}
          {campaign.status === "sending" && (
            <button onClick={() => action(`/api/campaigns/${campaign.id}/pause`, "POST", "Campaña pausada")}
              className="px-4 py-2 rounded-lg bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors text-sm font-semibold">
              ⏸ Pausar
            </button>
          )}
          {campaign.status !== "completed" && (
            <button onClick={() => action(`/api/campaigns/${campaign.id}/complete`, "POST", "Campaña completada")}
              className="px-4 py-2 rounded-lg bg-tertiary/20 text-tertiary border border-tertiary/30 hover:bg-tertiary/30 transition-colors text-sm font-semibold">
              ✓ Completar
            </button>
          )}
          <button onClick={() => action(`/api/campaigns/${campaign.id}/schedule`, "POST", "Campaña programada", { scheduled_at: new Date(Date.now() + 3600000).toISOString() })}
            className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-semibold">
            📅 Programar +1h
          </button>
          <a href={`${HELPER_URL}/api/campaigns/${campaign.id}/export`} target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm font-semibold">
            ⬇ Exportar CSV
          </a>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metric("Enviados", stats?.sent ?? campaign.sent_count ?? 0, "text-primary")}
          {metric("Entregados", stats?.delivered ?? campaign.delivered_count ?? 0, "text-success")}
          {metric("Leídos", stats?.read ?? campaign.read_count ?? 0)}
          {metric("Respuestas", stats?.replied ?? campaign.replied_count ?? 0, "text-warning")}
          {metric("Fallidos", stats?.failed ?? campaign.failed_count ?? 0, "text-danger")}
          {metric("Opt-outs", stats?.optOut ?? campaign.opt_out_count ?? 0)}
          {metric("Lead targets", stats?.targets ?? leads.length ?? 0, "text-tertiary")}
          {metric("Canal", campaign.channel)}
        </div>

        {/* Progreso */}
        <div>
          <div className="flex justify-between text-xs mb-2 text-on-surface-variant">
            <span>Progreso de envío</span>
            <span className="text-white font-medium">{stats?.progress ?? campaign.progress ?? 0}%</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-700" style={{ width: `${stats?.progress ?? campaign.progress ?? 0}%` }} />
          </div>
        </div>

        {/* Mensaje */}
        {campaign.message_template && (
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Mensaje de la campaña</p>
            <div className="bg-surface-container/50 p-3 rounded-lg border border-white/5 text-sm text-white font-mono whitespace-pre-wrap">
              {campaign.message_template}
            </div>
          </div>
        )}

        {/* Leads de la campaña */}
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-3">Leads en la campaña ({leads.length})</p>
          {leads.length === 0 ? (
            <p className="text-sm text-on-surface-variant bg-surface-container/30 rounded-lg p-4 text-center">Sin leads asignados a esta campaña.</p>
          ) : (
            <div className="space-y-2">
              {leads.slice(0, 30).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between bg-surface-container/40 rounded-lg px-3 py-2 border border-white/5">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate font-medium">{l.name || l.phone}</p>
                    <p className="text-xs text-on-surface-variant truncate">{l.phone || l.email}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0", scoreClasses(l.score))}>{l.score ?? 0}</span>
                </div>
              ))}
              {leads.length > 30 && <p className="text-xs text-on-surface-variant text-center">+{leads.length - 30} más</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${HELPER_URL}/api/campaigns`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setCampaigns(Array.isArray(d) ? d : d.data || []);
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const remove = async (c: any) => {
    if (!confirm(`¿Eliminar la campaña "${c.name}"?`)) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/campaigns/${c.id}`, { method: "DELETE", headers: { "x-api-key": HELPER_API_KEY } });
      if (!res.ok) throw new Error("Error");
      toast("success", "Campaña eliminada", c.name);
      load();
    } catch (e: any) {
      toast("error", "No se pudo eliminar", e.message);
    }
  };

  const filtered = campaigns.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[50vw] h-[50vw] bg-warning/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Campañas Broadcast</h2>
          <p className="text-on-surface-variant font-medium">Crea, programa y da seguimiento a tus envíos multicanal.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-all font-medium text-sm shadow-[0_0_20px_rgba(245,158,11,0.1)]">
          + Nueva Campaña
        </button>
      </header>

      <main className="flex-1 px-3 sm:px-8 pb-20 sm:pb-24 overflow-y-auto z-10">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["all", "draft", "scheduled", "sending", "paused", "completed"].map((st) => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={cn("px-3 py-1.5 text-xs rounded-full border transition-colors",
                statusFilter === st ? "bg-primary/20 text-primary border-primary/30" : "bg-surface-container border-white/10 text-on-surface-variant hover:text-white")}>
              {st === "all" ? "Todos" : STATUS_META[st]?.label || st}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1" />
          {["all", "whatsapp", "telegram", "messenger", "email"].map((ch) => (
            <button key={ch} onClick={() => setChannelFilter(ch)}
              className={cn("px-3 py-1.5 text-xs rounded-full border transition-colors",
                channelFilter === ch ? "bg-success/15 text-success border-success/30" : "bg-surface-container border-white/10 text-on-surface-variant hover:text-white")}>
              {ch === "all" ? "Todos los canales" : channelLabel(ch)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6 text-sm text-danger">
            No se pudo conectar con el backend. Verifica que el Helper Node esté activo.
          </div>
        )}

        {loading && campaigns.length === 0 ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-white/10">
            <p className="text-white font-medium mb-1">{campaigns.length === 0 ? "No hay campañas todavía" : "Sin campañas con esos filtros"}</p>
            <p className="text-sm text-on-surface-variant mb-4">{campaigns.length === 0 ? "Crea tu primera campaña multicanal." : "Ajusta los filtros para ver más resultados."}</p>
            {campaigns.length === 0 && (
              <button onClick={() => setCreateOpen(true)} className="px-5 py-2.5 rounded-lg bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors text-sm font-semibold">
                + Nueva Campaña
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filtered.map((camp) => {
              const meta = STATUS_META[camp.status] || STATUS_META.draft;
              const progress = statsProgress(camp);
              return (
                <div key={camp.id} className="glass-panel rounded-2xl p-6 border border-white/10 group hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setDetail(camp)}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors truncate">{camp.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", meta.cls)}>{meta.label}</span>
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", channelClasses(camp.channel))}>{channelLabel(camp.channel)}</span>
                        {camp.audience_size !== undefined && <span>{camp.audience_size} destinatarios</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setDetail(camp); }} className="p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" title="Ver detalle">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); remove(camp); }} className="p-2 rounded-lg text-on-surface-variant hover:text-danger hover:bg-white/5 transition-colors" title="Eliminar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-2 text-on-surface-variant">
                      <span>Progreso</span>
                      <span className="text-white font-medium">{progress}%</span>
                    </div>
                    <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full ${camp.status === "sending" ? "bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-secondary"}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-white/5">
                    <div>
                      <div className="text-xs text-on-surface-variant">Enviados</div>
                      <div className="text-lg font-semibold text-white">{camp.sent_count ?? camp.metrics?.sent ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-on-surface-variant">Entregados</div>
                      <div className="text-lg font-semibold text-success">{camp.delivered_count ?? camp.metrics?.delivered ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-on-surface-variant">Leídos</div>
                      <div className="text-lg font-semibold text-white">{camp.read_count ?? camp.metrics?.read ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-on-surface-variant">Respuestas</div>
                      <div className="text-lg font-semibold text-warning">{camp.replied_count ?? camp.metrics?.replied ?? 0}</div>
                    </div>
                  </div>

                  {camp.message_template && (
                    <p className="text-xs text-on-surface-variant mt-4 truncate font-mono">{camp.message_template}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva Campaña" description="Configura el envío masivo por canal.">
        <CampaignForm onSaved={load} onClose={() => setCreateOpen(false)} />
      </Dialog>

      <Sheet open={!!detail} onClose={() => setDetail(null)} className="w-[520px]">
        {detail && <CampaignDetail campaign={detail} onClose={() => setDetail(null)} onChanged={load} />}
      </Sheet>
    </div>
  );
}

function statsProgress(c: any) {
  if (c.progress !== undefined) return c.progress;
  const sent = c.sent_count ?? c.metrics?.sent ?? 0;
  const total = c.audience_size ?? c.leads_count ?? 0;
  if (!total) return c.status === "completed" ? 100 : c.status === "sending" ? 40 : 0;
  return Math.min(100, Math.round((sent / total) * 100));
}