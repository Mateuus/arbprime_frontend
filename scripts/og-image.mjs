// Gera a imagem de preview social (Open Graph) do ArbPrime — 1200x630.
// Usada por WhatsApp, Telegram, X/Twitter, Facebook etc. ao compartilhar o link.
//
// Como regenerar (após editar a copy abaixo):
//   node scripts/og-image.mjs
// Saída: public/og.png
//
// Requer `sharp` (já é dependência do projeto).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "og.png");

const W = 1200;
const H = 630;

// ---- Copy do card (edite aqui) ------------------------------------------
const WORDMARK_A = "Arb";
const WORDMARK_B = "Prime";
const TAGLINE = "Lucro garantido com surebets";
const SUBLINE = "Value bets · Cripto · Casas brasileiras · Tempo real";
const URL = "www.arbprime.pro";
// -------------------------------------------------------------------------

const FONT = "Ubuntu, 'DejaVu Sans', 'Liberation Sans', sans-serif";

// Marca "A" (mesmo path do favicon), embutida num cartão arredondado à esquerda.
const logoCard = (x, y, size) => {
  const s = size / 512; // viewBox original do favicon é 512
  return `
    <g transform="translate(${x},${y}) scale(${s})">
      <rect width="512" height="512" rx="112" fill="url(#bg)"/>
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#013f38" stroke-width="6"/>
      <path d="M256 96 L392 416 H330 L303 350 H209 L182 416 H120 L256 96 Z M256 196 L228 296 H284 L256 196 Z"
            fill="url(#mark)"/>
    </g>`;
};

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#012b2c"/>
      <stop offset="1" stop-color="#00141a"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#012b2c"/>
      <stop offset="1" stop-color="#00141a"/>
    </linearGradient>
    <linearGradient id="mark" x1="120" y1="400" x2="392" y2="112" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#48fff3"/>
    </linearGradient>
    <linearGradient id="word" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#48fff3"/>
    </linearGradient>
  </defs>

  <!-- fundo -->
  <rect width="${W}" height="${H}" fill="url(#page)"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="36" fill="none" stroke="#013f38" stroke-width="2"/>

  <!-- brilho sutil verde no canto -->
  <circle cx="${W - 60}" cy="80" r="220" fill="#22c55e" opacity="0.06"/>

  <!-- logo -->
  ${logoCard(96, 195, 240)}

  <!-- textos -->
  <text x="392" y="278" font-family="${FONT}" font-size="108" font-weight="800">
    <tspan fill="#ffffff">${WORDMARK_A}</tspan><tspan fill="url(#word)">${WORDMARK_B}</tspan>
  </text>

  <text x="396" y="350" font-family="${FONT}" font-size="42" font-weight="700" fill="#4ade80">${TAGLINE}</text>

  <text x="396" y="408" font-family="${FONT}" font-size="27" font-weight="400" fill="#9fb4ad">${SUBLINE}</text>

  <!-- rodapé -->
  <rect x="396" y="452" width="280" height="2" fill="#013f38"/>
  <text x="396" y="500" font-family="${FONT}" font-size="30" font-weight="700" fill="#48fff3">${URL}</text>
  <text x="${W - 60}" y="500" text-anchor="end" font-family="${FONT}" font-size="24" font-weight="400" fill="#5d736c">Arbitragem · Feito no Brasil</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(OUT);
console.log("OG image gerada em:", OUT);
