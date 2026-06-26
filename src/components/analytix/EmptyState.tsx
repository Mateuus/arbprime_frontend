import React from 'react';

interface Props {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Estado vazio reutilizável (primeiro acesso / filtro sem resultado / erro). */
export default function EmptyState({ icon, title, message, action, className = '' }: Props) {
  return (
    <div className={`rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center ${className}`}>
      {icon && (
        <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20 text-teal-300 mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {message && <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
