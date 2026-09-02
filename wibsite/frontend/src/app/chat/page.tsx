"use client";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, channelLabel, channelClasses, stateDot, STATE_LABELS, initials, groupDot, groupBadge } from "@/lib/format";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const CHANNELS = ["all", "whatsapp", "telegram", "messenger", "email", "web"];
const STATES = ["all", "active", "greeting", "qualification", "waiting", "closed"];
const GROUP_COLORS_UI = ["primary", "success", "warning", "danger", "secondary", "tertiary"];
const PENDING_ID = "pending-review";

function StateCard({ type, title, description, retry }: { type: "error" | "empty" | "loading"; title: string; description: string; retry?: () => void }) {
  return (
    <div className="bg-surface-container-high/50 p-4 rounded-xl flex items-center justify-between gap-4 border border-white/10 w-full">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant shrink-0">
          {type === "error" ? (
            <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : type === "loading" ? (
            <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-primary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-white font-medium">{title}</p>
          <p className="text-on-surface-variant text-sm">{description}</p>
        </div>
      </div>
      {retry && (
        <button onClick={retry} className="px-4 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors shrink-0">
          Reintentar
        </button>
      )}
    </div>
  );
}

function MessageBubble({ msg, isAgent }: { msg: any; isAgent: boolean }) {
  const content = msg.content || msg.text || "";
  const mediaUrl = msg.media_url || msg.mediaUrl || msg.metadata?.media_url;
  const mediaType = msg.media_type || msg.mime_type || "";
  const isImage = /image\//.test(mediaType) || /\.(png|jpe?g|gif|webp)$/i.test(mediaUrl || "");
  const isAudio = /audio\//.test(mediaType) || /\.(ogg|mp3|m4a|wav)$/i.test(mediaUrl || "");
  const url = mediaUrl?.startsWith("/") ? `${HELPER_URL}${mediaUrl}` : mediaUrl;

  return (
    <div className={`flex gap-3 ${isAgent ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex-none flex items-center justify-center text-xs font-bold ${isAgent ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-container text-white border border-outline-variant"}`}>
        {isAgent ? "IA" : "U"}
      </div>
      <div className={`p-3 rounded-xl text-sm text-white max-w-[78%] space-y-2 ${isAgent ? "bg-primary/20 border border-primary/30 rounded-tr-sm" : "bg-surface-container-highest rounded-tl-sm"}`}>
        {isImage && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="media" className="rounded-lg max-w-[260px] border border-white/10" loading="lazy" />
        )}
        {isAudio && url && (
          <audio controls src={url} className="w-[240px] h-9" preload="metadata" />
        )}
        {content && <p className="whitespace-pre-wrap break-words">{content}</p>}
        {msg.created_at && <p className="text-[10px] text-on-surface-variant/60 text-right -mb-1">{formatDate(msg.created_at)}</p>}
      </div>
    </div>
  );
}

function InboxContent() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [snippets, setSnippets] = useState<any[]>([]);
  const [snippetPanelOpen, setSnippetPanelOpen] = useState(false);
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotPanelOpen, setCopilotPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);

  // ── Snippets ─────────────────────────────────────────
  const loadSnippets = useCallback(async () => {
    try {
      const res = await fetch(`${HELPER_URL}/api/snippets`, {
        headers: { "x-api-key": HELPER_API_KEY },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSnippets(data.data || []);
      }
    } catch {}
  }, []);

  const resolveSnippetVariables = useCallback((content: string, lead: any) => {
    if (!lead) return content;
    return content
      .replace(/\{\{name\}\}/g, lead.name || '')
      .replace(/\{\{phone\}\}/g, lead.phone || '')
      .replace(/\{\{email\}\}/g, lead.email || '')
      .replace(/\{\{score\}\}/g, String(lead.score || 0))
      .replace(/\{\{status\}\}/g, lead.status || '')
      .replace(/\{\{custom\.([^}]+)\}\}/g, (_, key) => lead.custom_fields?.[key] || '');
  }, []);

  const insertSnippet = useCallback((snippet: any) => {
    const resolvedContent = resolveSnippetVariables(snippet.content, profile);
    setMessage((prev) => prev + (prev ? '\n' : '') + resolvedContent);
    setSnippetPanelOpen(false);
  }, [profile, resolveSnippetVariables]);

  // ── Copiloto IA (A1) ─────────────────────────────────────────
  const requestCopilotSuggestion = useCallback(async () => {
    if (!selectedChat) return;
    setCopilotLoading(true);
    setCopilotSuggestion(null);
    try {
      // Find lead_id from conversation
      const phone = selectedChat.metadata?.phone || selectedChat.metadata?.senderId;
      let leadId: string | undefined;
      if (phone) {
        const leadsRes = await fetch(`${HELPER_URL}/api/leads?search=${encodeURIComponent(phone)}`, {
          headers: { "x-api-key": HELPER_API_KEY },
        });
        if (leadsRes.ok) {
          const leads = await leadsRes.json();
          const match = Array.isArray(leads) ? leads.find((l: any) => l.phone === phone) : null;
          if (match) leadId = match.id;
        }
      }

      const res = await fetch(`${HELPER_URL}/api/copilot/suggest`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedChat.conversationId || selectedChat.id,
          lead_id: leadId,
          max_tokens: 300,
          temperature: 0.5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotSuggestion(data.suggestion);
      } else {
        toast("error", "Copiloto", "No se pudo generar sugerencia");
      }
    } catch (e: any) {
      toast("error", "Copiloto", e.message);
    } finally {
      setCopilotLoading(false);
    }
  }, [selectedChat, toast]);

  const insertCopilotSuggestion = useCallback(() => {
    if (copilotSuggestion) {
      setMessage((prev) => prev + (prev ? '\n' : '') + copilotSuggestion);
      setCopilotSuggestion(null);
      setCopilotPanelOpen(false);
    }
  }, [copilotSuggestion]);

  const dismissCopilotSuggestion = useCallback(() => {
    setCopilotSuggestion(null);
    setCopilotPanelOpen(false);
  }, []);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  // ── Grupos de chat ─────────────────────────────────────────
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", criteria: "", color: "primary" });
  const [groupSaving, setGroupSaving] = useState(false);
  const [reviewingChat, setReviewingChat] = useState(false);
  const [reviewAllPending, setReviewAllPending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`${HELPER_URL}/api/conversations/default`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Backend error");
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(list);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const loadGroups = useCallback(() => {
    fetch(`${HELPER_URL}/api/chat-groups`, {
      headers: { "x-api-key": HELPER_API_KEY },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.groups) setGroups(data.groups);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadGroups();
    const t = setInterval(() => {
      load();
      loadGroups();
    }, 15000);
    return () => clearInterval(t);
  }, [load, loadGroups]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat) return;
    setProfile(null);
    setProfileLoading(true);
    const phone = selectedChat.metadata?.phone || selectedChat.metadata?.senderId;
    fetch(`${HELPER_URL}/api/leads?search=${encodeURIComponent(phone || "")}`, {
      headers: { "x-api-key": HELPER_API_KEY },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((leads) => {
        const list = Array.isArray(leads) ? leads : [];
        const match = list.find((l: any) => l.phone === phone) || list[0];
        if (!match) return setProfileLoading(false);
        return fetch(`${HELPER_URL}/api/leads/${match.id}/profile`, { headers: { "x-api-key": HELPER_API_KEY } })
          .then((r) => (r.ok ? r.json() : null))
          .then((p) => {
            setProfile(p || match);
            setProfileLoading(false);
          });
      })
      .catch(() => setProfileLoading(false));
  }, [selectedChat]);

  const displayName = (c: any) => c.metadata?.customerName || c.metadata?.name || c.metadata?.phone || c.conversationId || c.id?.slice(0, 8);
  const displayChannel = (c: any) => {
    const fromMeta = (c.metadata?.channel || c.tenantId || "").toLowerCase();
    if (fromMeta && fromMeta !== "default") return fromMeta;
    const id = String(c.conversationId || c.id || "").toLowerCase();
    for (const ch of ["telegram", "messenger", "whatsapp", "twilio", "email", "sms"]) {
      if (id.startsWith(ch)) return ch === "twilio" ? "whatsapp" : ch;
    }
    return "web";
  };
  const displayLast = (c: any) => c.messages?.at(-1)?.content || c.history?.at(-1)?.content || "Sin mensajes aún";

  // ── Helpers de grupos ──────────────────────────────────────
  const convGroupId = (c: any) => c.metadata?.chatGroup?.groupId || PENDING_ID;
  const convGroupRecord = (c: any) => c.metadata?.chatGroup || null;
  const groupById = (id: string) => groups.find((g: any) => g.id === id) || null;
  const pendingGroup = () => groups.find((g: any) => g.id === PENDING_ID) || { id: PENDING_ID, name: "Pendiente de revisión", color: "warning" };
  const countForGroup = (groupId: string) => (groupId === "" ? conversations.length : conversations.filter((c: any) => convGroupId(c) === groupId).length);

  const filtered = conversations.filter((c: any) => {
    if (channelFilter !== "all" && displayChannel(c) !== channelFilter) return false;
    if (stateFilter !== "all" && (c.state || "active") !== stateFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${displayName(c)} ${displayLast(c)} ${c.conversationId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (activeGroupId !== "" && convGroupId(c) !== activeGroupId) return false;
    return true;
  });

  const getTarget = (c: any) => {
    const ch = displayChannel(c);
    const phone = c.metadata?.phone || c.metadata?.senderId;
    if (phone) return phone;
    return String(c.conversationId || c.id).replace(/^(telegram|messenger|whatsapp|twilio)_/, "");
  };

  const sendMessage = async (text: string, mediaUrl?: string, mediaType?: string, audioBase64?: string, audioFilename?: string) => {
    if (!selectedChat) return;
    if (!text && !mediaUrl && !audioBase64) return;
    setSending(true);
    try {
      const ch = displayChannel(selectedChat);
      const to = getTarget(selectedChat);
      const res = await fetch(`${HELPER_URL}/api/chat/reply`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: ch, to, text, mediaUrl, mediaType, audioBase64, audioFilename }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast("error", "Envío fallido", data.error || `El canal ${ch} no pudo enviar el mensaje`);
      } else {
        toast("success", "Mensaje enviado", `Respondido por ${ch}`);
        setMessage("");
        load();
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      toast("error", "Error de conexión", e.message);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${HELPER_URL}/api/chat/media`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY },
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      await sendMessage("", data.url, file.type);
    } catch (e: any) {
      toast("error", "No se pudo subir el archivo", e.message);
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
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = String(reader.result).split(",")[1];
            sendMessage("", undefined, undefined, base64, "voice.webm");
          };
          reader.readAsDataURL(blob);
        }
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => recorder.stop(), 60000);
    } catch {
      toast("error", "Micrófono no disponible", "No se pudo acceder al micrófono para grabar audio");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  };

  const changeState = async (state: string) => {
    if (!selectedChat) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/conversations/default/${selectedChat.conversationId || selectedChat.id}/state`, {
        method: "PUT",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ state, reason: "Cambio manual desde Inbox" }),
      });
      if (res.ok) {
        toast("success", "Estado actualizado", STATE_LABELS[state] || state);
        load();
      } else {
        toast("error", "No se pudo cambiar el estado");
      }
    } catch {
      toast("error", "Error de conexión");
    }
  };

  const refreshSelectedChat = async (conv: any) => {
    try {
      const res = await fetch(`${HELPER_URL}/api/conversations/default/${conv.conversationId || conv.id}`, {
        headers: { "x-api-key": HELPER_API_KEY },
        cache: "no-store",
      });
      if (res.ok) {
        const fresh = await res.json();
        setSelectedChat((prev: any) => (prev && prev.id === conv.id ? fresh : prev));
      }
    } catch {
      /* el polling lo refrescará */
    }
  };

  // ── Acciones de grupos ─────────────────────────────────────
  const assignGroup = async (conv: any, groupId: string) => {
    if (!conv) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/conversations/default/${conv.conversationId || conv.id}/group`, {
        method: "PUT",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo asignar");
      }
      const target = groupById(groupId);
      toast("success", "Grupo actualizado", target ? `Asignado a "${target.name}"` : "Enviado a pendiente de revisión");
      setGroupMenuOpen(false);
      load();
      refreshSelectedChat(conv);
    } catch (e: any) {
      toast("error", "Error al asignar grupo", e.message);
    }
  };

  const createGroup = async (e?: any) => {
    e?.preventDefault?.();
    if (!newGroup.name.trim()) {
      toast("error", "Nombre requerido", "Escribe un nombre para el grupo");
      return;
    }
    setGroupSaving(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/chat-groups`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear");
      }
      const g = await res.json();
      toast("success", "Grupo creado", `"${g.name}" ya está disponible para asignar`);
      setCreateGroupOpen(false);
      setNewGroup({ name: "", description: "", criteria: "", color: "primary" });
      loadGroups();
    } catch (err: any) {
      toast("error", "Error al crear grupo", err.message);
    } finally {
      setGroupSaving(false);
    }
  };

  const updateGroup = async (g: any, patch: any) => {
    try {
      const res = await fetch(`${HELPER_URL}/api/chat-groups/${g.id}`, {
        method: "PUT",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar");
      }
      toast("success", "Grupo actualizado");
      loadGroups();
    } catch (err: any) {
      toast("error", "Error al actualizar grupo", err.message);
    }
  };

  const deleteGroup = async (g: any) => {
    if (!window.confirm(`¿Eliminar el grupo "${g.name}"? Los chats se moverán a "Pendiente de revisión".`)) return;
    try {
      const res = await fetch(`${HELPER_URL}/api/chat-groups/${g.id}`, {
        method: "DELETE",
        headers: { "x-api-key": HELPER_API_KEY },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar");
      }
      toast("success", "Grupo eliminado");
      if (activeGroupId === g.id) setActiveGroupId("");
      loadGroups();
      load();
    } catch (err: any) {
      toast("error", "Error al eliminar grupo", err.message);
    }
  };

  const reviewChat = async (conv: any) => {
    if (!conv) return;
    setReviewingChat(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/chat-groups/review`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "default", conversationId: conv.conversationId || conv.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al analizar la conversación");
      const target = data.groupId ? groupById(data.groupId) : null;
      if (target) {
        toast("success", "IA clasificó la conversación", `Asignada a "${target.name}"${data.analysis?.confidence ? ` (${Math.round(data.analysis.confidence * 100)}% de confianza)` : ""}`);
      } else {
        toast("info", "IA no encontró grupo claro", "La conversación permanece en pendiente de revisión.");
      }
      load();
      loadGroups();
      refreshSelectedChat(conv);
    } catch (err: any) {
      toast("error", "Error de IA", err.message);
    } finally {
      setReviewingChat(false);
    }
  };

  const runReviewAllPending = async () => {
    setReviewAllPending(true);
    try {
      const res = await fetch(`${HELPER_URL}/api/chat-groups/review-pending`, {
        method: "POST",
        headers: { "x-api-key": HELPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "default" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al revisar pendientes");
      toast("success", "Revisión IA completada", `${data.reviewed ?? 0} chats clasificados${data.failed ? `, ${data.failed} con error` : ""}`);
      load();
      loadGroups();
    } catch (err: any) {
      toast("error", "Error de IA", err.message);
    } finally {
      setReviewAllPending(false);
    }
  };

  if (loading && conversations.length === 0)
    return (
      <div className="p-6">
        <StateCard type="loading" title="Cargando conversaciones..." description="Conectando con el backend..." />
      </div>
    );

  if (error && conversations.length === 0)
    return (
      <div className="p-6">
        <StateCard type="error" title="Error de conexión" description="No se pudo contactar al helper. Verifica que el contenedor esté corriendo." retry={load} />
      </div>
    );

  const selGroupRec = selectedChat
    ? (convGroupRecord(selectedChat) || { groupId: PENDING_ID, status: "pending", source: "auto-pending", assignedAt: null, aiAnalysis: null })
    : null;
  const selGroup = selectedChat ? groupById(convGroupId(selectedChat)) : null;

  return (
    <div className="flex h-full gap-4 relative">
      {/* ── Left: Conversation list ── */}
      <div className={cn(
        "shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden border border-white/10",
        "w-full sm:w-72 xl:w-80",
        selectedChat ? "hidden sm:flex" : "flex"
      )}>
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en todas las fuentes..."
              className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
            />
          </div>
          {/* Filtros desplegables: canal y estado */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary appearance-none"
                title="Filtrar por canal"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch} className="bg-surface-container text-white">
                    {ch === "all" ? "Canal: Todos" : `Canal: ${channelLabel(ch)}`}
                  </option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 absolute right-2 top-2.5 text-on-surface-variant pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </div>
            <div className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary appearance-none"
                title="Filtrar por estado"
              >
                {STATES.map((st) => (
                  <option key={st} value={st} className="bg-surface-container text-white">
                    {st === "all" ? "Estado: Todos" : `Estado: ${STATE_LABELS[st] || st}`}
                  </option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 absolute right-2 top-2.5 text-on-surface-variant pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Grupos ── */}
        <div className="border-b border-white/5">
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Grupos</span>
            <button
              onClick={() => { setCreateGroupOpen((v) => !v); }}
              className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-white/5 transition-colors"
              title="Crear grupo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 5v14m-7-7h14" strokeLinecap="round" strokeWidth={2} />
              </svg>
            </button>
          </div>

          {createGroupOpen && (
            <form onSubmit={createGroup} className="px-3 pb-2 space-y-2">
              <input
                type="text"
                value={newGroup.name}
                onChange={(e) => setNewGroup((n) => ({ ...n, name: e.target.value }))}
                placeholder="Nombre (ej. Producto caliente)"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={newGroup.description}
                onChange={(e) => setNewGroup((n) => ({ ...n, description: e.target.value }))}
                placeholder="Descripción (opcional)"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                value={newGroup.criteria}
                onChange={(e) => setNewGroup((n) => ({ ...n, criteria: e.target.value }))}
                placeholder="Criterios para la IA (ej. precio, cotizar, led, no enciende)"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {GROUP_COLORS_UI.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewGroup((n) => ({ ...n, color: col }))}
                    className={`w-5 h-5 rounded-full ${groupDot(col)} border-2 transition-transform ${newGroup.color === col ? "scale-110 border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                    title={col}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={groupSaving} className="flex-1 px-2 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-medium hover:bg-primary/30 disabled:opacity-40 transition-colors">
                  {groupSaving ? "Creando..." : "Crear grupo"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateGroupOpen(false)}
                  className="px-2 py-1.5 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant text-xs hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="px-2 pb-2 space-y-0.5">
            <button
              onClick={() => setActiveGroupId("")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                activeGroupId === "" ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-white/5 hover:text-white"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", activeGroupId === "" ? "bg-primary" : "bg-outline-variant")} />
              <span className="flex-1 truncate font-medium">Todos</span>
              <span className="text-[10px] text-on-surface-variant/70">{countForGroup("")}</span>
            </button>

            <div className="group flex items-center gap-1">
              <button
                onClick={() => setActiveGroupId(PENDING_ID)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left min-w-0",
                  activeGroupId === PENDING_ID ? "bg-warning/10 text-warning" : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                )}
                title="Chats sin grupo asignado, esperando análisis del agente IA"
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", activeGroupId === PENDING_ID ? "bg-warning" : "bg-warning/60")} />
                <span className="flex-1 truncate font-medium">{pendingGroup().name}</span>
                <span className="text-[10px] text-on-surface-variant/70 shrink-0">{countForGroup(PENDING_ID)}</span>
              </button>
              <button
                onClick={runReviewAllPending}
                disabled={reviewAllPending || countForGroup(PENDING_ID) === 0}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-40 shrink-0"
                title="Revisar todos los pendientes con IA (en paralelo)"
              >
                {reviewAllPending ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </button>
            </div>

            {groups.filter((g: any) => !g.isSystem).map((g: any) => {
              const isActive = activeGroupId === g.id;
              return (
                <div key={g.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => setActiveGroupId(g.id)}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left min-w-0",
                      isActive ? "bg-primary/10 text-white" : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                    )}
                    title={`${g.name}${g.criteria ? ` — Criterio IA: ${g.criteria}` : ""}`}
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", groupDot(g.color), isActive ? "" : "opacity-70")} />
                    <span className="flex-1 truncate font-medium">{g.name}</span>
                    <span className="text-[10px] text-on-surface-variant/70 shrink-0">{countForGroup(g.id)}</span>
                  </button>
                  <button
                    onClick={() => {
                      const name = window.prompt("Nombre del grupo", g.name);
                      if (name && name.trim() && name.trim() !== g.name) updateGroup(g, { name: name.trim() });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-white/5 transition-all"
                    title="Editar nombre"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteGroup(g)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-on-surface-variant hover:text-danger hover:bg-white/5 transition-all"
                    title="Eliminar grupo"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-6">
              <StateCard type="empty" title={conversations.length === 0 ? "Inbox Vacío" : "Sin coincidencias"} description={conversations.length === 0 ? "No tienes chats activos." : "Ajusta los filtros o el buscador."} />
            </div>
          ) : (
            filtered.map((conv: any) => {
              const name = displayName(conv);
              const channel = displayChannel(conv);
              const last = displayLast(conv);
              const isSelected = selectedChat?.id === conv.id;
              const g = groupById(convGroupId(conv));
              return (
                <div
                  key={conv.id}
                  onClick={() => { setSelectedChat(conv); setShowProfile(false); }}
                  className={`p-4 cursor-pointer transition-all hover:bg-white/5 ${isSelected ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${stateDot(conv.state)}`} />
                      <span className="text-sm font-semibold text-white truncate">{name}</span>
                    </div>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", channelClasses(channel))}>
                      {channelLabel(channel)}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate pl-4">{last}</p>
                  <div className="flex items-center gap-1 pl-4 mt-1">
                    <span className="text-[10px] text-on-surface-variant/60">{STATE_LABELS[conv.state] || conv.state}</span>
                    <span className="text-[10px] text-on-surface-variant/40">•</span>
                    <span className="text-[10px] text-on-surface-variant/60">{conv.messageCount ?? 0} mensajes</span>
                    {g && (
                      <>
                        <span className="text-[10px] text-on-surface-variant/40">•</span>
                        <span className={`text-[10px] px-1.5 py-px rounded-full border flex items-center gap-1 ${groupBadge(g.color)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${groupDot(g.color)}`} />
                          {g.name}
                        </span>
</>
            )}

            {/* R4: Snippets panel overlay */}
            {snippetPanelOpen && snippets.length > 0 && (
              <>
                <div className="absolute inset-0 z-30" onClick={() => setSnippetPanelOpen(false)} />
                <div className="absolute right-12 bottom-16 z-40 w-72 max-h-80 overflow-y-auto bg-surface-container-highest border border-white/10 rounded-xl shadow-2xl p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Snippets</span>
                    <button onClick={() => setSnippetPanelOpen(false)} className="p-1 rounded text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="h-px bg-white/5" />
                  {snippets.map((snippet: any) => (
                    <button
                      key={snippet.id}
                      onClick={() => insertSnippet(snippet)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition-colors text-left"
                      title={snippet.description || snippet.name}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                        {snippet.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">{snippet.name}</span>
                        <span className="text-[10px] text-on-surface-variant/70 truncate block">
                          {snippet.content.substring(0, 50) + (snippet.content.length > 50 ? '...' : '')}
                        </span>
                      </div>
                    </button>
                  ))}
                  {snippets.length === 0 && (
                    <p className="px-2.5 py-4 text-center text-[10px] text-on-surface-variant">No hay snippets disponibles. Crea uno en Templates con categoría 'snippet'.</p>
                  )}
                </div>
              </>
            )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Center: Chat window ── */}
      <div className={cn(
        "flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden border border-white/10 min-w-0",
        !selectedChat ? "hidden sm:flex" : "flex"
      )}>
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-surface-container/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selectedChat && (
              <button
                onClick={() => setSelectedChat(null)}
                className="sm:hidden p-2 -ml-1 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors shrink-0"
                title="Volver a la lista"
                aria-label="Volver a la lista"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            )}
            {selectedChat ? (
              <>
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold border border-primary/30 text-lg shrink-0">
                  {initials(displayName(selectedChat))}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">{displayName(selectedChat)}</h3>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className={`w-1.5 h-1.5 rounded-full ${stateDot(selectedChat.state)}`} />
                    {STATE_LABELS[selectedChat.state] || selectedChat.state} · {channelLabel(displayChannel(selectedChat))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-white border border-outline-variant">C</div>
                <h3 className="font-bold text-white text-sm">Selecciona una conversación</h3>
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {selectedChat && (
              <>
                <select
                  value={selectedChat.state || "active"}
                  onChange={(e) => changeState(e.target.value)}
                  className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  title="Cambiar estado"
                >
                  {Object.entries(STATE_LABELS).map(([k, v]) => (
                    <option key={k} value={k} className="bg-surface-container text-white">{v}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowProfile((p) => !p)}
                  className={`p-2 rounded-lg transition-colors ${showProfile ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-white hover:bg-white/5"}`}
                  title="Ver perfil del cliente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Grupo del chat + acciones IA ── */}
        {selectedChat && (
          <div className="relative border-b border-white/5 bg-surface-container/30 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Grupo:</span>
            <button
              onClick={() => setGroupMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${selGroup ? cn(groupBadge(selGroup.color)) : "bg-surface-container text-on-surface-variant border-outline-variant hover:text-white"}`}
              title="Asignar a un grupo"
            >
              <span className={`w-2 h-2 rounded-full ${selGroup ? groupDot(selGroup.color) : "bg-outline-variant"}`} />
              {selGroup ? selGroup.name : "Sin grupo"}
              <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </button>

            {selGroupRec?.status === "pending" && !selGroupRec?.aiAnalysis && (
              <button
                onClick={() => reviewChat(selectedChat)}
                disabled={reviewingChat}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-warning/30 bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 disabled:opacity-50 transition-colors"
                title="Enviar al agente IA para clasificar este chat"
              >
                {reviewingChat ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                Revisar con IA
              </button>
            )}

            {selGroupRec?.aiAnalysis && (
              <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant">
                <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                IA: {(selGroupRec.aiAnalysis.suggestedGroupId && groupById(selGroupRec.aiAnalysis.suggestedGroupId)?.name) || "Sin grupo claro"} · {Math.round((selGroupRec.aiAnalysis.confidence || 0) * 100)}% confianza
              </span>
            )}

            {groupMenuOpen && (
              <>
                <div className="absolute inset-0 z-10" onClick={() => setGroupMenuOpen(false)} />
                <div className="absolute left-4 top-full mt-1 z-20 w-64 max-h-80 overflow-y-auto bg-surface-container-highest border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-0.5">
                  <button
                    onClick={() => assignGroup(selectedChat, PENDING_ID)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-warning hover:bg-warning/10 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                    <span className="flex-1">Pendiente de revisión (IA)</span>
                    {convGroupId(selectedChat) === PENDING_ID && <span className="text-[10px] text-on-surface-variant/70">actual</span>}
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  {groups.filter((g: any) => !g.isSystem).map((g: any) => (
                    <button
                      key={g.id}
                      onClick={() => assignGroup(selectedChat, g.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${groupDot(g.color)}`} />
                      <span className="flex-1 truncate">{g.name}</span>
                      {convGroupId(selectedChat) === g.id && <span className="text-[10px] text-on-surface-variant/70">actual</span>}
                    </button>
                  ))}
                  {groups.filter((g: any) => !g.isSystem).length === 0 && (
                    <p className="px-2.5 py-2 text-[10px] text-on-surface-variant">Aún no hay grupos personalizados. Créalos desde la lista lateral.</p>
                  )}
                  <div className="h-px bg-white/5 my-1" />
                  <button
                    onClick={() => { setGroupMenuOpen(false); setCreateGroupOpen(true); setActiveGroupId(""); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors text-left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 5v14m-7-7h14" strokeLinecap="round" strokeWidth={2} />
                    </svg>
                    Crear nuevo grupo...
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/30 flex flex-col">
          {!selectedChat ? (
            <div className="m-auto text-center text-on-surface-variant">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
              <p>Selecciona un lead de la izquierda para ver los mensajes.</p>
            </div>
          ) : (selectedChat.messages || selectedChat.history || []).length === 0 ? (
            <div className="m-auto text-center text-on-surface-variant text-sm opacity-60">
              Sin mensajes registrados en esta sesión.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {(selectedChat.messages || selectedChat.history || []).map((msg: any, i: number) => {
                const isAgent = msg.role === "assistant" || msg.role === "agent" || msg.direction === "outbound";
                return <MessageBubble key={i} msg={msg} isAgent={isAgent} />;
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-white/5 bg-surface-container/50 shrink-0">
          {recording && (
            <div className="mb-3 flex items-center gap-3 px-4 py-2 rounded-lg bg-danger/10 border border-danger/20">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              <span className="text-xs text-danger font-medium">Grabando audio... {recordingTime}s</span>
              <button onClick={stopRecording} className="ml-auto px-3 py-1 text-xs rounded-lg bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-colors">
                Detener
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedChat || sending}
              className="p-2.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 border border-outline-variant disabled:opacity-40 transition-colors shrink-0"
              title="Enviar imagen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!selectedChat || sending}
              className="p-2.5 rounded-lg text-on-surface-variant hover:text-danger hover:bg-white/5 border border-outline-variant disabled:opacity-40 transition-colors shrink-0"
              title={recording ? "Detener grabación" : "Grabar audio"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8" />
              </svg>
            </button>
            {/* R4: Snippets button */}
            <button
              onClick={() => setSnippetPanelOpen((v) => !v)}
              disabled={!selectedChat || sending}
              className={`p-2.5 rounded-lg transition-colors shrink-0 ${snippetPanelOpen ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-white hover:bg-white/5"} border border-outline-variant`}
              title="Snippets / Respuestas rápidas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            {/* A1: Copiloto IA button */}
            <button
              onClick={() => { requestCopilotSuggestion(); setCopilotPanelOpen(true); }}
              disabled={!selectedChat || sending || copilotLoading}
              className={`p-2.5 rounded-lg transition-colors shrink-0 ${copilotPanelOpen ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-white hover:bg-white/5"} border border-outline-variant`}
              title="Copiloto IA / Sugerir respuesta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(message)}
              placeholder={selectedChat ? "Escribe un mensaje para intervención manual..." : "Selecciona un chat primero..."}
              className="flex-1 bg-surface-container-highest border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              disabled={!selectedChat}
            />
            <button
              onClick={() => sendMessage(message)}
              disabled={!selectedChat || sending || (!message.trim())}
              className={`p-2.5 rounded-lg transition-colors shrink-0 ${!selectedChat || sending || !message.trim() ? "bg-surface-container text-on-surface-variant" : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"}`}
              title="Enviar"
            >
              {sending ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Customer profile panel (overlay en móvil) ── */}
      {selectedChat && showProfile && (
        <>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm sm:hidden z-20 animate-in fade-in duration-200" onClick={() => setShowProfile(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[340px] sm:static sm:w-80 sm:max-w-none shrink-0 flex flex-col glass-panel rounded-2xl overflow-hidden border border-white/10 z-30 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="p-6 text-center border-b border-white/5 bg-surface-container/50 relative">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-3 right-3 p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
              title="Cerrar perfil"
              aria-label="Cerrar perfil"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} />
              </svg>
            </button>
            <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-4 border-2 border-primary/30 flex items-center justify-center font-bold text-2xl text-primary">
              {initials(displayName(selectedChat))}
            </div>
            <h3 className="font-bold text-white mb-1">{displayName(selectedChat)}</h3>
            <span className="px-2 py-0.5 border rounded text-xs bg-primary/10 text-primary border-primary/20">
              {STATE_LABELS[selectedChat.state] || selectedChat.state}
            </span>
          </div>
          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            {profileLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-surface-container-high rounded" />)}
              </div>
            ) : profile ? (
              <>
                <div>
                  <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide">Score IA</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", profile.score >= 70 ? "bg-danger" : profile.score >= 40 ? "bg-warning" : "bg-primary")} style={{ width: `${profile.score || 0}%` }} />
                    </div>
                    <span className="text-sm font-bold text-white">{profile.score ?? 0}</span>
                  </div>
                  {profile.scoreCategory && <p className="text-xs text-on-surface-variant mt-1 capitalize">{profile.scoreCategory}</p>}
                </div>
                {(profile.customFields?.interest || profile.customFields?.message) && (
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide">Interés detectado</p>
                    <p className="text-sm text-white bg-surface-container px-3 py-2 rounded-lg border border-white/5">
                      {profile.customFields?.interest || profile.customFields?.message}
                    </p>
                  </div>
                )}
                {profile.nextAction && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-xs text-success uppercase tracking-wide mb-0.5">Siguiente acción sugerida</p>
                    <p className="text-sm text-white font-medium capitalize">{profile.nextAction.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{profile.nextAction.reason}</p>
                  </div>
                )}
                {profile.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((t: string) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-on-surface-variant">{t}</span>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide">Contacto</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-white">{profile.phone || "Sin teléfono"}</p>
                    <p className="text-white">{profile.email || "Sin email"}</p>
                    <p className="text-on-surface-variant capitalize">Fuente: {profile.source || "web"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide">Entregas</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface-container rounded-lg p-2 text-center"><p className="text-white font-bold">{profile.deliveryStats?.total ?? 0}</p><p className="text-on-surface-variant">Total</p></div>
                    <div className="bg-surface-container rounded-lg p-2 text-center"><p className="text-success font-bold">{profile.deliveryStats?.replied ?? 0}</p><p className="text-on-surface-variant">Respuestas</p></div>
                    <div className="bg-surface-container rounded-lg p-2 text-center"><p className="text-primary font-bold">{profile.deliveryStats?.read ?? 0}</p><p className="text-on-surface-variant">Leídos</p></div>
                    <div className="bg-surface-container rounded-lg p-2 text-center"><p className="text-danger font-bold">{profile.deliveryStats?.failed ?? 0}</p><p className="text-on-surface-variant">Fallidos</p></div>
                  </div>
                </div>
                {profile.scoreHistory?.length > 0 && (
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wide">Historial de scoring</p>
                    <div className="space-y-1">
                      {profile.scoreHistory.slice(0, 5).map((s: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs bg-surface-container px-2 py-1.5 rounded">
                          <span className="text-on-surface-variant">{formatDate(s.classifiedAt)}</span>
                          <span className={cn("font-bold", s.score >= 70 ? "text-danger" : s.score >= 40 ? "text-warning" : "text-primary")}>{s.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">Sin perfil de lead asociado a esta conversación.</p>
            )}
          </div>
        </div>
</>
            )}

            {/* A1: Copiloto IA panel overlay */}
            {copilotPanelOpen && copilotSuggestion && (
              <>
                <div className="absolute inset-0 z-30" onClick={() => { setCopilotPanelOpen(false); setCopilotSuggestion(null); }} />
                <div className="absolute right-12 bottom-16 z-40 w-80 max-h-80 overflow-y-auto bg-surface-container-highest border border-primary/30 rounded-xl shadow-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-medium">AI</span>
                      <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Copiloto IA</span>
                    </div>
                    <button onClick={() => { setCopilotPanelOpen(false); setCopilotSuggestion(null); }} className="p-1 rounded text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="h-px bg-primary/30" />
                  <div className="px-1 py-2 text-sm text-white whitespace-pre-wrap bg-surface-container rounded-lg border border-white/5 p-2">
                    {copilotSuggestion}
                  </div>
                  <div className="flex gap-2 px-1">
                    <button
                      onClick={insertCopilotSuggestion}
                      disabled={copilotLoading}
                      className="flex-1 px-3 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-medium hover:bg-primary/30 disabled:opacity-50 transition-colors"
                    >
                      {copilotLoading ? 'Insertando...' : 'Insertar respuesta'}
                    </button>
                    <button
                      onClick={dismissCopilotSuggestion}
                      className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant border border-outline-variant text-xs hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </>
            )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-success/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <header className="px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-end z-10 flex-none border-b border-white/5 gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Inbox Omnicanal</h2>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-1 hidden sm:block">Conversaciones de WhatsApp, Telegram, Messenger y Email con filtros, búsqueda unificada y agrupación por IA.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-on-surface-variant flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="hidden sm:inline">Auto-reply IA: Activo</span>
            <span className="sm:hidden">IA Activa</span>
          </span>
        </div>
      </header>
      <main className="flex-1 px-2 sm:px-4 md:px-8 py-3 sm:py-4 pb-14 sm:pb-6 overflow-hidden z-10">
        <Suspense fallback={<div className="p-8 text-center animate-pulse text-on-surface-variant">Cargando inbox...</div>}>
          <InboxContent />
        </Suspense>
      </main>
    </div>
  );
}
