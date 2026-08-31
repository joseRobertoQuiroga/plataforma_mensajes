"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn, initials, scoreClasses, channelLabel, channelClasses, formatDate } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const STAGES = [
  { id: "primer_contacto", label: "1° Contacto", color: "bg-primary", glow: "shadow-[0_0_12px_rgba(125,211,252,0.4)]" },
  { id: "primer_mensaje", label: "1° Mensaje", color: "bg-blue-400", glow: "shadow-[0_0_12px_rgba(96,165,250,0.4)]" },
  { id: "interesado", label: "Interesado", color: "bg-secondary", glow: "shadow-[0_0_12px_rgba(136,180,204,0.4)]" },
  { id: "cotizacion_pendiente", label: "Cotización Pend.", color: "bg-tertiary", glow: "shadow-[0_0_12px_rgba(200,160,240,0.4)]" },
  { id: "posible_comprador", label: "Posible Comprador", color: "bg-warning", glow: "shadow-[0_0_12px_rgba(245,158,11,0.4)]" },
  { id: "comprador", label: "Comprador", color: "bg-success", glow: "shadow-[0_0_12px_rgba(16,185,129,0.4)]" },
  { id: "descartado", label: "Descartado", color: "bg-error", glow: "shadow-[0_0_12px_rgba(248,113,113,0.4)]" },
  { id: "opt_out", label: "Opt-Out", color: "bg-gray-500", glow: "shadow-[0_0_12px_rgba(107,114,128,0.4)]" }
];

const stageOf = (status?: string) => {
  const s = String(status || "primer_contacto").toLowerCase();
  const valid = STAGES.find(x => x.id === s);
  if (valid) return valid.id;
  
  // Legacy mappings
  if (["nuevo", "new", "pending"].includes(s)) return "primer_contacto";
  if (["calificado", "qualified", "sent", "delivered", "contactado"].includes(s)) return "interesado";
  if (["oportunidad", "opportunity", "replied", "responded"].includes(s)) return "posible_comprador";
  if (["propuesta", "proposal", "cotizado"].includes(s)) return "cotizacion_pendiente";
  if (["cerrado", "closed", "won", "ganado"].includes(s)) return "comprador";
  if (["failed", "descartado"].includes(s)) return "descartado";
  return "primer_contacto";
};

function StageMenu({ lead, onMove }: { lead: any; onMove: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="sm:hidden p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors"
        title="Mover a otra etapa"
        aria-label={`Mover ${lead.name || "lead"} de etapa`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-44 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-white/5 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">
            Mover a etapa
          </div>
          <div className="p-1">
            {STAGES.map((s) => (
              <button
                key={s.id}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onMove(lead.id, s.id); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  stageOf(lead.status) === s.id ? "bg-success/10 text-success" : "text-white hover:bg-white/5"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", s.color)} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detailLead, setDetailLead] = useState<any>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "" });
  const [duplicateSuggestions, setDuplicateSuggestions] = useState<any[]>([]);

  // DetecciÃ³n de duplicados en vivo (K13)
  useEffect(() => {
    const q = newLead.phone.trim() || newLead.name.trim();
    if (q.length < 4) {
      setDuplicateSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${HELPER_URL}/api/leads/search?q=${encodeURIComponent(q)}`, {
          headers: { "x-api-key": HELPER_API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          // el endpoint de search retorna { data: items, total: number }
          const items = Array.isArray(data) ? data : data.data || [];
          setDuplicateSuggestions(items.slice(0, 3));
        }
      } catch (e) {
        // Ignorar errores de red en la bÃºsqueda interactiva
      }
    }, 400); // debounce
    return () => clearTimeout(timer);
  }, [newLead.phone, newLead.name]);

  const createLead = async () => {
    if (!newLead.name.trim() && !newLead.phone.trim()) return toast("error", "Nombre o telÃ©fono requeridos");
    setCreating(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/leads`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ ...newLead, status: "nuevo", source: "manual" }),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", "Lead creado", newLead.name || newLead.phone);
      setNewLead({ name: "", phone: "", email: "" });
      setDuplicateSuggestions([]);
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast("error", "No se pudo crear el lead", e.message);
    } finally {
      setCreating(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${HELPER_URL}/api/leads`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setLeads(data || []);
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveStage = async (leadId: string, status: string) => {
    try {
      const res = await fetch(`${HELPER_URL}/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", "Lead movido de etapa", status);
      load();
    } catch {
      toast("error", "No se pudo mover el lead");
    }
  };

const grouped = STAGES.map((stage) => {
  const items = leads
    .filter((l) => stageOf(l.status) === stage.id)
      .filter((l) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [l.name, l.phone, l.email, l.custom_fields?.interest].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    return { ...stage, items };
  });

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-success/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none border-b border-white/5 gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Pipeline de Ventas</h2>
          <p className="text-on-surface-variant font-medium">Arrastra o mueve leads entre etapas. Funciona con IA y agente activo.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en el pipeline..."
            className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
        </div>
      </header>

      <main className="flex-1 px-2 sm:px-8 py-4 sm:py-6 overflow-x-auto overflow-y-auto z-10">
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6 text-sm text-danger">
            No se pudo conectar con el backend. Verifica que el Helper Node estÃ© activo.
          </div>
        )}
        {loading && leads.length === 0 ? (
          <div className="flex gap-4 h-full">
            {[...Array(5)].map((_, i) => <div key={i} className="flex-1 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50 min-w-[260px]" />)}
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {grouped.map((stage) => (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveStage(id, stage.id);
                }}
                className="w-72 shrink-0 flex flex-col glass-panel rounded-2xl border border-white/10 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-surface-container/40">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", stage.color, stage.glow)} />
                    <span className="text-sm font-bold text-white">{stage.label}</span>
                    <span className="text-xs text-on-surface-variant">({stage.items.length})</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
                  {stage.items.length === 0 ? (
                    <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center">
                      <p className="text-xs text-on-surface-variant">Suelta leads aquÃ­</p>
                    </div>
                  ) : stage.items.map((lead: any) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); setDragging(lead.id); }}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setDetailLead(lead)}
                      className={cn(
                        "bg-surface-container-highest rounded-xl p-4 border border-white/10 cursor-pointer hover:border-primary/40 transition-all group",
                        dragging === lead.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border shrink-0", scoreClasses(lead.score))}>
                            {initials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{lead.name || "Sin nombre"}</p>
                            <p className="text-[11px] text-on-surface-variant truncate">{lead.phone || lead.email}</p>
                          </div>
                        </div>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", scoreClasses(lead.score))}>
                          {lead.score ?? 0}
                        </span>
                      </div>
                      {lead.custom_fields?.interest && (
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-2">
                          {lead.custom_fields.interest}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize", channelClasses(lead.source))}>
                          {channelLabel(lead.source)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-on-surface-variant">{formatDate(lead.updated_at || lead.created_at)}</span>
                          {/* MenÃº tÃ¡ctil para mover de etapa (mÃ³vil/tablet â€” el drag&drop no es tÃ¡ctil) */}
                          <StageMenu lead={lead} onMove={moveStage} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FAB mÃ³vil: nuevo lead */}
      <button
        onClick={() => setCreateOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-40 p-4 rounded-full bg-success/90 text-white shadow-[0_8px_30px_rgba(16,185,129,0.4)] hover:bg-success transition-all active:scale-95"
        aria-label="Nuevo lead"
        title="Nuevo lead"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo lead" description="Agrega un lead rÃ¡pido al pipeline (etapa: Nuevos).">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant">Nombre *</label>
            <input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
              placeholder="Ej: Juan PÃ©rez"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant">TelÃ©fono</label>
              <input value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                placeholder="+5215510000000"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant">Email</label>
              <input value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="juan@email.com"
                className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
            </div>
          </div>
          {/* Sugerencias de duplicados K13 */}
          {duplicateSuggestions.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 mb-2 animate-in fade-in">
              <p className="text-xs font-semibold text-warning mb-2">Posibles duplicados detectados:</p>
              <div className="space-y-2">
                {duplicateSuggestions.map(sugg => (
                  <div key={sugg.id} className="flex items-center justify-between bg-surface-container-highest p-2 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-white">{sugg.name}</p>
                      <p className="text-xs text-on-surface-variant">{sugg.phone || sugg.email}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCreateOpen(false);
                        setDetailLead(sugg);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-container hover:bg-white/10 text-white transition-colors"
                    >
                      Ver existente
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={createLead} disabled={creating}
              className="flex-1 px-4 py-2.5 rounded-xl bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold disabled:opacity-50">
              {creating ? "Creando..." : "Crear lead"}
            </button>
            <button onClick={() => setCreateOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cancelar</button>
          </div>
        </div>
      </Dialog>

      <Sheet open={!!detailLead} onClose={() => setDetailLead(null)} className="w-[540px]">
        {detailLead && (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 bg-surface-container/50 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{detailLead.name || "Sin nombre"}</h3>
                <p className="text-xs text-on-surface-variant">{detailLead.phone || detailLead.email}</p>
              </div>
              <button onClick={() => setDetailLead(null)} className="p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s) => (
                  <button key={s.id} onClick={() => moveStage(detailLead.id, s.id)}
                    className={cn("px-3 py-1 text-[11px] rounded-full border transition-colors capitalize",
                      String(detailLead.status || "nuevo") === s.id ? "bg-success/15 text-success border-success/30" : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white")}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Score IA</p>
                  <p className={cn("text-2xl font-extrabold", scoreClasses(detailLead.score))}>{detailLead.score ?? 0}</p>
                </div>
                <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Canal</p>
                  <p className="text-sm text-white font-medium capitalize">{detailLead.source || "web"}</p>
                </div>
              </div>
              {detailLead.custom_fields?.interest && (
                <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">InterÃ©s</p>
                  <p className="text-sm text-white">{detailLead.custom_fields.interest}</p>
                </div>
              )}
              {detailLead.custom_fields?.pain_point && (
                <div className="bg-surface-container/50 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Pain point</p>
                  <p className="text-sm text-white">{detailLead.custom_fields.pain_point}</p>
                </div>
              )}
              <p className="text-xs text-on-surface-variant">Creado: {formatDate(detailLead.created_at)}</p>
              <a href="/leads" className="text-xs text-primary hover:text-white transition-colors">Abrir gestiÃ³n completa de leads â†’</a>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
