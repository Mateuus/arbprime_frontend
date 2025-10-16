import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Calendar, Users, Trophy, Clock, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';

interface EventDetails {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  date: string;
  link: string;
  baseBookmaker: string;
  disabled: boolean;
  update_at: string;
  create_at: string;
}

interface MarketOdd {
  bookmaker: string;
  price: number | string;
  name: string;
  team?: string;
  handicap?: number | string;
  size?: number;
  inverted?: boolean;
}

interface Market {
  marketId: string;
  marketName: string;
  marketNameEn: string;
  odds: MarketOdd[];
}

interface GroupedOdd {
  name: string;
  handicap: number | string;
  odds: MarketOdd[];
  bestOdd: MarketOdd;
}

interface SelectedOdd {
  marketId: string;
  marketName: string;
  odd: MarketOdd;
}

interface EventDetailsResponse {
  event: EventDetails;
  bookmakers: string[];
  markets: Market[];
  marketsCount: number;
  bookmakersWithMarkets: string[];
}

export default function EventDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [eventDetails, setEventDetails] = useState<EventDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedMarkets, setCollapsedMarkets] = useState<Set<string>>(new Set());
  const [selectedOdds, setSelectedOdds] = useState<SelectedOdd[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOddTypes, setExpandedOddTypes] = useState<Set<string>>(new Set());

  // Carregar detalhes do evento
  const fetchEventDetails = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiGateway.getEventDetails(id);
      const data = response.data;

      if (data.result === 1) {
        setEventDetails(data.data);
      } else {
        setError(data.message || 'Erro ao carregar detalhes do evento');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro de conexão com o servidor';
      setError(errorMessage);
      console.error('Erro ao buscar detalhes do evento:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  // Formatar preço
  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toFixed(2);
  };

  // Obter cor do bookmaker
  const getBookmakerColor = (bookmaker: string) => {
    const colors: Record<string, string> = {
      'marjosports': 'bg-green-500',
      'superbet': 'bg-blue-500',
      'pinnacle': 'bg-purple-500',
      'bet365': 'bg-yellow-500',
      'betfair': 'bg-orange-500',
      'williamhill': 'bg-red-500',
      'bet7k': 'bg-indigo-500',
    };
    return colors[bookmaker.toLowerCase()] || 'bg-gray-500';
  };

  // Função para expandir/recolher tipos de odds
  const toggleOddTypeExpansion = (oddTypeKey: string) => {
    setExpandedOddTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(oddTypeKey)) {
        newSet.delete(oddTypeKey);
      } else {
        newSet.add(oddTypeKey);
      }
      return newSet;
    });
  };

  // Agrupar odds por name e handicap
  const groupOddsByType = (odds: MarketOdd[]): GroupedOdd[] => {
    const groups: Record<string, MarketOdd[]> = {};
    
    odds.forEach(odd => {
      const key = `${odd.name}-${odd.handicap || 0}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(odd);
    });

    return Object.entries(groups).map(([, groupOdds]) => {
      // Ordenar por preço (maior para menor) e pegar a melhor
      const sortedOdds = groupOdds.sort((a, b) => {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
        const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
        return priceB - priceA;
      });

      return {
        name: groupOdds[0].name,
        handicap: groupOdds[0].handicap || 0,
        odds: sortedOdds,
        bestOdd: sortedOdds[0]
      };
    });
  };

  // Toggle colapso do mercado
  const toggleMarketCollapse = (marketId: string) => {
    const newCollapsed = new Set(collapsedMarkets);
    if (newCollapsed.has(marketId)) {
      newCollapsed.delete(marketId);
    } else {
      newCollapsed.add(marketId);
    }
    setCollapsedMarkets(newCollapsed);
  };

  // Toggle seleção de odd
  const toggleOddSelection = (marketId: string, marketName: string, odd: MarketOdd) => {
    const selectedIndex = selectedOdds.findIndex(
      s => s.marketId === marketId && s.odd.name === odd.name && s.odd.handicap === odd.handicap
    );

    if (selectedIndex >= 0) {
      // Remover seleção
      setSelectedOdds(prev => prev.filter((_, index) => index !== selectedIndex));
    } else {
      // Adicionar seleção
      setSelectedOdds(prev => [...prev, { marketId, marketName, odd }]);
    }
  };

  // Verificar se odd está selecionada
  const isOddSelected = (marketId: string, odd: MarketOdd): boolean => {
    return selectedOdds.some(
      s => s.marketId === marketId && s.odd.name === odd.name && s.odd.handicap === odd.handicap
    );
  };



  // Filtrar mercados por termo de pesquisa
  const filteredMarkets = eventDetails?.markets.filter(market => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      market.marketName.toLowerCase().includes(searchLower) ||
      market.marketNameEn.toLowerCase().includes(searchLower) ||
      market.odds.some(odd => 
        odd.name.toLowerCase().includes(searchLower) ||
        odd.bookmaker.toLowerCase().includes(searchLower)
      )
    );
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Carregando detalhes do evento...</p>
          <p className="text-gray-400 text-sm mt-2">Isso pode demorar alguns segundos</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Erro ao carregar evento</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!eventDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Evento não encontrado</h1>
          <p className="text-gray-300 mb-6">O evento solicitado não foi encontrado</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Detalhes do Evento
              </h1>
              <p className="text-gray-300">
                Mercados e odds disponíveis
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Informações do Evento */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="text-yellow-500 w-6 h-6" />
              <span className="text-sm text-gray-300 uppercase tracking-wide">
                {eventDetails.event.sport.charAt(0).toUpperCase() + eventDetails.event.sport.slice(1)}
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              eventDetails.event.disabled 
                ? 'bg-red-500/20 text-red-300' 
                : 'bg-green-500/20 text-green-300'
            }`}>
              {eventDetails.event.disabled ? 'Desabilitado' : 'Ativo'}
            </div>
          </div>

          {/* Times */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-white mb-2">
              {eventDetails.event.home}
            </div>
            <div className="text-gray-400 text-lg mb-2">VS</div>
            <div className="text-2xl font-bold text-white">
              {eventDetails.event.away}
            </div>
          </div>

          {/* Liga e Data */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <div className="flex items-center gap-2">
              <Users className="text-blue-400 w-5 h-5" />
              <span className="text-gray-300">{eventDetails.event.league}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="text-purple-400 w-5 h-5" />
              <span className="text-gray-300">
                {formatDate(eventDetails.event.date)}
              </span>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{eventDetails.marketsCount}</div>
              <div className="text-sm text-gray-300">Mercados</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{eventDetails.bookmakers.length}</div>
              <div className="text-sm text-gray-300">Casas de Apostas</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{eventDetails.bookmakersWithMarkets.length}</div>
              <div className="text-sm text-gray-300">Com Mercados</div>
            </div>
          </div>
        </div>

        {/* Pesquisa de Mercados */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-4">
            <Search className="text-blue-400 w-6 h-6" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Pesquisar mercados, odds ou bookmakers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-3 text-sm text-gray-400">
              {filteredMarkets.length} mercado(s) encontrado(s) para &quot;{searchTerm}&quot;
            </div>
          )}
        </div>

        {/* Mercados */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Mercados Disponíveis</h2>
            {selectedOdds.length > 0 && (
              <div className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg text-sm">
                {selectedOdds.length} odd(s) selecionada(s)
              </div>
            )}
          </div>
          
          {filteredMarkets.map((market) => {
            const isCollapsed = collapsedMarkets.has(market.marketId);
            const groupedOdds = groupOddsByType(market.odds);
            
            return (
            <div key={market.marketId} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              {/* Header do Mercado */}
                <div 
                  className="bg-white/10 px-6 py-4 border-b border-white/10 cursor-pointer hover:bg-white/15 transition-colors"
                  onClick={() => toggleMarketCollapse(market.marketId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                <h3 className="text-lg font-semibold text-white">{market.marketName}</h3>
                <p className="text-sm text-gray-300">{market.marketNameEn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{groupedOdds.length} tipos</span>
                      {isCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
              </div>

                {/* Odds com Expansão Inline - Sistema Simplificado */}
                {!isCollapsed && (
                  <div className="p-6">
                    {(() => {
                      // Detecta o tipo de mercado
                      const isTotal = market.marketName.toLowerCase().includes('total') 
                        || market.marketName.toLowerCase().includes('gols') 
                        || market.marketName.toLowerCase().includes('corners')
                        || market.marketName.toLowerCase().includes('over') 
                        || market.marketName.toLowerCase().includes('under')
                        || market.marketName.toLowerCase().includes('mais/menos');
                      const isHandicap = market.marketName.toLowerCase().includes('handicap') 
                        || market.marketName.toLowerCase().includes('hcp');
                      const isMatchWinner = market.marketName.toLowerCase().includes('resultado') 
                        || market.marketName.toLowerCase().includes('vencedor')
                        || market.marketName.toLowerCase().includes('match winner');


                      if (isTotal || isHandicap) {
                        // Layout para totais e handicaps
                        return (
                          <div className="space-y-2">
                            {/* Header para totais */}
                            {isTotal && (
                              <div className="grid grid-cols-3 gap-3 text-xs text-gray-400 text-center mb-3 font-semibold">
                                <div>Linha</div>
                                <div>Mais de</div>
                                <div>Menos de</div>
                              </div>
                            )}
                            
                            {/* Agrupa odds por handicap */}
                            {(() => {
                              const handicapGroups: { [key: string]: MarketOdd[] } = {};
                              
                              market.odds.forEach(odd => {
                                const handicapValue = odd.handicap;
                                if (handicapValue) {
                                  const absValue = Math.abs(parseFloat(String(handicapValue))).toString();
                                  if (!handicapGroups[absValue]) {
                                    handicapGroups[absValue] = [];
                                  }
                                  handicapGroups[absValue].push(odd);
                                }
                              });

                              return Object.entries(handicapGroups).map(([key, odds]) => {
                                const handicapValue = parseFloat(key);
                                
                                // Encontra as odds correspondentes e ordena por preço
                                const maisDeOdds = odds.filter(o => {
                                  const oddHandicap = parseFloat(String(o.handicap || 0));
                                  return oddHandicap > 0 && Math.abs(oddHandicap) === handicapValue;
                                }).sort((a, b) => {
                                  const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                                  const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                                  return priceB - priceA;
                                });
                                
                                const menosDeOdds = odds.filter(o => {
                                  const oddHandicap = parseFloat(String(o.handicap || 0));
                                  return oddHandicap < 0 && Math.abs(oddHandicap) === handicapValue;
                                }).sort((a, b) => {
                                  const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                                  const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                                  return priceB - priceA;
                                });

                                const bestMaisDe = maisDeOdds[0];
                                const bestMenosDe = menosDeOdds[0];
                                const maisDeKey = `${market.marketId}-mais-${key}`;
                                const menosDeKey = `${market.marketId}-menos-${key}`;
                                const isMaisDeExpanded = expandedOddTypes.has(maisDeKey);
                                const isMenosDeExpanded = expandedOddTypes.has(menosDeKey);


                                return (
                                  <div key={key} className="space-y-2">
                                    <div className="grid grid-cols-3 gap-3 py-2 items-center">
                                      <div className="text-sm text-gray-400 text-center font-medium">{key}</div>
                                      <div className="space-y-1">
                                        {/* Botão principal Mais De */}
                                        {bestMaisDe && (
                                          <button
                                            onClick={() => toggleOddTypeExpansion(maisDeKey)}
                                            className={`w-full h-10 rounded-lg transition-all duration-200 ${
                                              isOddSelected(market.marketId, bestMaisDe)
                                                ? 'bg-blue-500 text-white border-2 border-blue-400' 
                                                : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between px-3">
                                              <div className="text-sm font-bold">{formatPrice(bestMaisDe.price)}</div>
                                              <div className={`text-xs px-2 py-1 rounded ${getBookmakerColor(bestMaisDe.bookmaker)}`}>
                                                {bestMaisDe.bookmaker}
                                              </div>
                                            </div>
                                          </button>
                                        )}
                                        
                                        {/* Lista expandida Mais De */}
                                        {isMaisDeExpanded && maisDeOdds.length > 1 && (
                                          <div className="space-y-1">
                                            {maisDeOdds.slice(1).map((odd, idx) => (
                                              <button
                                                key={idx}
                                                onClick={() => toggleOddSelection(market.marketId, market.marketName, odd)}
                                                className={`w-full h-8 rounded text-xs transition-all duration-200 ${
                                                  isOddSelected(market.marketId, odd)
                                                    ? 'bg-blue-500/20 text-white border border-blue-400' 
                                                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between px-2">
                                                  <span>{formatPrice(odd.price)}</span>
                                                  <span className={`px-1 py-0.5 rounded text-xs ${getBookmakerColor(odd.bookmaker)}`}>
                                                    {odd.bookmaker}
                                                  </span>
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1">
                                        {/* Botão principal Menos De */}
                                        {bestMenosDe && (
                                          <button
                                            onClick={() => toggleOddTypeExpansion(menosDeKey)}
                                            className={`w-full h-10 rounded-lg transition-all duration-200 ${
                                              isOddSelected(market.marketId, bestMenosDe)
                                                ? 'bg-blue-500 text-white border-2 border-blue-400' 
                                                : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between px-3">
                                              <div className="text-sm font-bold">{formatPrice(bestMenosDe.price)}</div>
                                              <div className={`text-xs px-2 py-1 rounded ${getBookmakerColor(bestMenosDe.bookmaker)}`}>
                                                {bestMenosDe.bookmaker}
                                              </div>
                                            </div>
                                          </button>
                                        )}
                                        
                                        {/* Lista expandida Menos De */}
                                        {isMenosDeExpanded && menosDeOdds.length > 1 && (
                                          <div className="space-y-1">
                                            {menosDeOdds.slice(1).map((odd, idx) => (
                                              <button
                                                key={idx}
                                                onClick={() => toggleOddSelection(market.marketId, market.marketName, odd)}
                                                className={`w-full h-8 rounded text-xs transition-all duration-200 ${
                                                  isOddSelected(market.marketId, odd)
                                                    ? 'bg-blue-500/20 text-white border border-blue-400' 
                                                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between px-2">
                                                  <span>{formatPrice(odd.price)}</span>
                                                  <span className={`px-1 py-0.5 rounded text-xs ${getBookmakerColor(odd.bookmaker)}`}>
                                                    {odd.bookmaker}
                                                  </span>
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        );
                      } else if (isMatchWinner && market.odds.length <= 3) {
                        // Layout para Resultado Final (1 X 2)
                        const homeOdds = market.odds.filter(o => o.name.toLowerCase().includes('home') || o.name.toLowerCase().includes('1'));
                        const drawOdds = market.odds.filter(o => o.name.toLowerCase().includes('draw') || o.name.toLowerCase().includes('x'));
                        const awayOdds = market.odds.filter(o => o.name.toLowerCase().includes('away') || o.name.toLowerCase().includes('2'));
                        
                        const bestHome = homeOdds.sort((a, b) => {
                          const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                          const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                          return priceB - priceA;
                        })[0];
                        
                        const bestDraw = drawOdds.sort((a, b) => {
                          const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                          const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                          return priceB - priceA;
                        })[0];
                        
                        const bestAway = awayOdds.sort((a, b) => {
                          const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                          const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                          return priceB - priceA;
                        })[0];

                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-3 py-2">
                              {[bestHome, bestDraw, bestAway].map((bestOdd, idx) => {
                                if (!bestOdd) return null;
                                const tooltipKey = `${market.marketId}-${idx}`;
                                const allOdds = [homeOdds, drawOdds, awayOdds][idx];
                                const otherOdds = allOdds.filter(o => o !== bestOdd);
                                const isExpanded = expandedOddTypes.has(tooltipKey);
                                
                                return (
                                  <div key={idx} className="space-y-1">
                                    {/* Botão principal */}
                                    <button
                                      onClick={() => toggleOddTypeExpansion(tooltipKey)}
                                      className={`w-full h-12 rounded-lg transition-all duration-200 ${
                                        isOddSelected(market.marketId, bestOdd)
                                          ? 'bg-blue-500 text-white border-2 border-blue-400' 
                                          : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
                                      }`}
                                    >
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <span className="text-sm font-bold">{formatPrice(bestOdd.price)}</span>
                                        <span className="text-xs text-gray-400">{bestOdd.name}</span>
                                        <span className={`text-xs px-1 py-0.5 rounded ${getBookmakerColor(bestOdd.bookmaker)}`}>
                                          {bestOdd.bookmaker}
                                        </span>
                                      </div>
                                    </button>
                                    
                                    {/* Lista expandida */}
                                    {isExpanded && otherOdds.length > 0 && (
                                      <div className="space-y-1">
                                        {otherOdds.map((odd, oddIdx) => (
                                          <button
                                            key={oddIdx}
                                            onClick={() => toggleOddSelection(market.marketId, market.marketName, odd)}
                                            className={`w-full h-8 rounded text-xs transition-all duration-200 ${
                                              isOddSelected(market.marketId, odd)
                                                ? 'bg-blue-500/20 text-white border border-blue-400' 
                                                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between px-2">
                                              <span>{formatPrice(odd.price)}</span>
                                              <span className={`px-1 py-0.5 rounded text-xs ${getBookmakerColor(odd.bookmaker)}`}>
                                                {odd.bookmaker}
                                              </span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        // Layout padrão para outros mercados
                        const groupedOdds = groupOddsByType(market.odds);
                        
                        return (
                          <div className="space-y-2">
                            {groupedOdds.map((group, groupIndex) => {
                              const tooltipKey = `${market.marketId}-${groupIndex}`;
                              const otherOdds = group.odds.slice(1);
                              const isExpanded = expandedOddTypes.has(tooltipKey);
                              
                              return (
                                <div key={groupIndex} className="space-y-1">
                                  {/* Botão principal */}
                                  <button
                                    onClick={() => toggleOddTypeExpansion(tooltipKey)}
                                    className={`w-full h-14 rounded-lg transition-all duration-200 ${
                                      isOddSelected(market.marketId, group.bestOdd)
                                        ? 'bg-blue-500 text-white border-2 border-blue-400' 
                                        : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center justify-center h-full">
                                      <span className="text-sm font-bold">{formatPrice(group.bestOdd.price)}</span>
                                      <span className="text-xs text-gray-400">{group.name}</span>
                                      <span className={`text-xs px-1 py-0.5 rounded ${getBookmakerColor(group.bestOdd.bookmaker)}`}>
                                        {group.bestOdd.bookmaker}
                                      </span>
                                    </div>
                                  </button>
                                  
                                  {/* Lista expandida */}
                                  {isExpanded && otherOdds.length > 0 && (
                                    <div className="space-y-1">
                                      {otherOdds.map((odd, oddIdx) => (
                                        <button
                                          key={oddIdx}
                                          onClick={() => toggleOddSelection(market.marketId, market.marketName, odd)}
                                          className={`w-full h-8 rounded text-xs transition-all duration-200 ${
                                            isOddSelected(market.marketId, odd)
                                              ? 'bg-blue-500/20 text-white border border-blue-400' 
                                              : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between px-2">
                                            <span>{formatPrice(odd.price)}</span>
                                            <span className={`px-1 py-0.5 rounded text-xs ${getBookmakerColor(odd.bookmaker)}`}>
                                              {odd.bookmaker}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {filteredMarkets.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                {searchTerm ? 'Nenhum mercado encontrado' : 'Nenhum mercado disponível'}
              </h3>
              <p className="text-gray-400">
                {searchTerm 
                  ? `Nenhum mercado corresponde à pesquisa "${searchTerm}"`
                  : 'Os mercados para este evento ainda não foram carregados'
                }
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Limpar pesquisa
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}