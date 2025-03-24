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

export const formatToDollar = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export function getBestSurebet(surebets: Surebet[]): Surebet {
  return [...surebets].sort((a, b) => b.profitMargin - a.profitMargin)[0];
}