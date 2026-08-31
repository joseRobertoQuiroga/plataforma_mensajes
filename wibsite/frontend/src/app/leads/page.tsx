"use client";
import { useState, useEffect, useCallback } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, channelLabel, channelClasses, scoreClasses, scoreLabel, initials, stateDot, STATE_LABELS } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const PIPELINE_STAGES = ["primer_contacto", "primer_mensaje", "interesado", "cotizacion_pendiente", "posible_comprador", "comprador", "descartado", "opt_out"];

function StatusProgress({ status }: { status: string }) {
  const idx = PIPELINE_STAGES.indexOf(status?.toLowerCase() || "nuevo");
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {PIPELINE_STAGES.slice(0, 5).map((step, i) => (
          <div key={step} className={cn("w-6 h-1.5 rounded-full transition-colors", i <= (idx < 0 ? 0 : idx) ? "bg-primary shadow-[0_0_5px_rgba(125,211,252,0.5)]" : "bg-surface-container-high")} />
        ))}
      </div>
      <span className="text-xs text-on-surface-variant ml-1 capitalize">{status || "primer_contacto"}</span>
    </div>
  );
}

function LeadDetail({ lead, onClose, onChanged }: { lead: any; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState({ name: "", phone: "", email: "", status: "" });
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);

  const loadProfile = useCallback(() => {
    fetch(`${HELPER_URL}/api/leads/${lead.id}/profile`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => {});
    fetch(`${HELPER_URL}/api/conversations/default`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d) => {
        const list = Array.isArray(d) ? d : d.conversations || [];
        const phone = lead.phone;
        const matched = list.filter((c: any) => c.metadata?.phone === phone || (c.conversationId || "").includes(String(phone).replace(/\D/g, "").slice(-10)));
        setConversations(matched);
      })
      .catch(() => {});
  }, [lead.id, lead.phone]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note.trim() }),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", "Nota agregada");
      setNote("");
      loadProfile();
    } catch {
      toast("error", "No se pudo guardar la nota");
    }
  };

  const saveContact = async () => {
    try {
      const res = await fetch(`${HELPER_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", "Contacto actualizado");
      setEditOpen(false);
      onChanged();
      loadProfile();
    } catch {
      toast("error", "No se pudo actualizar el contacto");
    }
  };

  const changeStage = async (status: string) => {
    try {
      const res = await fetch(`${HELPER_URL}/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", "Etapa actualizada", status);
      onChanged();
      loadProfile();
    } catch {
      toast("error", "No se pudo cambiar la etapa");
    }
  };

  const p = profile || lead;
  const messages = selectedConv?.messages || selectedConv?.history || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/5 bg-surface-container/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border", scoreClasses(p.score))}>
              {initials(p.name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{p.name || "Sin nombre"}</h3>
              <p className="text-xs text-on-surface-variant truncate">{p.phone || p.email || "Sin contacto"}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold", scoreClasses(p.score))}>{p.score ?? 0} Â· {scoreLabel(p.score)}</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", channelClasses(p.source || "web"))}>{channelLabel(p.source)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => { setEditing({ name: p.name || "", phone: p.phone || "", email: p.email || "", status: p.status || "primer_contacto" }); setEditOpen(true); }}
              className="p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" title="Editar contacto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" aria-label="Cerrar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} /></svg>
            </button>
          </div>
        </div>
        {/* Pipeline selector */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PIPELINE_STAGES.map((st) => (
            <button key={st} onClick={() => changeStage(st)}
              className={cn("px-3 py-1 text-[11px] rounded-full border transition-colors capitalize",
                String(p.status || "primer_contacto") === st ? "bg-primary/20 text-primary border-primary/30" : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white")}>
              {st === "opt_out" ? "Opt-out" : st}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* PrÃ³xima acciÃ³n sugerida */}
        {p.nextAction && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-xs text-success uppercase tracking-wide mb-0.5">Siguiente acciÃ³n</p>
            <p className="text-sm text-white font-medium capitalize">{p.nextAction.action.replace(/_/g, " ")}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">{p.nextAction.reason}</p>
          </div>
        )}

        {/* InterÃ©s / pain points */}
        {(p.customFields?.interest || p.customFields?.pain_point) && (
          <div className="grid grid-cols-2 gap-3">
            {p.customFields?.interest && (
              <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">InterÃ©s</p>
                <p className="text-sm text-white font-medium">{p.customFields.interest}</p>
              </div>
            )}
            {p.customFields?.pain_point && (
              <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Pain point</p>
                <p className="text-sm text-white font-medium">{p.customFields.pain_point}</p>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Notas del agente</p>
          <div className="flex gap-2 mb-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Agregar nota sobre el lead..."
              className="flex-1 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
            <button onClick={addNote} className="px-3 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-semibold">+</button>
          </div>
          {p.notes?.length > 0 ? (
            <div className="space-y-2">
              {[...p.notes].reverse().map((n: any, i: number) => (
                <div key={i} className="bg-surface-container/40 rounded-lg px-3 py-2.5 border border-white/5">
                  <p className="text-sm text-white">{n.text}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">{formatDate(n.at)} Â· {n.by || "agente"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant bg-surface-container/30 rounded-lg p-3 text-center">Sin notas todavÃ­a.</p>
          )}
        </div>

        {/* Entregas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[["Total", p.deliveryStats?.total ?? 0, "text-white"], ["LeÃ­dos", p.deliveryStats?.read ?? 0, "text-primary"], ["Respuestas", p.deliveryStats?.replied ?? 0, "text-success"], ["Fallidos", p.deliveryStats?.failed ?? 0, "text-danger"]].map(([l, v, c]) => (
            <div key={String(l)} className="bg-surface-container rounded-xl p-3 text-center">
              <p className={cn("text-xl font-bold", c)}>{v}</p>
              <p className="text-[11px] text-on-surface-variant">{l}</p>
            </div>
          ))}
        </div>

        {/* Historial de scoring */}
        {p.scoreHistory?.length > 0 && (
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Historial de scoring ({p.scoreHistory.length})</p>
            <div className="space-y-1.5">
              {p.scoreHistory.slice(0, 8).map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-surface-container/40 rounded-lg px-3 py-2 border border-white/5">
                  <span className="text-xs text-on-surface-variant">{formatDate(s.classifiedAt)}</span>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", scoreClasses(s.score))}>{s.score} Â· {s.category || "â€”"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat en miniatura */}
        <div>
          <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Chat del lead ({conversations.length})</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-on-surface-variant bg-surface-container/30 rounded-lg p-3 text-center">Sin conversaciones activas asociadas.</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((c: any) => (
                <div key={c.id} className="bg-surface-container/40 rounded-xl border border-white/5 overflow-hidden">
                  <button onClick={() => setSelectedConv(selectedConv?.id === c.id ? null : c)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", stateDot(c.state))} />
                      <span className="text-xs text-white font-medium">{STATE_LABELS[c.state] || c.state}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", channelClasses(c.metadata?.channel))}>{channelLabel(c.metadata?.channel)}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{c.messageCount ?? 0} msgs</span>
                  </button>
                  {selectedConv?.id === c.id && (
                    <div className="border-t border-white/5 max-h-64 overflow-y-auto p-3 space-y-2">
                      {messages.length === 0 ? (
                        <p className="text-xs text-on-surface-variant text-center py-2">Sin mensajes en esta sesiÃ³n.</p>
                      ) : messages.map((m: any, i: number) => {
                        const isAgent = m.role === "assistant" || m.role === "agent" || m.direction === "outbound";
                        return (
                          <div key={i} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
                            <div className={cn("max-w-[85%] px-3 py-2 rounded-xl text-xs text-white", isAgent ? "bg-primary/20 border border-primary/30" : "bg-surface-container-highest")}>
                              {m.content || m.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Editar contacto" description="Actualiza la informaciÃ³n del lead.">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant">Nombre</label>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant">TelÃ©fono</label>
              <input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant">Email</label>
              <input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveContact} className="flex-1 px-4 py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-semibold">Guardar</button>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cancelar</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [detailLead, setDetailLead] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scoring, setScoring] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (minScore > 0) params.set("min_score", String(minScore));
    fetch(`${HELPER_URL}/api/leads?${params}`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setLeads(data || []);
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [statusFilter, channelFilter, minScore]);

  useEffect(() => { load(); }, [load]);

  const scoreAll = async () => {
    setScoring(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/scoring/evaluate-all`, { method: "POST", headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error("Error");
      toast("success", "Scoring IA completado");
      load();
    } catch (e: any) {
      toast("error", "No se pudo ejecutar el scoring", e.message);
    } finally {
      setScoring(false);
    }
  };

  const filtered = leads.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (![l.name, l.phone, l.email, l.source, l.custom_fields?.interest].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">GestiÃ³n de Leads</h2>
          <p className="text-on-surface-variant font-medium">Revisa, prioriza y da seguimiento a tus prospectos con IA.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg glass-panel hover:bg-surface-container-high transition-all text-white font-medium text-sm">
            Import CSV
          </button>
          <button onClick={scoreAll} disabled={scoring}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all font-medium text-sm shadow-[0_0_20px_rgba(125,211,252,0.1)] disabled:opacity-50">
            {scoring ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <span>âœ¦</span>} Score All
          </button>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-8 pb-20 sm:pb-24 overflow-y-auto z-10">
        {/* Toolbar: bÃºsqueda + filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, telÃ©fono, email, interÃ©s..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
            <option value="all" className="bg-surface-container text-white">Todos los estados</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s} className="bg-surface-container text-white capitalize">{s}</option>
            ))}
          </select>
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
            <option value="all" className="bg-surface-container text-white">Todos los canales</option>
            {["whatsapp", "telegram", "messenger", "email", "web", "instagram"].map((c) => (
              <option key={c} value={c} className="bg-surface-container text-white capitalize">{c}</option>
            ))}
          </select>
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
            <option value={0} className="bg-surface-container text-white">Score: Todos</option>
            <option value={80} className="bg-surface-container text-white">Score â‰¥ 80 (Hot)</option>
            <option value={50} className="bg-surface-container text-white">Score â‰¥ 50 (Tibio)</option>
          </select>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setViewMode("list")} className={`p-2.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant"}`} title="Vista lista">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button onClick={() => setViewMode("grid")} className={`p-2.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-container text-on-surface-variant hover:text-white border border-outline-variant"}`} title="Vista tarjetas">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6 text-sm text-danger">
            No se pudo conectar con el backend. Verifica que el Helper Node estÃ© activo.
          </div>
        )}

        {loading && leads.length === 0 ? (
          <div className="glass-panel rounded-xl overflow-hidden p-6 space-y-4 animate-pulse">
            <div className="h-8 w-1/4 bg-surface-container-high rounded" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-10 w-10 rounded-full bg-surface-container-high flex-none" />
                <div className="h-4 w-1/4 bg-surface-container-high rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-white/10">
            <p className="text-white font-medium mb-1">Sin leads encontrados</p>
            <p className="text-sm text-on-surface-variant">Ajusta los filtros o importa una lista CSV.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="glass-panel rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-primary/10 bg-surface-container/30">
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Lead</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">AI Score</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Canal</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Pipeline</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">InterÃ©s</th>
                    <th className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">AcciÃ³n</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filtered.map((lead: any) => (
                    <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => setDetailLead(lead)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border font-bold", scoreClasses(lead.score))}>
                            {initials(lead.name)}
                          </div>
                          <div>
                            <div className="font-medium text-white">{lead.name || "Sin nombre"}</div>
                            <div className="text-xs text-on-surface-variant">{lead.email || lead.phone || "Sin info"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-3 py-1 rounded-md font-semibold text-xs tracking-wide border", scoreClasses(lead.score))}>
                          {lead.score || 0} Â· {scoreLabel(lead.score)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", channelClasses(lead.source))}>{channelLabel(lead.source)}</span>
                      </td>
                      <td className="px-6 py-4"><StatusProgress status={lead.status} /></td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant max-w-[160px] truncate">{lead.custom_fields?.interest || "â€”"}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setDetailLead(lead); }} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {filtered.map((lead: any) => (
              <div key={lead.id} className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-primary/30 transition-colors border border-white/5 cursor-pointer" onClick={() => setDetailLead(lead)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border shadow-inner", scoreClasses(lead.score))}>
                      {initials(lead.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-md">{lead.name || "Sin nombre"}</h3>
                      <p className="text-xs text-on-surface-variant flex items-center gap-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", channelClasses(lead.source))}>{channelLabel(lead.source)}</span>
                      </p>
                    </div>
                  </div>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", scoreClasses(lead.score))}>{lead.score || 0} Â· {scoreLabel(lead.score)}</span>
                </div>

                <div className="py-4 border-y border-white/5 mb-4">
                  <div className="text-xs text-on-surface-variant mb-2">Estado del Pipeline</div>
                  <StatusProgress status={lead.status} />
                </div>

                {lead.custom_fields?.interest && (
                  <div className="mb-4">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">InterÃ©s</p>
                    <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">{lead.custom_fields.interest}</span>
                  </div>
                )}

                <div className="flex justify-between items-center mt-auto">
                  <div className="text-xs text-on-surface-variant">Ãšltimo contacto: {formatDate(lead.updated_at || lead.created_at)}</div>
                  <button onClick={(e) => { e.stopPropagation(); setDetailLead(lead); }} className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors">
                    Ver Detalle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Importar leads (CSV)" description="Formato: name,phone,email por lÃ­nea, con encabezado.">
        <ImportCsv onDone={() => { setImportOpen(false); load(); }} />
      </Dialog>

      <Sheet open={!!detailLead} onClose={() => setDetailLead(null)} className="w-[540px]">
        {detailLead && <LeadDetail lead={detailLead} onClose={() => setDetailLead(null)} onChanged={load} />}
      </Sheet>
    </div>
  );
}

function ImportCsv({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!file) return toast("error", "Selecciona un archivo CSV");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${HELPER_URL}/api/leads/import`, { method: "POST", headers: { "x-api-key": HELPER_API_KEY }, body: form });
      if (!res.ok) throw new Error("Error");
      const d = await res.json();
      toast("success", "Leads importados", `${d.imported} registros`);
      onDone();
    } catch (e: any) {
      toast("error", "ImportaciÃ³n fallida", e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-xl p-8 cursor-pointer hover:border-primary/40 transition-colors">
        <svg className="w-8 h-8 text-on-surface-variant mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-sm text-white">{file ? file.name : "Arrastra o selecciona un CSV"}</span>
        <span className="text-xs text-on-surface-variant mt-1">name, phone, email</span>
        <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <button onClick={submit} disabled={uploading || !file}
        className="w-full px-4 py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-semibold disabled:opacity-50">
        {uploading ? "Importando..." : "Importar"}
      </button>
    </div>
  );
}