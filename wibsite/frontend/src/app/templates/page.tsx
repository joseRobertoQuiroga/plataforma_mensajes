"use client";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import { cn, channelLabel, channelClasses, formatDate } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "messenger", label: "Messenger" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "tiktok", label: "TikTok" },
];

const CATEGORIES = [
  { value: "welcome", label: "Bienvenida" },
  { value: "promotion", label: "Promoción" },
  { value: "followup", label: "Seguimiento" },
  { value: "notification", label: "Notificación" },
  { value: "newsletter", label: "Newsletter" },
  { value: "custom", label: "Personalizada" },
];

function extractVariables(body: string): string[] {
  const vars = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) vars.add(m[1]);
  return [...vars];
}

function MultiSelect({
  label,
  icon,
  options,
  selected,
  onToggle,
  allLabel,
}: {
  label: string;
  icon?: ReactNode;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = selected.size;
  const labelText = count === 0 ? allLabel : `${label}: ${count} seleccionado${count > 1 ? "s" : ""}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap",
          count > 0
            ? "bg-secondary/20 text-secondary border-secondary/30"
            : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
        )}
      >
        {icon}
        <span>{labelText}</span>
        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
            {label}
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => onToggle(o.value)}
                  className="w-4 h-4 rounded accent-[#0e7490]"
                />
                <span className="text-sm text-white">{o.label}</span>
              </label>
            ))}
          </div>
          {count > 0 && (
            <div className="p-2 border-t border-white/5">
              <button
                onClick={() => selected.forEach((v) => onToggle(v))}
                className="w-full py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateForm({ initial, onSaved, onClose }: { initial?: any; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: initial?.name || "",
    channel: initial?.channel || "whatsapp",
    category: initial?.category || "custom",
    description: initial?.description || "",
    subject: initial?.subject || "",
    body: initial?.body || "",
  });
  const [saving, setSaving] = useState(false);
  const variables = extractVariables(form.body);

  const submit = async () => {
    if (!form.name.trim() || !form.body.trim()) return toast("error", "Nombre y mensaje son obligatorios");
    setSaving(true);
    try {
      if (initial) {
        const del = await fetch(`${HELPER_URL}/api/templates/${initial.id}`, { method: "DELETE", headers: { "x-api-key": HELPER_API_KEY } });
        if (!del.ok) throw new Error("No se pudo reemplazar la plantilla");
      }
      const res = await fetch(`${HELPER_URL}/api/templates`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, variables }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error");
      }
      toast("success", initial ? "Plantilla actualizada" : "Plantilla creada", form.name);
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-on-surface-variant">Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="promo_lanzamiento_v1"
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-on-surface-variant">Descripción</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Propósito de la plantilla"
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Canal *" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={CHANNELS} />
        <Select label="Categoría" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES} />
      </div>
      {form.channel === "email" && (
        <div>
          <label className="text-xs font-medium text-on-surface-variant">Asunto</label>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Asunto del email"
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary mt-1.5" />
        </div>
      )}
      <Textarea label="Mensaje * (usa {{variable}})" value={form.body} onChange={(v) => setForm({ ...form, body: v })} rows={5}
        placeholder="Hola {{name}}, tenemos una oferta especial: {{offer}}..." />
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <span key={v} className="text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 font-mono">{`{{${v}}}`}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-colors text-sm font-semibold disabled:opacity-50">
          {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear plantilla"}
        </button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cancelar</button>
      </div>
    </div>
  );
}

function TemplatePreview({ template, onClose }: { template: any; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);

  const variables = extractVariables(template.body || "");

  useEffect(() => {
    const init: Record<string, string> = {};
    variables.forEach((v, i) => { init[v] = i === 0 ? "Juan Pérez" : i === 1 ? "Wibsite Business" : `valor_${v}`; });
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const render = () => {
    let body = template.body || "";
    for (const [k, v] of Object.entries(values)) body = body.replaceAll(`{{${k}}}`, v || `{{${k}}}`);
    let subject = template.subject || "";
    for (const [k, v] of Object.entries(values)) subject = subject.replaceAll(`{{${k}}}`, v || `{{${k}}}`);
    return { body, subject, charCount: body.length };
  };

  const filled = render();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", channelClasses(template.channel))}>{channelLabel(template.channel)}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-surface-container text-on-surface-variant">{template.category}</span>
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", filled.charCount > (template.max_length || 0) ? "bg-danger/10 text-danger border-danger/30" : "bg-success/10 text-success border-success/30")}>
          {filled.charCount} chars{filled.subject ? ` · asunto` : ""}
        </span>
      </div>

      {variables.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Valores de ejemplo</p>
          {variables.map((v) => (
            <div key={v}>
              <label className="text-xs font-medium text-on-surface-variant font-mono">{`{{${v}}}`}</label>
              <input value={values[v] || ""} onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                className="w-full bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1" />
            </div>
          ))}
        </div>
      )}

      {filled.subject && (
        <div className="bg-surface-container/40 rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-1">Asunto</p>
          <p className="text-sm text-white font-medium">{filled.subject}</p>
        </div>
      )}

      <div className="bg-surface-container/50 rounded-xl p-4 border border-white/5">
        <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mb-2">Vista previa (simulador de WhatsApp)</p>
        <div className="max-w-sm mx-auto bg-surface-container-highest rounded-2xl p-4 shadow-lg border border-white/10">
          <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
            <div className="w-7 h-7 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">{channelLabel(template.channel).charAt(0)}</div>
            <div>
              <p className="text-xs font-bold text-white">{channelLabel(template.channel)}</p>
              <p className="text-[10px] text-on-surface-variant">Wibsite Business</p>
            </div>
          </div>
          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{filled.body}</p>
          <p className="text-[10px] text-on-surface-variant text-right mt-2">✓✓ {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      </div>

      <button onClick={onClose} className="w-full px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant border border-outline-variant hover:text-white transition-colors text-sm">Cerrar</button>
    </div>
  );
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);

  const toggleChannel = (v: string) =>
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const toggleCategory = (v: string) =>
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${HELPER_URL}/api/templates`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setTemplates(data || []);
        setError(false);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (t: any) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/templates/${t.id}`, { method: "DELETE", headers: { "x-api-key": HELPER_API_KEY } });
      if (!res.ok) throw new Error("Error");
      toast("success", "Plantilla eliminada", t.name);
      load();
    } catch {
      toast("error", "No se pudo eliminar");
    }
  };

  const filtered = templates.filter((t) => {
    if (selectedChannels.size > 0 && !selectedChannels.has(t.channel)) return false;
    if (selectedCategories.size > 0 && !selectedCategories.has(t.category)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (![t.name, t.body, t.description].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[50vw] h-[50vw] bg-secondary/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none border-b border-white/5 gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Biblioteca de Plantillas</h2>
          <p className="text-on-surface-variant font-medium">Mensajes preaprobados con variables para todos tus canales.</p>
        </div>
        <button onClick={() => { setEditing(null); setCreateOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-all font-medium text-sm shadow-[0_0_20px_rgba(167,139,250,0.1)]">
          + Nueva Plantilla
        </button>
      </header>

      <main className="flex-1 px-3 sm:px-8 py-5 sm:py-6 overflow-y-auto z-10">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plantillas..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
          </div>
          <MultiSelect
            label="Canal"
            allLabel="Todos los canales"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            options={CHANNELS}
            selected={selectedChannels}
            onToggle={toggleChannel}
          />
          <MultiSelect
            label="Categoría"
            allLabel="Todas las categorías"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            }
            options={CATEGORIES}
            selected={selectedCategories}
            onToggle={toggleCategory}
          />
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6 text-sm text-danger">
            No se pudo conectar con el backend. Verifica que el Helper Node esté activo.
          </div>
        )}

        {loading && templates.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <div key={i} className="h-[280px] glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-white/10">
            <p className="text-white font-medium mb-1">Sin plantillas</p>
            <p className="text-sm text-on-surface-variant mb-4">{templates.length === 0 ? "Crea tu primera plantilla de mensaje." : "Ajusta los filtros o el buscador."}</p>
            {templates.length === 0 && (
              <button onClick={() => { setEditing(null); setCreateOpen(true); }} className="px-5 py-2.5 rounded-lg bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-colors text-sm font-semibold">
                + Nueva Plantilla
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((t) => {
              const vars = extractVariables(t.body);
              return (
                <div key={t.id} className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-secondary/30 transition-colors border border-white/5 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium", channelClasses(t.channel))}>{channelLabel(t.channel)}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-surface-container text-on-surface-variant">{t.category}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(t); setCreateOpen(true); }} className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => remove(t)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-danger hover:bg-white/5 transition-colors" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-secondary transition-colors truncate">{t.name}</h3>

                  <div className="bg-surface-container/30 p-3 rounded-lg border border-white/5 mb-3 flex-1 text-sm text-on-surface-variant overflow-y-auto font-mono max-h-[110px]">
                    {t.body}
                  </div>

                  {vars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {vars.map((v) => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-auto border-t border-white/5 pt-4">
                    <div className="text-xs text-on-surface-variant">{t.max_length ? `${t.body.length}/${t.max_length} chars` : formatDate(t.created_at)}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setPreviewing(t)} className="text-xs font-semibold text-secondary hover:text-white transition-colors">Vista previa</button>
                      <button onClick={() => { setEditing(t); setCreateOpen(true); }} className="text-xs font-semibold text-secondary hover:text-white transition-colors">Editar →</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={editing ? "Editar plantilla" : "Nueva plantilla"}
        description="Define el mensaje con variables {{name}}, {{offer}}, etc." className="max-w-xl">
        <TemplateForm initial={editing} onSaved={load} onClose={() => setCreateOpen(false)} />
      </Dialog>

      <Dialog open={!!previewing} onClose={() => setPreviewing(null)} title="Vista previa" description="Simula el mensaje con valores de ejemplo." className="max-w-lg">
        {previewing && <TemplatePreview template={previewing} onClose={() => setPreviewing(null)} />}
      </Dialog>
    </div>
  );
}