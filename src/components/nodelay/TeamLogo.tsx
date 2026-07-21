import { useState } from 'react';
import { teamLogoUrl } from '@/utils/teamLogo';

/**
 * Escudo do time. Renderiza a imagem (via teamLogoUrl) quando há `sofascoreId`; se
 * faltar ou a imagem falhar (onError), cai num fallback CAPRICHADO: escudo redondo
 * com as iniciais do time e uma cor derivada do nome (determinística). Pequeno,
 * redondo, tamanho de badge, lazy-load.
 *
 * ATENÇÃO: o SoFaScore bloqueia hotlink (403 fora da origem deles), então o
 * fallback É o estado visível por ora — por isso ele foi feito p/ ficar bom. Quando
 * o proxy `/teams/logo/{id}` existir, basta trocar `teamLogoUrl` (um único ponto).
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Paleta de acentos p/ o fallback — cores frias/neutras que combinam com o tema
// escuro (nada de lime, reservado ao NoDelay). A cor sai do hash do nome → o mesmo
// time tem sempre a mesma cor.
const PALETTE = [
  { bg: 'rgba(56,189,248,0.15)', ring: 'rgba(56,189,248,0.4)', fg: '#7dd3fc' },   // sky
  { bg: 'rgba(244,114,182,0.15)', ring: 'rgba(244,114,182,0.4)', fg: '#f9a8d4' }, // pink
  { bg: 'rgba(251,191,36,0.15)', ring: 'rgba(251,191,36,0.4)', fg: '#fcd34d' },   // amber
  { bg: 'rgba(129,140,248,0.15)', ring: 'rgba(129,140,248,0.4)', fg: '#a5b4fc' }, // indigo
  { bg: 'rgba(45,212,191,0.15)', ring: 'rgba(45,212,191,0.4)', fg: '#5eead4' },   // teal
  { bg: 'rgba(248,113,113,0.15)', ring: 'rgba(248,113,113,0.4)', fg: '#fca5a5' }, // red
  { bg: 'rgba(192,132,252,0.15)', ring: 'rgba(192,132,252,0.4)', fg: '#d8b4fe' }, // violet
  { bg: 'rgba(163,163,163,0.15)', ring: 'rgba(163,163,163,0.4)', fg: '#d4d4d4' }, // neutral
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function TeamLogo({ name, sofascoreId, size = 32 }: { name: string; sofascoreId?: number | string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImg = sofascoreId != null && String(sofascoreId).trim() !== '' && !failed;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={teamLogoUrl(sofascoreId!)}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        // SEM círculo/clip: escudos não-redondos (ex.: Flamengo listrado) apareceriam
        // cortados dentro de rounded-full. object-contain preserva a forma real do
        // escudo, centralizado no quadrado. O círculo fica só no fallback de iniciais.
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: escudo com iniciais numa cor derivada do nome.
  const c = colorFor(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        backgroundColor: c.bg,
        color: c.fg,
        boxShadow: `inset 0 0 0 1px ${c.ring}`,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
