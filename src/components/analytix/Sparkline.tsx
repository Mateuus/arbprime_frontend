import React from 'react';

interface Props {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Mini gráfico de linha (SVG puro — sem dependência de chart lib, seguro p/ SSR).
 * Usado nos KPI cards.
 */
export default function Sparkline({ data, color = '#5eead4', width = 96, height = 32, className = '' }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${points.join(' L ')}`;
  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;
  const id = `spark-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
