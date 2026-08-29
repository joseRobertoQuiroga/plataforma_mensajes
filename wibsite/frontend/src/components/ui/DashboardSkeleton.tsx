// src/components/ui/DashboardSkeleton.tsx
// Follows Glacier skeleton-pulse pattern from plantillas/skeleton_dashboard/code.html

export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="skeleton-block h-8 w-64" />
          <div className="skeleton-block h-4 w-80 opacity-60" />
        </div>
        <div className="skeleton-block h-8 w-36 rounded-full" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex justify-between">
              <div className="skeleton-block h-3 w-28" />
              <div className="skeleton-block h-8 w-8 rounded-lg" />
            </div>
            <div className="skeleton-block h-10 w-24" />
            <div className="skeleton-block h-10 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="skeleton-block h-5 w-40" />
            <div className="skeleton-block h-40 w-full" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <div className="skeleton-block h-5 w-48" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
            <div className="skeleton-block h-8 w-8 rounded-full flex-none" />
            <div className="skeleton-block h-4 w-32" />
            <div className="skeleton-block h-6 w-16 rounded-md ml-auto" />
            <div className="skeleton-block h-4 w-20" />
            <div className="skeleton-block h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
