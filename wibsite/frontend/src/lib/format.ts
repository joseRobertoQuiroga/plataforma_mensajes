export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDateFull(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function scoreCategory(score = 0): "hot" | "warm" | "cold" | "unscored" {
  if (!score) return "unscored";
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function scoreClasses(score = 0) {
  const cat = scoreCategory(score);
  switch (cat) {
    case "hot": return "bg-danger/10 text-danger border-danger/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]";
    case "warm": return "bg-warning/10 text-warning border-warning/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]";
    case "cold": return "bg-primary/10 text-primary border-primary/30 shadow-[0_0_10px_rgba(125,211,252,0.15)]";
    default: return "bg-surface-container-high text-on-surface-variant border-outline-variant";
  }
}

export function scoreLabel(score = 0) {
  const cat = scoreCategory(score);
  return cat === "unscored" ? "Sin score" : cat === "hot" ? "Caliente" : cat === "warm" ? "Tibio" : "Frío";
}

export const CHANNEL_META: Record<string, { label: string; color: string; text: string; border: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30", text: "text-[#25D366]", border: "border-[#25D366]/30" },
  twilio: { label: "WhatsApp", color: "bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30", text: "text-[#25D366]", border: "border-[#25D366]/30" },
  telegram: { label: "Telegram", color: "bg-primary/20 text-primary border-primary/30", text: "text-primary", border: "border-primary/30" },
  messenger: { label: "Messenger", color: "bg-[#0084ff]/20 text-[#0084ff] border-[#0084ff]/30", text: "text-[#0084ff]", border: "border-[#0084ff]/30" },
  email: { label: "Email", color: "bg-warning/20 text-warning border-warning/30", text: "text-warning", border: "border-warning/30" },
  sms: { label: "SMS", color: "bg-tertiary/20 text-tertiary border-tertiary/30", text: "text-tertiary", border: "border-tertiary/30" },
  tiktok: { label: "TikTok", color: "bg-tertiary/20 text-tertiary border-tertiary/30", text: "text-tertiary", border: "border-tertiary/30" },
  web: { label: "Web", color: "bg-secondary/20 text-secondary border-secondary/30", text: "text-secondary", border: "border-secondary/30" },
};

export function channelLabel(channel?: string) {
  return CHANNEL_META[String(channel || "web").toLowerCase()]?.label || channel || "Web";
}

export function channelClasses(channel?: string) {
  return CHANNEL_META[String(channel || "web").toLowerCase()]?.color || CHANNEL_META.web.color;
}

export const STATE_LABELS: Record<string, string> = {
  active: "Activo",
  greeting: "Saludo",
  qualification: "Calificando",
  closed: "Cerrado",
  waiting: "Esperando",
  new: "Nuevo",
};

export function stateDot(state?: string) {
  switch (state) {
    case "active": return "bg-success animate-pulse";
    case "greeting": return "bg-primary animate-pulse";
    case "qualification": return "bg-warning";
    case "waiting": return "bg-secondary";
    default: return "bg-outline-variant";
  }
}

export function initials(name?: string | null) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

export const GROUP_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  primary: { dot: "bg-primary", badge: "bg-primary/10 text-primary border-primary/30", text: "text-primary" },
  success: { dot: "bg-success", badge: "bg-success/10 text-success border-success/30", text: "text-success" },
  warning: { dot: "bg-warning", badge: "bg-warning/10 text-warning border-warning/30", text: "text-warning" },
  danger: { dot: "bg-danger", badge: "bg-danger/10 text-danger border-danger/30", text: "text-danger" },
  secondary: { dot: "bg-secondary", badge: "bg-secondary/10 text-secondary border-secondary/30", text: "text-secondary" },
  tertiary: { dot: "bg-tertiary", badge: "bg-tertiary/10 text-tertiary border-tertiary/30", text: "text-tertiary" },
};

export function groupDot(color?: string) {
  return GROUP_COLORS[color || "primary"]?.dot || GROUP_COLORS.primary.dot;
}

export function groupBadge(color?: string) {
  return GROUP_COLORS[color || "primary"]?.badge || GROUP_COLORS.primary.badge;
}

export function groupText(color?: string) {
  return GROUP_COLORS[color || "primary"]?.text || GROUP_COLORS.primary.text;
}