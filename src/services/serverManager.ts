import {
  SERVERS,
  DEFAULT_SERVER_ID,
  getServer,
  isLocalBackend,
  type ServerDef,
  type ServerId,
} from '@/config/servers';

/**
 * Preferência de servidor:
 *  - 'auto'      → escolhe o de menor latência e faz failover sozinho.
 *  - <ServerId>  → fixa um servidor; ainda assim faz failover se ele cair e
 *                  VOLTA sozinho para o preferido quando ele normaliza.
 */
export type ServerPreference = 'auto' | ServerId;

export interface ServerSnapshot {
  preference: ServerPreference;
  activeId: ServerId;
  /** Latência em ms por servidor (null = inalcançável/ainda não medido). */
  latencies: Record<string, number | null>;
  /** Está medindo latência agora? (para spinner na UI) */
  pinging: boolean;
  servers: ServerDef[];
  isLocal: boolean;
}

type Listener = (snap: ServerSnapshot) => void;

const PREF_KEY = 'arbprime.serverPref';
const ACTIVE_KEY = 'arbprime.activeServer';

const PING_TIMEOUT = 4000;       // ms — além disso o servidor é considerado fora
const HEALTH_INTERVAL = 15000;   // ms — re-checagem periódica de saúde
// Em modo 'auto' só troca de servidor se o concorrente for relevantemente
// melhor, evitando "flapping" entre dois servidores de latência parecida.
const HYSTERESIS_MS = 40;

class ServerManager {
  private preference: ServerPreference = 'auto';
  private activeId: ServerId = DEFAULT_SERVER_ID;
  private latencies = new Map<string, number | null>();
  private pinging = false;
  private listeners = new Set<Listener>();
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  /** Inicializa no cliente: carrega preferência salva e começa o monitor. */
  public init() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // Em modo local (dev) não há o que escolher: fixa o único servidor.
    if (isLocalBackend) {
      this.activeId = DEFAULT_SERVER_ID;
      return;
    }

    const savedPref = window.localStorage.getItem(PREF_KEY) as ServerPreference | null;
    if (savedPref && (savedPref === 'auto' || getServer(savedPref))) {
      this.preference = savedPref;
    }

    // "Último servidor bom" para boot instantâneo (antes do primeiro ping).
    const savedActive = window.localStorage.getItem(ACTIVE_KEY) as ServerId | null;
    if (this.preference !== 'auto') {
      this.activeId = this.preference;
    } else if (savedActive && getServer(savedActive)) {
      this.activeId = savedActive;
    }

    // Mede agora e passa a re-checar periodicamente.
    void this.pingAll();
    this.healthTimer = setInterval(() => void this.pingAll(), HEALTH_INTERVAL);
  }

  // ---- leitura ----------------------------------------------------------

  public getApiBase(): string {
    return (getServer(this.activeId) ?? SERVERS[0]).apiUrl;
  }

  public getWsBase(): string {
    return (getServer(this.activeId) ?? SERVERS[0]).wsUrl;
  }

  public getActiveId(): ServerId {
    return this.activeId;
  }

  public getPreference(): ServerPreference {
    return this.preference;
  }

  public snapshot(): ServerSnapshot {
    return {
      preference: this.preference,
      activeId: this.activeId,
      latencies: Object.fromEntries(this.latencies),
      pinging: this.pinging,
      servers: SERVERS,
      isLocal: isLocalBackend,
    };
  }

  // ---- preferência do usuário ------------------------------------------

  public setPreference(pref: ServerPreference) {
    if (pref !== 'auto' && !getServer(pref)) return;
    this.preference = pref;
    if (typeof window !== 'undefined') window.localStorage.setItem(PREF_KEY, pref);

    // Se fixou um servidor específico, já aponta pra ele (failover ajusta depois).
    if (pref !== 'auto' && getServer(pref)) this.setActive(pref);
    this.resolve();
    this.notify();
    // Re-mede para refletir o estado real rapidamente.
    void this.pingAll();
  }

  // ---- medição ----------------------------------------------------------

  /** Mede a latência de um servidor. Retorna ms ou null se inalcançável. */
  private async ping(server: ServerDef): Promise<number | null> {
    if (typeof window === 'undefined') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    const start = performance.now();
    try {
      // no-cors: só nos importa se respondeu e quão rápido — não lemos o corpo.
      // Assim funciona independente de CORS (inclusive em previews da Vercel).
      await fetch(server.pingUrl, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
      return Math.round(performance.now() - start);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Mede todos os servidores em paralelo e re-resolve o ativo. */
  public async pingAll(): Promise<void> {
    if (typeof window === 'undefined' || isLocalBackend) return;
    this.pinging = true;
    this.notify();
    await Promise.all(
      SERVERS.map(async (s) => {
        const ms = await this.ping(s);
        this.latencies.set(s.id, ms);
      }),
    );
    this.pinging = false;
    this.resolve();
    this.notify();
  }

  /**
   * Marca o servidor ativo como fora do ar (chamado pelo axios quando uma
   * requisição falha por rede) e tenta failover imediato para o outro.
   * Retorna true se conseguiu trocar de servidor.
   */
  public markActiveDown(): boolean {
    if (isLocalBackend) return false;
    const before = this.activeId;
    this.latencies.set(this.activeId, null);
    this.resolve();
    this.notify();
    // Confirma o estado real em background (e detecta a volta do preferido).
    void this.pingAll();
    return this.activeId !== before;
  }

  // ---- resolução do ativo ----------------------------------------------

  /** Decide qual servidor deve estar ativo conforme preferência + latências. */
  private resolve() {
    if (isLocalBackend) return;

    const reachable = (id: ServerId) => this.latencies.get(id) != null;
    const latency = (id: ServerId) => this.latencies.get(id) ?? Infinity;

    // Sem nenhuma medição ainda: mantém o atual.
    const measured = SERVERS.some((s) => this.latencies.has(s.id));
    if (!measured) return;

    if (this.preference !== 'auto') {
      // Servidor fixado: usa-o se estiver de pé (isso garante o "volta sozinho"
      // quando ele se recupera); senão cai para qualquer outro alcançável.
      if (reachable(this.preference)) {
        this.setActive(this.preference);
        return;
      }
      const fallback = SERVERS.find((s) => s.id !== this.preference && reachable(s.id));
      if (fallback) this.setActive(fallback.id);
      return;
    }

    // Modo 'auto': melhor latência, com histerese para não ficar oscilando.
    const best = [...SERVERS].sort((a, b) => latency(a.id) - latency(b.id))[0];
    if (!best || !reachable(best.id)) return; // ninguém respondeu: mantém atual

    if (best.id === this.activeId) return;
    const currentUp = reachable(this.activeId);
    const improvement = latency(this.activeId) - latency(best.id);
    if (!currentUp || improvement >= HYSTERESIS_MS) {
      this.setActive(best.id);
    }
  }

  private setActive(id: ServerId) {
    if (this.activeId === id) return;
    this.activeId = id;
    if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_KEY, id);
    this.activeListeners.forEach((cb) => cb(id));
  }

  // ---- pub/sub ----------------------------------------------------------

  /** Assina o snapshot completo (para UI). */
  public subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Assina apenas a TROCA de servidor ativo (para o wsManager reconectar). */
  private activeListeners = new Set<(id: ServerId) => void>();
  public onActiveChange(cb: (id: ServerId) => void): () => void {
    this.activeListeners.add(cb);
    return () => this.activeListeners.delete(cb);
  }

  private notify() {
    const snap = this.snapshot();
    this.listeners.forEach((cb) => cb(snap));
  }
}

export const serverManager = new ServerManager();
