import { Surebet } from '@/interfaces';

export function getMarketLink(data: { spots?: { exchange?: string; symbol?: string }[]; futures?: { exchange?: string; symbol?: string }[] }): string | null {
    const exchange = data.spots?.[0]?.exchange || data.futures?.[0]?.exchange;
    const symbol = data.spots?.[0]?.symbol || data.futures?.[0]?.symbol;
    const isSpot = !!data.spots?.[0]; // Verifica se o mercado é Spot
  
    if (!exchange || !symbol) return null;
  
    let formattedSymbol = symbol;
  
    switch (exchange.toLowerCase()) {
      case 'gate':
        formattedSymbol = symbol.replace('-', '_');
        return `https://www.gate.io/pt-br/trade/${formattedSymbol}?tradeSide=sell`;
  
      case 'kucoin':
        formattedSymbol = symbol.replace('_', '-');
        return `https://www.kucoin.com/pt/trade/${formattedSymbol}`;

      case 'binance':
        formattedSymbol = symbol;
        return `https://www.binance.com/pt-BR/trade/${formattedSymbol}`;

      case 'bitget':
        formattedSymbol = symbol.replace('_', '');
        return `https://www.bitget.com/pt/spot/${formattedSymbol}`;
  
      case 'mexc':
        formattedSymbol = symbol.replace('-', '_');
        // Verifica se é Spot ou Futuro
        if (isSpot) {
          return `https://www.mexc.com/pt-PT/exchange/${formattedSymbol}`;
        } else {
          return `https://futures.mexc.com/pt-PT/exchange/${formattedSymbol}?type=linear_swap`;
        }
  
      default:
        return null; // Exchange não reconhecida
    }
}
  
export function openMarketsSideBySide(data: { 
  spots?: { exchange?: string; symbol?: string }[], 
  futures?: { exchange?: string; symbol?: string }[] 
}): void {
  const spotLink = data.spots?.[0] ? getMarketLink({ spots: data.spots }) : null;
  const futureLink = data.futures?.[0] ? getMarketLink({ futures: data.futures }) : null;
  
  const symbol = data.spots?.[0]?.symbol || data.futures?.[0]?.symbol;
  const spotExchange = data.spots?.[0]?.exchange || '';
  const futureExchange = data.futures?.[0]?.exchange || '';

  const calculatorLink = `/arbcrypto/calculator?symbol=${symbol}&spot=${spotExchange}&future=${futureExchange}`;

  if (!spotLink && !futureLink) {
      console.error("Nenhum link válido encontrado.");
      return;
  }

  // Obtendo dimensões do monitor
  const screenLeft = window.screenLeft || window.screenX || 0;
  const screenTop = window.screenTop || window.screenY || 0;
  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;

  const windowWidth = Math.floor(screenWidth / 2); // Divide a tela em 2 partes para Spot e Future
  const windowHeight = Math.floor(screenHeight * 0.85);  // Ocupa 85% da altura

  const calcWidth = 500; // Largura fixa da calculadora
  const calcHeight = 600; // Altura fixa da calculadora

  const calcLeft = screenLeft + (screenWidth - calcWidth) / 2;
  const calcTop = screenTop + (screenHeight - calcHeight) / 2;

  // Armazena referências das janelas abertas
  let centerWindow: Window | null = null;
  let leftWindow: Window | null = null;
  let rightWindow: Window | null = null;

  // Função para ajustar o zoom da janela
  const applyZoomScript = (win: Window | null, zoomLevel: number) => {
      if (win) {
          const script = `
              document.body.style.zoom = '${zoomLevel}%';
              document.body.style.transformOrigin = '0 0';
          `;
          win.onload = () => win.document.write(`<script>${script}<\/script>`);
      }
  };

  // Abre Spot à esquerda
  if (spotLink) {
      leftWindow = window.open(
          spotLink,
          "_blank",
          `width=${windowWidth},height=${windowHeight},top=${screenTop},left=${screenLeft}`
      );
      if (leftWindow) {
          applyZoomScript(leftWindow, 75); // Aplica o zoom de 75%
      } else {
          console.error("Não foi possível abrir a janela para Spot. Pop-ups podem estar bloqueados.");
      }
  }

  // Abre Future à direita
  if (futureLink) {
      rightWindow = window.open(
          futureLink,
          "_blank",
          `width=${windowWidth},height=${windowHeight},top=${screenTop},left=${screenLeft + windowWidth}`
      );
      if (rightWindow) {
          applyZoomScript(rightWindow, 75); // Aplica o zoom de 75%
      } else {
          console.error("Não foi possível abrir a janela para Futuros. Pop-ups podem estar bloqueados.");
      }
  }

  // Aguarda um pequeno delay para abrir a Calculadora por cima
  setTimeout(() => {
      centerWindow = window.open(
          calculatorLink,
          "_blank",
          `width=${calcWidth},height=${calcHeight},top=${calcTop},left=${calcLeft}`
      );

      if (!centerWindow) {
          console.error("Não foi possível abrir a janela da Calculadora. Pop-ups podem estar bloqueados.");
          return;
      }

      // Função para monitorar a calculadora e fechar as outras se necessário
      const monitorCalculator = setInterval(() => {
          if (centerWindow?.closed) {
              console.log("Calculadora fechada! Fechando as outras janelas...");
              if (leftWindow && !leftWindow.closed) leftWindow.close();
              if (rightWindow && !rightWindow.closed) rightWindow.close();
              clearInterval(monitorCalculator); // Para o monitoramento
          }
      }, 1000); // Verifica a cada segundo

      // Traz a calculadora para o topo novamente
      centerWindow.focus();
  }, 500); // Pequeno atraso para garantir que a calculadora fique por cima
}

// ── ArbBets: URL do jogo na casa ─────────────────────────────────────────────
// A majovip MIGROU: não existe mais deep-link por evento (/home/events-area/s/SC/e/<id>).
// Agora a página é a do DIA: /esportes/futebol?data=YYYY-MM-DD. Quem ACHA e CLICA o
// jogo dentro dela é a EXTENSÃO (content-majovip), pelo eventId / nome dos times.
// Por isso, para majovip esta função só monta a página do dia; o "abrir o jogo" de
// verdade depende do plugin. Sem plugin, o usuário cai na lista do dia e acha na mão.
// SÓ MAJOVIP por enquanto: outras casas retornam null e o chamador usa o link normal.

// Dia do evento no fuso de Brasília (a majovip lista os jogos por dia local).
function majovipDay(dateISO?: string | null): string | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // en-CA => YYYY-MM-DD
}

export function getBookmakerEventLink(
  bookmaker?: string,
  eventId?: string,
  sport: string = 'futebol',
  dateISO?: string | null,
): string | null {
  if (!bookmaker || !eventId) return null;

  switch (bookmaker.toLowerCase()) {
    case 'majovip': {
      const day = majovipDay(dateISO);
      return `https://majovip.net/esportes/futebol${day ? `?data=${day}` : ''}`;
    }
    // Família "sabets" (betsbola_vip + clones): SPA de página única, sem URL por
    // evento. A extensão acha o jogo (via camp_id) e seleciona a odd
    // (CheckOdd2Local) usando a API /futebolapi same-origin. Sem extensão, abre a
    // lista de jogos. Ver arbprime_extension/content-betsbola.js.
    case 'betsbola_vip':
      return 'https://betsbolavip.com/?id=todos';
    case 'betsbola_pro':
      return 'https://betsbola.pro/?id=todos';
    case 'esportenet_show':
      return 'https://www.esportenet.show/?id=todos';
    case 'esportepe':
      return 'https://esportepe.com.br/?id=todos';
    default:
      return null; // casa sem template conhecido
  }
}

/**
 * Abre cada perna da surebet (1 aba por casa) lado a lado, usando o deep-link
 * direto montado a partir do eventId de cada perna. Casas sem template são puladas.
 *
 * IMPORTANTE: NÃO dá pra "controlar" a aba da casa por JS depois de aberta — é
 * outra origem (majovip.net ≠ arbprime) e o browser bloqueia win.document. O jogo
 * certo abre porque o eventId já vai embutido na URL. O scraper abrirJogoMajovip
 * só funciona colado no console da PRÓPRIA majovip (mesma origem / bookmarklet).
 */
export function openSurebetEvents(surebet: Surebet, sport: string = 'futebol'): void {
  const seen = new Set<string>();
  const links: string[] = [];

  for (const leg of surebet.surebet) {
    const key = `${leg.bookmaker}:${leg.eventId}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // majovip → link montado do eventId; demais casas → leg.link normal
    const url = getBookmakerEventLink(leg.bookmaker, leg.eventId, sport) || leg.link;
    if (url) links.push(url);
  }

  if (!links.length) {
    console.error('Nenhuma casa com deep-link conhecido nesta surebet.');
    return;
  }

  const left = window.screenLeft || window.screenX || 0;
  const top = window.screenTop || window.screenY || 0;
  const w = Math.floor(window.screen.availWidth / links.length);
  const h = Math.floor(window.screen.availHeight * 0.85);

  links.forEach((url, i) =>
    window.open(url, `arb_${i}`, `width=${w},height=${h},top=${top},left=${left + w * i}`),
  );
}

export const formatToDollar = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export function getBestSurebet(surebets: Surebet[]): Surebet {
  return [...surebets].sort((a, b) => b.profitMargin - a.profitMargin)[0];
}

export function capitalizeFirstLetter(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getMarketName(marketKey: string): string | undefined {
  const [id, subIdStr] = marketKey.split(':');
  const subId = parseInt(subIdStr, 10);

  const marketList = [
    { id: "match-winner", subId: 1, name: "Resultado Final" },
    { id: "match-winner-lay", subId: 2, name: "Resultado Final Lay" },
    { id: "match-winner", subId: 3, name: "Resultado Final - 1HT" },
    { id: "match-winner", subId: 4, name: "Resultado Final - 2HT" },
    { id: "total-goals", subId: 5, name: "Total de Gols Mais/Menos" },
    { id: "total-goals", subId: 6, name: "Total de Gols Mais/Menos - 1HT" },
    { id: "total-goals", subId: 7, name: "Total de Gols Mais/Menos - 2HT" },
    { id: "both-teams-score", subId: 8, name: "Ambas equipes Marcam" },
    { id: "total-cards", subId: 9, name: "Total de Cartões Acima/Abaixo" },
    { id: "cards-yellow-match-result", subId: 8999, name: "Cartões Amarelos Resultado" },
    { id: "cards-match-result", subId: 9000, name: "Cartões Resultado" },
    { id: "total-cards-yellow", subId: 9001, name: "Total de Cartões Amarelo Acima/Abaixo" },
    { id: "total-cards-yellow-home", subId: 9002, name: "Cartões Amarelo Casa O/U" },
    { id: "total-cards-yellow-away", subId: 9003, name: "Cartões Amarelo Fora O/U" },
    { id: "cards-handicap-yellow", subId: 9004, name: "HP Cartões Amarelo" },
    { id: "total-corners", subId: 10, name: "Escanteios Mais/Menos" },
    { id: "total-corners", subId: 1000, name: "Escanteios O/U - 1HT" },
    { id: "total-corners", subId: 1001, name: "Escanteios O/U - 2HT" },
    { id: "total-corners-home", subId: 1002, name: "Escanteios - Casa" },
    { id: "total-corners-home", subId: 1004, name: "Escanteios - Casa - 1HT" },
    { id: "total-corners-away", subId: 1003, name: "Escanteios - Fora" },
    { id: "total-corners-away", subId: 1005, name: "Escanteios - Fora - 1HT" },
    { id: "double-chance", subId: 11, name: "Chance Dupla" },
    { id: "double-chance", subId: 12, name: "Chance Dupla - 1HT" },
    { id: "double-chance", subId: 13, name: "Chance Dupla - 2HT" },
    { id: "asian-handicap", subId: 14, name: "Handicap" },
    { id: "draw-no-bet", subId: 15, name: "Empate Anula" },
    { id: "european-handicap", subId: 16, name: "Handicap Europeu" },
    { id: "asian-handicap", subId: 17, name: "Handicap Asiático" },
    { id: "goal-line-handicap", subId: 18, name: "Handicap Gols Linhas" },
    { id: "qualify", subId: 19, name: "Classificar-se" },
    { id: "shots-ongoal-winner", subId: 20, name: "Chutes no Gol Ganhador" },
    { id: "shots-ongoal-overunder", subId: 2001, name: "Chutes no Gol Acima/Abaixo" },
    { id: "shotsongoal-handicap", subId: 2002, name: "Chutes no Gol Handicap" },
    { id: "shots-overunder", subId: 2005, name: "Chutes Total" },
    { id: "home-shots-overunder", subId: 2006, name: "Chutes Total: Casa" },
    { id: "away-shots-overunder", subId: 2007, name: "Chutes Total: Fora" },
    { id: "home-shotsongoal-overunder", subId: 21, name: "Chutes ao Gol: Casa" },
    { id: "away-shotsongoal-overunder", subId: 22, name: "Chutes ao Gol: Fora" },
    { id: "offsides-matchresult", subId: 41, name: "Impedimentos Resultado" },
    { id: "offsides-over-under", subId: 42, name: "Total Impedimentos" },
    { id: "home-offsides-over-under", subId: 43, name: "Impedimentos: Casa" },
    { id: "away-offsides-over-under", subId: 44, name: "Impedimentos: Fora" }
  ];

  const found = marketList.find((m) => m.id === id && m.subId === subId);
  return found?.name;
}

export const validatePassword = (pass: string, passLenght: number = 6) => {
  const PASSWORD_MIN_LENGTH = passLenght;
  const requireNumber = true;
  const requireUppercase = true;
  const requireSpecialChar = true;

  const errors = [];
  if (pass.length < PASSWORD_MIN_LENGTH) errors.push("Mínimo de 6 caracteres");
  if (requireNumber && !/\d/.test(pass)) errors.push("Deve conter um número");
  if (requireUppercase && !/[A-Z]/.test(pass)) errors.push("Deve conter letra maiúscula");
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]/.test(pass)) {
    errors.push("Deve conter caractere especial");
  }
  return errors;
};

export const formatCpf = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};