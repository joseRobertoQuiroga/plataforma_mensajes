"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Aquí enviaríamos el error al SOAC (Elasticsearch) vía API
    console.error("Error reportado al SOAC:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 bg-slate-900 text-slate-100">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
        {error.message || "Se produjo un error inesperado al cargar esta vista."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition"
      >
        Intentar nuevamente
      </button>
    </div>
  );
}