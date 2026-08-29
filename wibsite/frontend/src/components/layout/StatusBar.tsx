"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

const HELPER_URL = (process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100") === "/api" ? "" : process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

interface Service {
  name: string;
  status: boolean;
  label: string;
}

export function StatusBar() {
  const { theme, toggle } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [version, setVersion] = useState("—");

  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetch(`${HELPER_URL}/api/internal/health-detailed`, {
        headers: { "x-api-key": HELPER_API_KEY },
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((h) => {
          if (!mounted) return;
          setVersion(h.version || "—");
          const deps = h.dependencies || {};
          const online = !!h.version || deps.postgresql?.status === "connected" || h.status === "ok";
          setServices([
            { name: "Helper", status: online, label: online ? "Online" : "Offline" },
            { name: "PostgreSQL", status: deps.postgresql?.status === "connected", label: deps.postgresql?.status || "—" },
            { name: "Redis", status: deps.redis?.status === "available", label: deps.redis?.status || "—" },
            { name: "Elastic (SOAC)", status: String(deps.elastic?.status || "").includes("connected"), label: deps.elastic?.status || "—" },
            { name: "Weaviate", status: deps.weaviate?.status === "connected", label: deps.weaviate?.status || "—" },
            { name: "LLM", status: deps.llm?.status === "configured", label: deps.llm?.model || "No config." },
          ]);
        })
        .catch(() => mounted && setServices([]));
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <footer className="glass-status-bar fixed bottom-0 left-0 lg:left-64 right-0 px-4 sm:px-6 py-2 flex justify-between items-center text-[11px] font-medium text-on-surface-variant z-30">
      <div className="flex items-center gap-5 overflow-x-auto no-scrollbar hidden md:flex">
        {services.length === 0 ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            Sin conexión al helper — verifica SOAC
          </span>
        ) : (
          services.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`relative flex h-1.5 w-1.5 ${s.status ? "" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.status ? "bg-success" : "bg-danger"}`} />
              </span>
              <span>{s.name}:</span>
              <span className={s.status ? "text-success" : "text-danger"}>{s.label}</span>
            </div>
          ))
        )}
      </div>

      {/* Estado compacto en móvil */}
      <div className="flex items-center gap-1.5 md:hidden">
        {services.length > 0 ? (
          <>
            <span className={`w-2 h-2 rounded-full ${services[0]?.status ? "bg-success animate-pulse" : "bg-danger"}`} />
            <span>{services[0]?.status ? "Sistema Online" : "Sistema Offline"}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" /> Sin conexión
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="opacity-60 hidden sm:inline">Wibsite 2.0</span>
        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">v{version}</span>
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg border border-white/10 bg-surface-container text-on-surface-variant hover:text-white transition-colors"
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label="Cambiar tema"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}