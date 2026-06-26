import React from 'react';

/** Iniciais (abreviação) do nome de exibição: "Mateuus" → "MA", "Carlos Arb" → "CA". */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}

/** Avatar da Comunidade: imagem quando há; senão, abreviação do nome. */
export default function Avatar({ src, name, size = 40, className = '' }: Props) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`rounded-full object-cover bg-white/5 shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      className={`grid place-items-center rounded-full bg-teal-500/20 text-teal-200 font-bold shrink-0 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
