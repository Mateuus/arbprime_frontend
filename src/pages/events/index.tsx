import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Search, Filter, ChevronLeft, ChevronRight, Calendar, Users, Trophy } from 'lucide-react';
import { apiGateway, EventsParams } from '@/gateways/api.gateway';

interface EventMatch {
  id: string;
  disabled: boolean;
  sport: string;
  league: string;
  home: string;
  away: string;
  date: string;
  link: string;
  baseBookmaker: string;
  matches: Array<{
    bookmaker: string;
    eventId: number;
    link: string;
    date: string;
    disabled: boolean;
    inverted: boolean;
  }>;
  update_at: string;
  create_at: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}


export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventMatch[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [disabled, setDisabled] = useState('');
  const [league, setLeague] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);

  // Chave dos filtros para detectar mudança e resetar a página (ver abaixo).
  const filterKey = `${search}|${sport}|${disabled}|${league}|${bookmaker}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  // Carregar eventos
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: EventsParams = {
        page: currentPage,
        limit: limit,
        ...(search && { search }),
        ...(sport && { sport }),
        ...(disabled && { disabled }),
        ...(league && { league }),
        ...(bookmaker && { bookmaker }),
      };

      const response = await apiGateway.getEvents(params);
      const data = response.data;

      console.log('API Response:', data); // Debug log

      if (data.result === 1) {
        setEvents(data.data.events);
        setPagination(data.data.pagination);
        console.log('Events set:', data.data.events.length); // Debug log
      } else {
        setError(data.message || 'Erro ao carregar eventos');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro de conexão com o servidor';
      setError(errorMessage);
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, sport, disabled, league, bookmaker, limit]);

  // Reset de página ao mudar filtros: ajuste de estado durante o render
  // (padrão recomendado pelo React no lugar de um efeito com setState).
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  // Busca eventos quando filtros/página mudam (fetchEvents é useCallback com essas deps).
  useEffect(() => {
    // setState de loading/erro dentro do fetch é intencional aqui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

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

  // Obter cor do bookmaker
  const getBookmakerColor = (bookmaker: string) => {
    const colors: Record<string, string> = {
      'marjosports': 'bg-green-500',
      'superbet': 'bg-blue-500',
      'pinnacle': 'bg-purple-500',
      'bet365': 'bg-yellow-500',
      'betfair': 'bg-orange-500',
      'williamhill': 'bg-red-500',
    };
    return colors[bookmaker.toLowerCase()] || 'bg-gray-500';
  };

  // Componente de Tooltip
  const BookmakerTooltip = ({ event }: { event: EventMatch }) => {
    const allBookmakers = [
      event.baseBookmaker,
      ...(event.matches?.map(match => match.bookmaker) || [])
    ];
    
    if (allBookmakers.length <= 3) return null;

    return (
      <div className="group relative inline-block">
        <button className="px-2 py-1 rounded text-xs font-medium text-gray-300 bg-gray-500/20 hover:bg-gray-500/30 transition-colors">
          +{allBookmakers.length - 3}
        </button>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-white/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 min-w-max">
          <div className="text-xs text-white font-medium mb-1">Todas as casas:</div>
          <div className="flex flex-wrap gap-1">
            {allBookmakers.map((bookmaker, index) => (
              <div
                key={index}
                className={`px-2 py-1 rounded text-xs font-medium text-white ${getBookmakerColor(bookmaker)}`}
              >
                {bookmaker}
              </div>
            ))}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                🏆 Eventos de Apostas
              </h1>
              <p className="text-gray-300">
                Encontre os melhores eventos e casas de apostas
              </p>
            </div>
            <div className="text-right">
              {pagination && (
                <div className="text-white">
                  <div className="text-2xl font-bold">{pagination.totalItems}</div>
                  <div className="text-sm text-gray-300">Eventos Disponíveis</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <Filter className="text-white w-5 h-5" />
            <h2 className="text-xl font-semibold text-white">Filtros</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar eventos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Esporte */}
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" className="bg-gray-800 text-white">Todos os Esportes</option>
              <option value="futebol" className="bg-gray-800 text-white">Futebol</option>
              <option value="basquete" className="bg-gray-800 text-white">Basquete</option>
              <option value="tenis" className="bg-gray-800 text-white">Tênis</option>
            </select>

            {/* Status */}
            <select
              value={disabled}
              onChange={(e) => setDisabled(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" className="bg-gray-800 text-white">Todos os Status</option>
              <option value="false" className="bg-gray-800 text-white">Ativos</option>
              <option value="true" className="bg-gray-800 text-white">Desabilitados</option>
            </select>

            {/* Liga */}
            <input
              type="text"
              placeholder="Liga..."
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Bookmaker */}
            <input
              type="text"
              placeholder="Bookmaker..."
              value={bookmaker}
              onChange={(e) => setBookmaker(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Limpar Filtros */}
            <button
              onClick={() => {
                setSearch('');
                setSport('');
                setDisabled('');
                setLeague('');
                setBookmaker('');
              }}
              className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-8">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Lista de Eventos */}
        {!loading && !error && (
          <>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              {/* Header da Lista */}
              <div className="bg-white/10 px-4 md:px-6 py-4 border-b border-white/10">
                <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  <div className="col-span-4">Evento</div>
                  <div className="col-span-2">Liga</div>
                  <div className="col-span-2">Data</div>
                  <div className="col-span-3">Casas de Apostas</div>
                  <div className="col-span-1">Detalhe</div>
                </div>
                <div className="md:hidden text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Eventos de Apostas
                </div>
              </div>

              {/* Lista de Eventos */}
              <div className="divide-y divide-white/10">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="px-4 md:px-6 py-4 hover:bg-white/5 transition-colors duration-200"
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      {/* Evento */}
                      <div className="col-span-4">
                        <div className="flex items-center gap-3">
                          <Trophy className="text-yellow-500 w-5 h-5 flex-shrink-0" />
                          <div>
                            <div className="text-white font-semibold text-sm">
                              {event.home}
                            </div>
                            <div className="text-gray-400 text-xs">VS</div>
                            <div className="text-white font-semibold text-sm">
                              {event.away}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Liga */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <Users className="text-blue-400 w-4 h-4" />
                          <span className="text-gray-300 text-sm">{event.league}</span>
                        </div>
                      </div>

                      {/* Data */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-purple-400 w-4 h-4" />
                          <span className="text-gray-300 text-sm">
                            {formatDate(event.date)}
                          </span>
                        </div>
                      </div>

                      {/* Casas de Apostas */}
                      <div className="col-span-3">
                        <div className="flex flex-wrap gap-1 items-center">
                          {/* Bookmaker Base */}
                          <div className={`px-2 py-1 rounded text-xs font-medium text-white ${getBookmakerColor(event.baseBookmaker)}`}>
                            {event.baseBookmaker}
                          </div>
                          
                          {/* Outros Bookmakers (máximo 2 para deixar espaço para o tooltip) */}
                          {event.matches?.slice(0, 2).map((match, index) => (
                            <div
                              key={index}
                              className={`px-2 py-1 rounded text-xs font-medium text-white ${getBookmakerColor(match.bookmaker)}`}
                            >
                              {match.bookmaker}
                            </div>
                          ))}
                          
                          {/* Tooltip para casas extras */}
                          <BookmakerTooltip event={event} />
                          
                          {(!event.matches || event.matches.length === 0) && (
                            <span className="text-gray-500 text-xs">Apenas {event.baseBookmaker}</span>
                          )}
                        </div>
                      </div>

                      {/* Detalhe */}
                      <div className="col-span-1">
                        <button 
                          onClick={() => router.push(`/events/event/${event.id}`)}
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-300 transform hover:scale-105 text-xs"
                        >
                          Ver
                        </button>
                      </div>
                    </div>

                    {/* Mobile Layout - Cards */}
                    <div className="md:hidden">
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300">
                        {/* Header do Card */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Trophy className="text-yellow-500 w-4 h-4" />
                            <span className="text-xs text-gray-300 uppercase tracking-wide">
                              {event.sport.charAt(0).toUpperCase() + event.sport.slice(1)}
                            </span>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.disabled 
                              ? 'bg-red-500/20 text-red-300' 
                              : 'bg-green-500/20 text-green-300'
                          }`}>
                            {event.disabled ? 'Off' : 'On'}
                          </div>
                        </div>

                        {/* Times */}
                        <div className="text-center mb-3">
                          <div className="text-base font-bold text-white mb-1">
                            {event.home}
                          </div>
                          <div className="text-gray-400 text-xs mb-1">VS</div>
                          <div className="text-base font-bold text-white">
                            {event.away}
                          </div>
                        </div>

                        {/* Liga */}
                        <div className="flex items-center gap-2 mb-3 justify-center">
                          <Users className="text-blue-400 w-4 h-4" />
                          <span className="text-sm text-gray-300">{event.league}</span>
                        </div>

                        {/* Data */}
                        <div className="flex items-center gap-2 mb-3 justify-center">
                          <Calendar className="text-purple-400 w-4 h-4" />
                          <span className="text-sm text-gray-300">
                            {formatDate(event.date)}
                          </span>
                        </div>

                        {/* Casas de Apostas */}
                        <div className="mb-3">
                          <div className="text-xs text-gray-400 mb-2 text-center">Disponível em:</div>
                          <div className="flex flex-wrap gap-1 justify-center items-center">
                            {/* Bookmaker Base */}
                            <div className={`px-2 py-1 rounded text-xs font-medium text-white ${getBookmakerColor(event.baseBookmaker)}`}>
                              {event.baseBookmaker}
                            </div>
                            
                            {/* Outros Bookmakers (máximo 2 para deixar espaço para o tooltip) */}
                            {event.matches?.slice(0, 2).map((match, index) => (
                              <div
                                key={index}
                                className={`px-2 py-1 rounded text-xs font-medium text-white ${getBookmakerColor(match.bookmaker)}`}
                              >
                                {match.bookmaker}
                              </div>
                            ))}
                            
                            {/* Tooltip para casas extras */}
                            <BookmakerTooltip event={event} />
                            
                            {(!event.matches || event.matches.length === 0) && (
                              <span className="text-gray-500 text-xs">Apenas {event.baseBookmaker}</span>
                            )}
                          </div>
                        </div>

                  {/* Botão de Ação */}
                  <button 
                    onClick={() => router.push(`/events/event/${event.id}`)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm"
                  >
                    Ver Detalhes
                  </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paginação */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-gray-300">
                  Mostrando {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} a{' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} de{' '}
                  {pagination.totalItems} eventos
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="p-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            page === pagination.currentPage
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="p-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Estado Vazio */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              Nenhum evento encontrado
            </h3>
            <p className="text-gray-400">
              Tente ajustar os filtros para encontrar eventos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}