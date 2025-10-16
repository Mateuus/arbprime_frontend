# 🎨 Frontend - Página de Eventos

## 📋 Visão Geral

Página moderna de casa de apostas para listar eventos com design profissional, integrada com a API backend.

## 🎯 Funcionalidades Implementadas

### ✅ **Design Moderno**
- **Tema escuro**: Gradiente azul/cinza com efeitos de vidro
- **Cards responsivos**: Layout em grid adaptável
- **Animações suaves**: Hover effects e transições
- **Ícones**: Lucide React para melhor UX

### ✅ **Filtros Avançados**
- **Busca textual**: Procura em times, ligas
- **Filtro por esporte**: Dropdown com opções
- **Filtro por status**: Ativos/Desabilitados
- **Filtro por liga**: Campo de texto livre
- **Filtro por bookmaker**: Campo de texto livre
- **Botão limpar**: Reset de todos os filtros

### ✅ **Paginação Completa**
- **Navegação**: Botões anterior/próximo
- **Números de página**: Até 5 páginas visíveis
- **Informações**: "Mostrando X a Y de Z eventos"
- **Estado desabilitado**: Botões inativos quando necessário

### ✅ **Integração com API**
- **apiGateway**: Centralizado no `api.gateway.ts`
- **Tipos TypeScript**: Interfaces bem definidas
- **Tratamento de erros**: Mensagens amigáveis
- **Loading states**: Spinner durante carregamento

### ✅ **Responsividade**
- **Mobile-first**: Design adaptável
- **Grid responsivo**: 1 coluna (mobile) → 3 colunas (desktop)
- **Filtros adaptáveis**: Layout flexível

## 🎨 Design System

### **Cores Principais**
```css
/* Gradiente de fundo */
background: linear-gradient(135deg, #1f2937, #1e3a8a, #1f2937);

/* Cards */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.1);

/* Bookmakers */
marjosports: #10b981 (verde)
superbet: #3b82f6 (azul)
pinnacle: #8b5cf6 (roxo)
bet365: #eab308 (amarelo)
```

### **Componentes**
- **Header**: Título + contador de eventos
- **Filtros**: Seção com 6 campos de filtro
- **Cards**: Eventos em formato de cartão
- **Paginação**: Navegação com informações

## 🔧 Estrutura do Código

### **Interfaces TypeScript**
```typescript
interface EventMatch {
  id: string;
  disabled: boolean;
  sport: string;
  league: string;
  home: string;
  away: string;
  date: string;
  baseBookmaker: string;
  matches: Array<{...}>;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

### **Estados do Componente**
```typescript
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
```

### **Funções Principais**
- `fetchEvents()`: Busca eventos da API
- `formatDate()`: Formata data para pt-BR
- `getBookmakerColor()`: Retorna cor do bookmaker

## 🚀 Como Usar

### **1. Navegação**
Acesse `/events` no frontend para ver a página.

### **2. Filtros**
- Digite no campo de busca para encontrar eventos
- Use os dropdowns para filtrar por esporte/status
- Digite nomes de ligas ou bookmakers
- Clique em "Limpar" para resetar

### **3. Paginação**
- Use os botões ← → para navegar
- Clique nos números para ir direto à página
- Veja as informações de "Mostrando X a Y de Z"

### **4. Cards de Evento**
Cada card mostra:
- **Times**: Home vs Away
- **Liga**: Nome da competição
- **Data**: Data e hora formatada
- **Bookmakers**: Tags coloridas
- **Status**: Ativo/Desabilitado
- **Botão**: "Ver Detalhes" (preparado para futuro)

## 🔄 Integração com API

### **Endpoints Utilizados**
```typescript
// Listar eventos com filtros
apiGateway.getEvents({
  page: 1,
  limit: 12,
  search: "Barcelona",
  sport: "futebol",
  disabled: "false"
});

// Buscar evento específico (futuro)
apiGateway.getEventById("event-id");

// Estatísticas (futuro)
apiGateway.getEventsStats();
```

### **Tratamento de Resposta**
```typescript
const response = await apiGateway.getEvents(params);
const data = response.data;

if (data.success) {
  setEvents(data.data.events);
  setPagination(data.data.pagination);
} else {
  setError(data.message);
}
```

## 🎯 Próximos Passos

### **Funcionalidades Futuras**
1. **Detalhes do evento**: Modal ou página dedicada
2. **Favoritos**: Salvar eventos preferidos
3. **Notificações**: Alertas para eventos importantes
4. **Comparação**: Comparar odds entre bookmakers
5. **Histórico**: Ver eventos passados

### **Melhorias de UX**
1. **Skeleton loading**: Placeholders durante carregamento
2. **Infinite scroll**: Carregamento contínuo
3. **Filtros salvos**: Lembrar preferências do usuário
4. **Modo escuro/claro**: Toggle de tema
5. **Animações**: Micro-interações

## 📱 Responsividade

### **Breakpoints**
- **Mobile**: < 768px (1 coluna)
- **Tablet**: 768px - 1024px (2 colunas)
- **Desktop**: > 1024px (3 colunas)

### **Adaptações**
- Filtros empilhados em mobile
- Cards com altura fixa
- Paginação compacta
- Texto responsivo

## 🎨 Personalização

### **Cores dos Bookmakers**
Para adicionar novos bookmakers, edite a função `getBookmakerColor()`:

```typescript
const getBookmakerColor = (bookmaker: string) => {
  const colors: Record<string, string> = {
    'novobookmaker': 'bg-indigo-500',
    // ... outros
  };
  return colors[bookmaker.toLowerCase()] || 'bg-gray-500';
};
```

### **Layout dos Cards**
Modifique as classes CSS nos cards para alterar:
- Tamanho dos cards
- Espaçamento interno
- Cores de fundo
- Efeitos de hover

A página está pronta para uso e totalmente integrada com o backend! 🎉
