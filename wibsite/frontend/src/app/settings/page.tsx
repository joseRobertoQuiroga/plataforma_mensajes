"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Select, Textarea, Switch } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, formatDateFull } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const TYPE_META: Record<string, { label: string; cls: string }> = {
  producto: { label: "Producto / Oferta", cls: "bg-primary/10 text-primary border-primary/30" },
  faq: { label: "Pregunta frecuente", cls: "bg-secondary/10 text-secondary border-secondary/30" },
  contexto: { label: "Contexto de negocio", cls: "bg-tertiary/10 text-tertiary border-tertiary/30" },
  estandar: { label: "EstÃ¡ndar / Seguimiento", cls: "bg-warning/10 text-warning border-warning/30" },
  analisis: { label: "AnÃ¡lisis / Mercado", cls: "bg-danger/10 text-danger border-danger/30" },
  objetivo: { label: "Objetivo / Expectativa", cls: "bg-success/10 text-success border-success/30" },
};

function KnowledgeForm({ initial, onSaved, onClose }: { initial?: any; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    type: initial?.type || "producto",
    title: initial?.title || "",
    content: initial?.content || "",
    items: initial?.items || [""],
  });
  const [saving, setSaving] = useState(false);

  const setItem = (i: number, v: string) => {
    const items = [...form.items];
    items[i] = v;
    setForm({ ...form, items });
  };

  const submit = async () => {
    if (!form.title.trim()) return toast("error", "El tÃ­tulo es obligatorio");
    setSaving(true);
    try {
      const body = { ...form, items: form.items.map((i: string) => i.trim()).filter(Boolean) };
      const res = await fetch(`${HELPER_URL}/api/agent/knowledge${initial ? `/${initial.id}` : ""}`, {
        method: initial ? "PATCH" : "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error");
      }
      toast("success", initial ? "Lote actualizado" : "InformaciÃ³n cargada al agente", form.title);
      onSaved();
      onClose();
    } catch (e: any) {
      toast("error", "No se pudo guardar", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Select
        label="Tipo de informaciÃ³n"
        value={form.type}
        onChange={(v) => setForm({ ...form, type: v })}
        options={Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }))}
      />
      <div>
        <label className="text-xs font-medium text-on-surface-variant">TÃ­tulo del lote *</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ej: Plan ProMax â€” precios y variaciones 2026"
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
      </div>
      <Textarea label="Detalle / contexto" value={form.content} onChange={(v) => setForm({ ...form, content: v })} rows={3}
        placeholder="InformaciÃ³n detallada que el agente debe conocer y usar en las conversaciones..." />
      <div>
        <label className="text-xs font-medium text-on-surface-variant">Puntos clave (opcional)</label>
        <div className="space-y-2 mt-1.5">
          {form.items.map((item: string, i: number) => (
            <div key={i} className="flex gap-2">
              <input value={item} onChange={(e) => setItem(i, e.target.value)}
                placeholder={`Punto ${i + 1}`}
                className="flex-1 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
              <button
                onClick={() => {
                  if (form.items.length === 1) return;
                  setForm({ ...form, items: form.items.filter((_: string, j: number) => j !== i) });
                }}
                disabled={form.items.length === 1}
                className="p-2 rounded-lg text-on-surface-variant hover:text-danger transition-colors disabled:opacity-30"
                aria-label="Quitar punto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setForm({ ...form, items: [...form.items, ""] })}
          className="mt-2 text-xs font-semibold text-primary hover:text-white transition-colors">
          + Agregar punto
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold disabled:opacity-50">
          {saving ? "Guardando..." : initial ? "Guardar cambios" : "Cargar informaciÃ³n"}
        </button>
        <button onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cancelar</button>
      </div>
    </div>
  );
}

function AgentForm({ initial, onSaved, onClose, personalities, businessTypes }: { initial?: any; onSaved: () => void; onClose: () => void; personalities: any[]; businessTypes: any[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: initial?.name || "",
    personality: initial?.personality || "profesional_amigable",
    tone: initial?.tone || "formal",
    business_type: initial?.business_type || "productos_fisicos",
    description: initial?.description || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast("error", "El nombre del agente es obligatorio");
    setSaving(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/agents${initial ? `/${initial.id}` : ""}`, {
        method: initial ? "PUT" : "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Error");
      toast("success", initial ? "Agente actualizado" : "Agente creado", form.name);
      onSaved();
      onClose();
    } catch (e: any) {
      toast("error", "No se pudo guardar el agente", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-on-surface-variant">Nombre del agente *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ej: Wally, Yimi..."
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Personalidad" value={form.personality} onChange={(v) => setForm({ ...form, personality: v })}
          options={personalities.map((p) => ({ value: p.id, label: p.label }))} />
        <div>
          <label className="text-xs font-medium text-on-surface-variant">Tono principal</label>
          <input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
            placeholder="formal, cercano, persuasivo..."
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
        </div>
      </div>
      <Select label="Tipo de negocio" value={form.business_type} onChange={(v) => setForm({ ...form, business_type: v })}
        options={businessTypes.map((b) => ({ value: b.id, label: b.label }))} />
      <Textarea label="Rol / descripciÃ³n" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2}
        placeholder="Ej: Asesor de ventas enfocado en cierres y propuestas..." />
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-tertiary/20 text-tertiary border border-tertiary/30 hover:bg-tertiary/30 transition-colors text-sm font-semibold disabled:opacity-50">
          {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear agente"}
        </button>
        <button onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cancelar</button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ businessTypes: any[]; personalities: any[] }>({ businessTypes: [], personalities: [] });
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [knowledgeTotal, setKnowledgeTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"general" | "conocimiento" | "productos" | "horario" | "campos" | "prueba">("general");
  const [products, setProducts] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testMedia, setTestMedia] = useState<{ url: string; type: string } | null>(null);
  const [graphResult, setGraphResult] = useState<{ path: string[]; stages: string[]; turnCount: number } | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${HELPER_URL}/api/agent/config`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
      fetch(`${HELPER_URL}/api/agents`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
      fetch(`${HELPER_URL}/api/agent/knowledge?grouped=true`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
    ])
      .then(([a, b, c]) => Promise.all([a.json(), b.json(), c.json()]))
      .then(([cfg, agentsData, kb]) => {
        setConfig(cfg);
        setProducts(cfg.products || []);
        setFaqs(cfg.faqs || []);
        setAgents(agentsData.agents || []);
        setActiveAgentId(agentsData.activeAgentId);
        setCatalog({ businessTypes: agentsData.businessTypes || [], personalities: agentsData.personalities || [] });
        setKnowledge(kb.data || []);
        setKnowledgeTotal(kb.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next?: any) => {
    const payload = next || config;
    setSaving(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/agent/config`, {
        method: "PUT",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, products, faqs }),
      });
      if (!res.ok) throw new Error("Error");
      const updated = await res.json();
      setConfig(updated);
      toast("success", "ConfiguraciÃ³n del agente guardada");
    } catch (e: any) {
      toast("error", "No se pudo guardar", e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string, v: any) => setConfig((c: any) => ({ ...c, [k]: v }));

  const activateAgent = async (id: string) => {
    try {
      const res = await fetch(`${HELPER_URL}/api/agents/${id}/activate`, { method: "POST", headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Error");
      setActiveAgentId(id);
      toast("success", "Agente activado");
      load();
    } catch {
      toast("error", "No se pudo activar el agente");
    }
  };

  const removeAgent = async (a: any) => {
    if (!confirm(`Â¿Eliminar al agente "${a.name}"?`)) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/agents/${a.id}`, { method: "DELETE", headers: { "x-api-key": HELPER_API_KEY } });
      if (!res.ok) throw new Error("Error");
      toast("success", "Agente eliminado", a.name);
      load();
    } catch {
      toast("error", "No se pudo eliminar el agente");
    }
  };

  const removeKnowledge = async (k: any) => {
    if (!confirm(`Â¿Eliminar el lote "${k.title}"?`)) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/agent/knowledge/${k.id}`, { method: "DELETE", headers: { "x-api-key": HELPER_API_KEY } });
      if (!res.ok) throw new Error("Error");
      toast("success", "Lote eliminado", k.title);
      load();
    } catch {
      toast("error", "No se pudo eliminar el lote");
    }
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${HELPER_URL}/api/chat/media`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const d = await res.json();
      return d.url;
    } catch (e: any) {
      toast("error", "No se pudo subir el archivo", e.message);
      return null;
    }
  };

  const testChat = async (mediaOverride?: { url: string; type: string }) => {
    const media = mediaOverride || testMedia;
    if (!testMessage.trim() && !media) return;
    setTestLoading(true);
    setTestResult("");
    try {
      const body: any = { message: testMessage, tenantId: "default", contact_name: "Test", platform: "web", agent_id: activeAgentId || undefined };
      if (media) {
        body.mediaUrl = media.url;
        body.mediaType = media.type;
      }
      const res = await fetch(`${HELPER_URL}/api/agent/chat`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      const raw = d.reply || d.message || d.error || JSON.stringify(d);
      try {
        const parsed = JSON.parse(raw);
        const agentName = d.agent?.name ? `${d.agent.name} Â· ` : "";
        setTestResult(`${agentName}${parsed.response || raw}${parsed.stage ? `\n\n[Etapa: ${parsed.stage} Â· IntenciÃ³n: ${parsed.intent || "â€”"} Â· AutonomÃ­a: ${parsed.autonomyZone || "â€”"} Â· Siguiente: ${parsed.nextAction || "â€”"}]` : ""}`);
      } catch {
        setTestResult(raw);
      }
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  // R15: Simulador de conversacion expuesto desde settings (grafo de nodos)
  const testGraph = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    setTestResult("");
    setGraphResult(null);
    try {
      const res = await fetch(`${HELPER_URL}/api/agent/test-graph`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage, conversationId: `sim-${Date.now()}` }),
      });
      const d = await res.json();
      const final = d.final || {};
      const raw = typeof final.text === "string" ? final.text : final.text?.text || final.response || d.error || JSON.stringify(d);
      setTestResult(raw);
      setGraphResult({
        path: Array.isArray(d.path) ? d.path : [],
        stages: Array.isArray(d.context?.stages) ? d.context.stages : [],
        turnCount: d.context?.turnCount ?? d.path?.length ?? 0,
      });
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordingTime(0);
        if (blob.size > 0) {
          setTestLoading(true);
          try {
            const res = await fetch(`${HELPER_URL}/api/agent/chat`, {
              method: "POST",
              headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                message: testMessage,
                audioBase64: await blobToBase64(blob),
                agent_id: activeAgentId || undefined,
              }),
            });
            const d = await res.json();
            setTestResult(d.reply || d.message || d.error || JSON.stringify(d));
          } catch (e: any) {
            setTestResult(`Error: ${e.message}`);
          } finally {
            setTestLoading(false);
          }
        }
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => recorder.stop(), 60000);
    } catch {
      toast("error", "MicrÃ³fono no disponible", "No se pudo acceder al micrÃ³fono para grabar audio");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-10 w-1/3 bg-surface-container-high rounded" />
        <div className="h-64 glass-panel rounded-2xl bg-surface-container-high/50" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8">
        <div className="glass-panel rounded-2xl p-10 text-center border border-white/10">
          <p className="text-white font-medium mb-1">No se pudo cargar la configuraciÃ³n del agente</p>
          <p className="text-sm text-on-surface-variant mb-4">Verifica que el Helper Node estÃ© activo.</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm">Reintentar</button>
        </div>
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === activeAgentId) || null;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[40vw] h-[40vw] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none border-b border-white/5 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">Agente IA de Ventas</h2>
          <p className="text-on-surface-variant text-sm font-medium">
            Multi-agente: crea, entrena y supervisa a tus vendedores virtuales.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Switch checked={config.auto_reply_enabled} onChange={(v) => set("auto_reply_enabled", v)} label="Auto-reply" description={config.auto_reply_enabled ? "El agente responde solo" : "Respuestas manuales"} />
          <button onClick={() => save()} disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-tertiary/20 text-tertiary border border-tertiary/30 hover:bg-tertiary/30 transition-all font-medium text-sm shadow-[0_0_20px_rgba(167,139,250,0.1)] disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar configuraciÃ³n"}
          </button>
        </div>
      </header>

      {/* Selector de agentes */}
      <div className="px-4 sm:px-8 py-3 border-b border-white/5 flex items-center gap-2 overflow-x-auto z-10">
        <span className="text-xs text-on-surface-variant uppercase tracking-wide mr-1 shrink-0">Agentes:</span>
        {agents.length === 0 && (
          <span className="text-xs text-on-surface-variant italic">No hay agentes creados todavÃ­a.</span>
        )}
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => activateAgent(a.id)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors flex items-center gap-2",
                a.id === activeAgentId ? "bg-success/20 text-success border-success/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]" : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
              )}
              title={`Activar ${a.name}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", a.id === activeAgentId ? "bg-success animate-pulse" : "bg-outline-variant")} />
              {a.name}
            </button>
            <button
              onClick={() => { setEditingAgent(a); setAgentOpen(true); }}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
              title={`Editar ${a.name}`}
              aria-label={`Editar agente ${a.name}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button
              onClick={() => removeAgent(a)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-danger hover:bg-white/5 transition-colors"
              title={`Eliminar ${a.name}`}
              aria-label={`Eliminar agente ${a.name}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => { setEditingAgent(null); setAgentOpen(true); }}
          className="px-3 py-1.5 rounded-full border border-dashed border-outline-variant text-xs font-semibold text-on-surface-variant hover:text-white hover:border-primary/40 transition-colors shrink-0"
        >
          + Nuevo agente
        </button>
        {activeAgent && (
          <span className="ml-auto text-[11px] text-on-surface-variant shrink-0 hidden sm:inline">
            Activo: <span className="text-success font-semibold">{activeAgent.name}</span> Â· {catalog.personalities.find((p) => p.id === activeAgent.personality)?.label || activeAgent.personality}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-8 py-3 flex gap-2 border-b border-white/5 z-10 overflow-x-auto">
        {([["general", "General"], ["conocimiento", `Conocimiento (${knowledgeTotal})`], ["productos", "Productos y FAQs"], ["horario", "Horario"], ["prueba", "Probar chat"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
              tab === id ? "bg-tertiary/20 text-tertiary border border-tertiary/30" : "text-on-surface-variant hover:text-white border border-transparent")}>
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-3 sm:px-8 py-5 sm:py-6 overflow-y-auto z-10 max-w-5xl">
        {tab === "general" && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-white mb-1">Identidad del agente {activeAgent && <span className="text-success">Â· {activeAgent.name}</span>}</h3>
              <p className="text-xs text-on-surface-variant mb-4">Los datos base se aplican al perfil activo; cada agente conserva su nombre, tono y personalidad.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Nombre del negocio</label>
                  <input value={config.business_name} onChange={(e) => set("business_name", e.target.value)}
                    className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Tono</label>
                  <input value={config.tone} onChange={(e) => set("tone", e.target.value)}
                    className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary mt-1.5" />
                </div>
                <Select label="Tipo de negocio" value={config.business_type} onChange={(v) => set("business_type", v)}
                  options={catalog.businessTypes.map((b) => ({ value: b.id, label: b.label }))} />
                <Select label="Personalidad base" value={config.personality} onChange={(v) => set("personality", v)}
                  options={catalog.personalities.map((p) => ({ value: p.id, label: p.label }))} />
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-on-surface-variant">DescripciÃ³n del negocio</label>
                <Textarea value={config.description} onChange={(v) => set("description", v)} rows={2} className="mt-1.5" />
              </div>
              <div className="mt-4">
                <label className="text-xs font-medium text-on-surface-variant">Saludo inicial</label>
                <Textarea value={config.greeting} onChange={(v) => set("greeting", v)} rows={2} className="mt-1.5" />
              </div>
            </div>
          </div>
        )}

        {tab === "conocimiento" && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-white">Conocimiento del Agente</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    Toda la informaciÃ³n que le cargues se agrupa por fecha y hora; el agente la usa como contexto en sus conversaciones.
                  </p>
                </div>
                <button onClick={() => { setEditingKnowledge(null); setKnowledgeOpen(true); }}
                  className="px-4 py-2 rounded-lg bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold shrink-0">
                  + Agregar informaciÃ³n
                </button>
              </div>

              {knowledge.length === 0 ? (
                <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 text-center">
                  <p className="text-sm text-on-surface-variant mb-1">AÃºn no has cargado informaciÃ³n al agente.</p>
                  <p className="text-xs text-on-surface-variant mb-4">Carga productos, contexto de negocio, estÃ¡ndares de seguimiento, anÃ¡lisis de mercado u objetivos.</p>
                  <button onClick={() => { setEditingKnowledge(null); setKnowledgeOpen(true); }}
                    className="px-4 py-2 rounded-lg bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors text-sm font-semibold">
                    + Cargar mi primer lote de informaciÃ³n
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {knowledge.map((group) => (
                    <div key={group.day}>
                      {/* Cabecera de fecha */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold text-primary capitalize">{group.label}</span>
                        <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant">
                          {group.total} lote{group.total !== 1 ? "s" : ""}
                        </span>
                        <div className="flex-1 h-px bg-outline-variant/50" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {group.batches.map((k: any) => {
                          const meta = TYPE_META[k.type] || TYPE_META.contexto;
                          return (
                            <div key={k.id} className="glass-panel rounded-2xl p-5 border border-white/10 group relative">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", meta.cls)}>{meta.label}</span>
                                  <span className="text-[10px] text-on-surface-variant/70">{formatDate(k.created_at)}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => { setEditingKnowledge(k); setKnowledgeOpen(true); }}
                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" title="Editar lote" aria-label={`Editar lote ${k.title}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                  <button onClick={() => removeKnowledge(k)}
                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-danger hover:bg-white/5 transition-colors" title="Eliminar lote" aria-label={`Eliminar lote ${k.title}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </div>
                              <h4 className="text-white font-bold mb-1.5">{k.title}</h4>
                              {k.content && <p className="text-sm text-on-surface-variant whitespace-pre-wrap mb-2">{k.content}</p>}
                              {k.items.length > 0 && (
                                <ul className="space-y-1">
                                  {k.items.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-white">
                                      <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "productos" && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Productos / Servicios</h3>
                <button onClick={() => setProducts([...products, { name: "", description: "", price: "" }])}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-xs font-semibold">+ Agregar</button>
              </div>
              {products.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">Sin productos configurados. El agente responderÃ¡ "consulta por lista de productos".</p>
              ) : (
                <div className="space-y-3">
                  {products.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 items-center">
                      <input value={p.name} onChange={(e) => { const np = [...products]; np[i] = { ...p, name: e.target.value }; setProducts(np); }}
                        placeholder="Nombre" className="bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                      <input value={p.description} onChange={(e) => { const np = [...products]; np[i] = { ...p, description: e.target.value }; setProducts(np); }}
                        placeholder="DescripciÃ³n" className="bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                      <input value={p.price} onChange={(e) => { const np = [...products]; np[i] = { ...p, price: e.target.value }; setProducts(np); }}
                        placeholder="Precio" className="bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                      <button onClick={() => setProducts(products.filter((_, j) => j !== i))}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-danger transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Preguntas frecuentes (FAQs)</h3>
                <button onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-xs font-semibold">+ Agregar</button>
              </div>
              {faqs.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">Sin FAQs configuradas.</p>
              ) : (
                <div className="space-y-3">
                  {faqs.map((f, i) => (
                    <div key={i} className="space-y-2 p-3 bg-surface-container/40 rounded-xl border border-white/5">
                      <div className="flex gap-2">
                        <input value={f.question} onChange={(e) => { const nf = [...faqs]; nf[i] = { ...f, question: e.target.value }; setFaqs(nf); }}
                          placeholder="Pregunta" className="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                        <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-danger transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <input value={f.answer} onChange={(e) => { const nf = [...faqs]; nf[i] = { ...f, answer: e.target.value }; setFaqs(nf); }}
                        placeholder="Respuesta" className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "horario" && (
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Horario de atenciÃ³n</h3>
            <div className="space-y-3">
              {DAYS.map((d) => {
                const slot = config.business_hours?.[d];
                return (
                  <div key={d} className="flex items-center gap-3 flex-wrap">
                    <span className="w-28 text-sm text-white capitalize">{d}</span>
                    <input type="time" value={slot?.start || ""}
                      onChange={(e) => set("business_hours", { ...config.business_hours, [d]: slot ? { ...slot, start: e.target.value } : { start: e.target.value, end: "18:00" } })}
                      className="bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    <span className="text-on-surface-variant text-xs">a</span>
                    <input type="time" value={slot?.end || ""}
                      onChange={(e) => set("business_hours", { ...config.business_hours, [d]: slot ? { ...slot, end: e.target.value } : { start: "09:00", end: e.target.value } })}
                      className="bg-surface-container-highest border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                    {slot && (
                      <button onClick={() => set("business_hours", { ...config.business_hours, [d]: null })}
                        className="text-[11px] px-2 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors">
                        Desactivar
                      </button>
                    )}
                    {!slot && (
                      <button onClick={() => set("business_hours", { ...config.business_hours, [d]: { start: "09:00", end: "18:00" } })}
                        className="text-[11px] px-2 py-1 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors">
                        Activar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

                {tab === "campos" && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Campos Personalizados (Leads)</h3>
                  <p className="text-xs text-on-surface-variant">Configura los campos custom para el formulario de prospectos y reglas de segmentacin.</p>
                </div>
                <button onClick={() => {
                  const current = config.custom_fields || [];
                  set("custom_fields", [...current, { name: "", label: "", type: "text", required: false }]);
                }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all font-medium text-sm">
                  + Nuevo Campo
                </button>
              </div>

              <div className="space-y-3">
                {!(config.custom_fields?.length > 0) && (
                  <div className="text-center py-8 text-on-surface-variant text-sm bg-surface-container/50 rounded-xl border border-white/5">
                    No hay campos configurados
                  </div>
                )}
                {(config.custom_fields || []).map((cf: any, i: number) => (
                  <div key={i} className="flex flex-wrap md:flex-nowrap gap-3 p-4 rounded-xl bg-surface-container-highest border border-white/5 items-start">
                    <div className="flex-1 space-y-3 min-w-[200px]">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-on-surface-variant mb-1 block">Label (Visible UI)</label>
                          <input value={cf.label} onChange={(e) => {
                            const clone = [...config.custom_fields];
                            clone[i].label = e.target.value;
                            if(!clone[i].name) clone[i].name = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
                            set("custom_fields", clone);
                          }}
                            placeholder="Ej: Presupuesto"
                            className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-variant mb-1 block">Key (Backend/API)</label>
                          <input value={cf.name} onChange={(e) => {
                            const clone = [...config.custom_fields];
                            clone[i].name = e.target.value;
                            set("custom_fields", clone);
                          }}
                            placeholder="ej: presupuesto_usd"
                            className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-mono text-[11px]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                          <input type="checkbox" checked={cf.required || false} onChange={e => {
                            const clone = [...config.custom_fields];
                            clone[i].required = e.target.checked;
                            set("custom_fields", clone);
                          }} className="rounded bg-surface border-white/20 text-primary focus:ring-primary focus:ring-offset-surface-container" />
                          Obligatorio
                        </label>
                        <div className="flex-1">
                          <select value={cf.type || "text"} onChange={e => {
                            const clone = [...config.custom_fields];
                            clone[i].type = e.target.value;
                            set("custom_fields", clone);
                          }} className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
                            <option value="text">Texto corto</option>
                            <option value="number">Nmero</option>
                            <option value="boolean">Si / No</option>
                            <option value="date">Fecha</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => {
                      const clone = [...config.custom_fields];
                      clone.splice(i, 1);
                      set("custom_fields", clone);
                    }}
                      className="p-2 text-on-surface-variant hover:text-danger hover:bg-danger/10 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "prueba" && (
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-1">Probar el agente</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Conversa, envÃ­a imÃ¡genes o graba audios. Todo responde con el contexto e informaciÃ³n cargada{activeAgent ? ` por ${activeAgent.name}` : ""}.
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await uploadMedia(f);
                if (url) {
                  setTestMedia({ url, type: f.type });
                  toast("success", "Imagen cargada", "Se enviarÃ¡ como contexto visual al agente");
                }
              }} />
            {testMedia && (
              <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <span className="text-xs text-primary font-medium">Imagen lista para enviar</span>
                <button onClick={() => setTestMedia(null)} className="ml-auto text-xs text-on-surface-variant hover:text-white transition-colors">Quitar</button>
              </div>
            )}
            {recording && (
              <div className="mb-3 flex items-center gap-3 px-4 py-2 rounded-lg bg-danger/10 border border-danger/20">
                <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
                <span className="text-xs text-danger font-medium">Grabando audio... {recordingTime}s</span>
                <button onClick={stopRecording} className="ml-auto px-3 py-1 text-xs rounded-lg bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-colors">
                  Detener y enviar
                </button>
              </div>
            )}
            <Textarea value={testMessage} onChange={setTestMessage} rows={3} placeholder="Ej: Hola, quiero informaciÃ³n sobre sus precios y planes" />
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => testChat()} disabled={testLoading || (!testMessage.trim() && !testMedia)}
                className="px-5 py-2.5 rounded-xl bg-tertiary/20 text-tertiary border border-tertiary/30 hover:bg-tertiary/30 transition-colors text-sm font-semibold disabled:opacity-50">
                {testLoading ? <span className="inline-flex items-center gap-2"><span className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" /> Pensando...</span> : "Enviar prueba"}
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={testLoading}
                className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm font-medium disabled:opacity-50">
                ðŸ–¼ Enviar imagen
              </button>
              <button onClick={testGraph} disabled={testLoading || !testMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-colors text-sm font-medium disabled:opacity-50"
                title="Simula la conversacion recorriendo el grafo comercial y muestra la ruta de nodos">
                Probar agente (grafo)
              </button>
              <button onClick={recording ? stopRecording : startRecording} disabled={testLoading}
                className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm font-medium disabled:opacity-50">
                {recording ? "â¹ Detener grabaciÃ³n" : "ðŸŽ¤ Grabar audio"}
              </button>
            </div>
            {testResult && (
              <div className="mt-4">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Respuesta del agente</p>
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm text-white whitespace-pre-wrap">{testResult}</p>
                </div>
              </div>
            )}
            {graphResult && (
              <div className="mt-4">
                <p className="text-xs text-on-surface-variant uppercase tracking-wide mb-2">Ruta del grafo ({graphResult.turnCount} nodos)</p>
                <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {graphResult.path.map((node, i) => (
                      <span key={`${node}-${i}`} className="inline-flex items-center gap-1.5">
                        {i > 0 && <span className="text-on-surface-variant text-xs">→</span>}
                        <span className="px-2 py-0.5 rounded-md bg-secondary/20 text-secondary border border-secondary/30 text-xs font-medium capitalize">{node}</span>
                      </span>
                    ))}
                  </div>
                  {graphResult.stages.length > 0 && (
                    <p className="text-xs text-on-surface-variant mt-3">Etapas: {graphResult.stages.join(" → ")}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)}
        title={editingKnowledge ? "Editar lote de informaciÃ³n" : "Cargar informaciÃ³n al agente"}
        description="Se agruparÃ¡ automÃ¡ticamente por la fecha y hora actual. Tipos: productos, FAQs, contexto, estÃ¡ndares, anÃ¡lisis y objetivos." className="max-w-xl">
        <KnowledgeForm initial={editingKnowledge} onSaved={load} onClose={() => setKnowledgeOpen(false)} />
      </Dialog>

      <Dialog open={agentOpen} onClose={() => setAgentOpen(false)}
        title={editingAgent ? "Editar agente" : "Nuevo agente"}
        description="Define el nombre, personalidad y tono del vendedor virtual." className="max-w-lg">
        <AgentForm initial={editingAgent} onSaved={load} onClose={() => setAgentOpen(false)}
          personalities={catalog.personalities} businessTypes={catalog.businessTypes} />
      </Dialog>
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}