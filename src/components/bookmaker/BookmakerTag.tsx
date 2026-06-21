import { useState } from 'react';
import { useBookmakers } from '@/hooks/useBookmakers';

interface LogoProps {
  name: string;
  slug: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

/**
 * Logo/ícone da casa. Usa a imagem cadastrada; sem imagem (ou se quebrar) cai
 * num monograma com a cor da casa. Props explícitas — serve tanto para o
 * cadastro (preview) quanto para o <BookmakerTag> (que resolve pelo slug).
 */
export function BookmakerLogo({ name, slug, logoUrl, color, size = 20, className = '' }: LogoProps) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };
  if (logoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={name || slug}
        onError={() => setBroken(true)}
        style={dim}
        className={`rounded object-contain bg-white/5 shrink-0 ${className}`}
      />
    );
  }
  return (
    <span
      style={{ ...dim, background: color || '#5eead4', fontSize: size * 0.5 }}
      className={`grid place-items-center rounded font-bold text-slate-900 shrink-0 ${className}`}
    >
      {(name || slug || '?').charAt(0).toUpperCase()}
    </span>
  );
}

interface TagProps {
  slug: string;
  size?: number;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}

/**
 * Ícone + nome da casa. O nome usa a COR cadastrada da casa. Resolve os dados
 * pelo slug no registro (useBookmakers); se a casa não estiver cadastrada,
 * mostra o slug como nome e um monograma neutro.
 */
export function BookmakerTag({ slug, size = 18, showName = true, className = '', nameClassName = '' }: TagProps) {
  const { getBookmaker } = useBookmakers();
  const b = getBookmaker(slug);
  const name = b?.name || slug;
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <BookmakerLogo name={name} slug={slug} logoUrl={b?.logoUrl} color={b?.color} size={size} />
      {showName && (
        <span className={`font-medium truncate ${nameClassName}`} style={{ color: b?.color || undefined }}>
          {name}
        </span>
      )}
    </span>
  );
}

export default BookmakerTag;
