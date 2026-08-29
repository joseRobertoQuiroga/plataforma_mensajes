"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

const routes = [
  {
    label: "Dashboard",
    href: "/dashboard",
    color: "#7dd3fc",
    activeGlow: "rgba(125,211,252,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "/chat",
    color: "#10b981",
    activeGlow: "rgba(16,185,129,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Leads",
    href: "/leads",
    color: "#c8a0f0",
    activeGlow: "rgba(200,160,240,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    color: "#34d399",
    activeGlow: "rgba(52,211,153,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Campañas",
    href: "/campaigns",
    color: "#f59e0b",
    activeGlow: "rgba(245,158,11,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Plantillas",
    href: "/templates",
    color: "#88b4cc",
    activeGlow: "rgba(136,180,204,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Reportes",
    href: "/reports",
    color: "#7dd3fc",
    activeGlow: "rgba(125,211,252,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Automatización",
    href: "/automation",
    color: "#c8a0f0",
    activeGlow: "rgba(200,160,240,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
  {
    label: "Agente IA",
    href: "/settings",
    color: "#a78bfa",
    activeGlow: "rgba(167,139,250,0.15)",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      </svg>
    ),
  },
];

interface SearchResult {
  type: "lead" | "campaign";
  id: string;
  title: string;
  subtitle: string;
  score?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Cerrar drawer al navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setResultsOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`${HELPER_URL}/api/search?q=${encodeURIComponent(query)}&limit=6`, {
        headers: { "x-api-key": HELPER_API_KEY },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setResults([...(d.leads || []), ...(d.campaigns || [])]);
          setResultsOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResultsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (r: SearchResult) => {
    setResultsOpen(false);
    setQuery("");
    router.push(r.type === "lead" ? "/leads" : "/campaigns");
  };

  return (
    <>
      {/* Botón hamburguesa (móvil/tablet) — se oculta cuando el drawer está abierto */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl glass-panel border border-white/10 text-white shadow-lg transition-all duration-300",
          open && "opacity-0 pointer-events-none -translate-x-2"
        )}
        aria-label="Abrir menú"
        title="Abrir menú"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop del drawer (móvil) */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "glass-sidebar w-64 flex-col h-full z-50",
          "fixed inset-y-0 left-0 -translate-x-full transition-transform duration-300",
          open && "translate-x-0",
          "lg:static lg:translate-x-0 lg:flex"
        )}
      >
      <div className="h-20 flex items-center px-8 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-lg font-bold text-white">W</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Wibsite</h1>
            <p className="text-xs text-on-surface-variant">Sales Automation</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden ml-auto p-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} />
          </svg>
        </button>
      </div>

      {/* Buscador global */}
      <div className="px-4 pt-4 relative" ref={boxRef}>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar leads, campañas..."
            className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-on-surface-variant focus:outline-none focus:border-primary"
          />
          {searching && (
            <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {resultsOpen && (
          <div className="absolute left-4 right-4 top-full mt-2 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl z-50">
            {results.length === 0 ? (
              <p className="p-4 text-xs text-on-surface-variant">Sin resultados para &quot;{query}&quot;</p>
            ) : (
              results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${r.type === "lead" ? "bg-primary/10 text-primary border-primary/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                    {r.type === "lead" ? "Lead" : "Campaña"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{r.title}</span>
                    <span className="block text-xs text-on-surface-variant truncate">{r.subtitle}</span>
                  </span>
                  {r.score !== undefined && (
                    <span className="text-xs font-bold text-primary">{r.score}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto mt-4 px-4 space-y-1">
        {routes.map((route) => {
          const isActive = pathname === route.href || pathname.startsWith(route.href + "/");
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive ? "nav-active" : "text-on-surface-variant nav-item"
              )}
              style={isActive ? { color: route.color } : undefined}
            >
              <span className="transition-colors" style={{ color: isActive ? route.color : undefined }}>
                {route.icon}
              </span>
              <span className="font-medium text-sm">{route.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold border border-white/10 text-sm">
            N
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin</p>
            <p className="text-xs text-on-surface-variant truncate">wibsite.com</p>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}