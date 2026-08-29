"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { cn, channelLabel, channelClasses, formatDate } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

export default function AutomationPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [modules, setModules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState({ channel: "telegram", text: "", to: "" });
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch(`${HELPER_URL}/api/channels/status`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
      fetch(`${HELPER_URL}/api/notifications`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
      fetch(`${HELPER_URL}/api/internal/module-status`, { headers: { "x-api-key": HELPER_API_KEY }, cache: "no-store" }),
    ])
      .then(([a, b, c]) => Promise.all([a.json().catch(() => ({})), b.json().catch(() => ({})), c.json().catch(() => ({}))]))
      .then(([ch, notif, mod]) => {
        setChannels(ch.data || []);
        setNotifications(notif.data || []);
        setModules(mod);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendTest = async () => {
    if (!broadcast.text.trim() || !broadcast.to.trim()) return toast("error", "Completa el mensaje y el destinatario");
    setSending(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/channels/test`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: broadcast.channel, to: broadcast.to, text: broadcast.text }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", "Envío fallido", d.error || `HTTP ${res.status}`);
      } else {
        toast("success", "Mensaje de prueba enviado", `${broadcast.channel} → ${broadcast.to}`);
        setBroadcast({ ...broadcast, text: "" });
      }
    } catch (e: any) {
      toast("error", "Error de conexión", e.message);
    } finally {
      setSending(false);
    }
  };

  const statusMeta = (s: string) => {
    switch (s) {
      case "connected": case "configured": case "active": case "healthy":
        return { label: s, cls: "bg-success/10 text-success border-success/30", dot: "bg-success animate-pulse" };
      case "pending": case "connecting":
        return { label: s, cls: "bg-warning/10 text-warning border-warning/30", dot: "bg-warning animate-pulse" };
      default:
        return { label: s || "disconnected", cls: "bg-danger/10 text-danger border-danger/30", dot: "bg-danger" };
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-primary/5 rounded-full blur-[150px] pointer-events-none -z-10" />

      <header className="px-4 sm:px-8 py-5 sm:py-8 flex justify-between items-end z-10 flex-none border-b border-white/5 gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Automatización y Conectividad</h2>
          <p className="text-on-surface-variant font-medium">Estado de canales, eventos SOAC y envíos de prueba.</p>
        </div>
        <div className="flex gap-2">
          <a href="https://localhost:8080/n8n/" target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all text-sm font-medium">
            Abrir n8n
          </a>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 overflow-y-auto z-10">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-64 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />
            <div className="h-64 glass-panel rounded-2xl animate-pulse bg-surface-container-high/50" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Canales */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xl font-bold text-white mb-4">Estado de Canales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {channels.map((ch: any) => {
                  const meta = statusMeta(ch.status);
                  return (
                    <div key={ch.channel} className="glass-panel p-5 rounded-xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center border", channelClasses(ch.channel))}>
                          <span className="text-lg font-bold">{channelLabel(ch.channel).charAt(0)}</span>
                        </div>
                        <div>
                          <h4 className="text-white font-bold capitalize">{channelLabel(ch.channel)}</h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">{ch.status_message || (ch.configured ? "Configurado" : "Sin configurar")}</p>
                          {ch.last_checked_at && <p className="text-[10px] text-on-surface-variant/60 mt-0.5">Verificado: {formatDate(ch.last_checked_at)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                        <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium border capitalize", meta.cls)}>{meta.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alertas SOAC */}
              <h3 className="text-xl font-bold text-white mb-4">Eventos y Alertas (SOAC)</h3>
              {notifications.length === 0 ? (
                <div className="glass-panel rounded-2xl p-6 text-center border border-white/5">
                  <p className="text-sm text-success">Sin incidentes ni eventos en las últimas 24h.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n: any, i: number) => (
                    <div key={i} className={cn("glass-panel rounded-xl p-4 border flex items-center gap-3",
                      n.type === "incident" ? "border-danger/20" : n.type === "security" ? "border-warning/20" : "border-primary/20")}>
                      <span className={cn("w-2 h-2 rounded-full shrink-0", n.type === "incident" ? "bg-danger animate-pulse" : n.type === "security" ? "bg-warning" : "bg-primary")} />
                      <p className="text-sm text-white flex-1">{n.text}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-on-surface-variant capitalize">{n.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prueba de envío + módulos */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white mb-4">Probar envío</h3>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Canal</label>
                  <select value={broadcast.channel} onChange={(e) => setBroadcast({ ...broadcast, channel: e.target.value })}
                    className="w-full mt-1.5 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                    <option value="telegram" className="bg-surface-container text-white">Telegram</option>
                    <option value="whatsapp" className="bg-surface-container text-white">WhatsApp</option>
                    <option value="messenger" className="bg-surface-container text-white">Messenger</option>
                    <option value="email" className="bg-surface-container text-white">Email</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Destinatario (ID de chat / teléfono / email)</label>
                  <input value={broadcast.to} onChange={(e) => setBroadcast({ ...broadcast, to: e.target.value })}
                    placeholder="Ej: 123456789 o +5215510000000"
                    className="w-full mt-1.5 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Mensaje</label>
                  <textarea value={broadcast.text} onChange={(e) => setBroadcast({ ...broadcast, text: e.target.value })}
                    rows={3} placeholder="Escribe el mensaje de prueba..."
                    className="w-full mt-1.5 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary resize-y" />
                </div>
                <button onClick={sendTest} disabled={sending}
                  className="w-full py-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors text-sm font-semibold disabled:opacity-50">
                  {sending ? "Enviando..." : "Enviar prueba"}
                </button>
              </div>

              <h3 className="text-xl font-bold text-white mb-4">Módulos del sistema</h3>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-3">
                {modules && typeof modules === "object" && Object.entries(modules).slice(0, 12).map(([k, v]: [string, any]) => {
                  const ok = v === true || v?.ok === true || v?.status === "ok" || v?.healthy === true;
                  const label = typeof v === "object" ? (v.status || v.message || "—") : String(v);
                  return (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="text-white capitalize flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", ok ? "bg-success" : "bg-danger")} />
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-on-surface-variant truncate max-w-[140px]">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}