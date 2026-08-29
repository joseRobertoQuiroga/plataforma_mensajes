export default function Loading() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
      <p className="text-sm text-slate-400">Cargando módulo...</p>
    </div>
  );
}