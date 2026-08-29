"use client";

interface StateCardProps {
  type: 'error' | 'empty' | 'success';
  title: string;
  description: string;
  retryAction?: boolean;
}

export function StateCard({ type, title, description, retryAction }: StateCardProps) {
  const isError = type === 'error';
  const isSuccess = type === 'success';
  const color = isError ? "danger" : isSuccess ? "success" : "primary";

  const icon = isError ? (
    <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : isSuccess ? (
    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-primary opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );

  return (
    <div
      className={`
        bg-surface-container-high/50 p-4 rounded-xl flex items-center justify-between gap-4
        border border-${color}/10 hover:border-${color}/30 transition-colors w-full group
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full bg-${color}/10 flex items-center justify-center border border-${color}/30 flex-none`}>
          {icon}
        </div>
        <div>
          <p className="text-white font-medium">{title}</p>
          <p className={`text-${color}/80 text-sm`}>{description}</p>
        </div>
      </div>
      {retryAction && (
        <button
          onClick={() => window.location.reload()}
          className={`px-4 py-1.5 rounded-lg border border-${color}/30 bg-${color}/10 text-${color} text-sm font-medium hover:bg-${color}/20 transition-colors flex-none`}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
