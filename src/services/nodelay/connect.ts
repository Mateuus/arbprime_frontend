/**
 * Orquestra o "conectar conta" do NoDelay:
 *   1. pega a credencial no cofre (backend)
 *   2. loga NA CASA pelo browser (swarmClient)
 *   3. devolve os tokens ao backend, que guarda cifrado
 *
 * O passo 2 é o único que não passa pelo nosso servidor — é o ponto da feature.
 */
import { apiGateway } from '@/gateways/api.gateway';
import {
  NoDelayBookmaker, NoDelayAccount, NoDelayAccountStatus, NoDelaySession, NoDelayCheckResult,
} from '@/interfaces/nodelay.interface';
import { SwarmClient, SwarmConfig, SwarmError, SwarmLoginResult, SwarmBalance, swarmLoginOnce } from './swarmClient';
import { captureBet365UserContext } from '@/utils/bet365UserContext';

/** bet365: pré-aquece ipv6 (WebRTC/STUN) + geo (geolocation) do usuário JÁ no connect — assim a captura
 * (que custa até ~1,5-5s a frio, com prompt de localização) NÃO cai no relógio do clique→aposta (fica cacheada). */
/** bet365: captura ipv6/geo p/ MANDAR no connect (a warm session do backend prima com o geo real → 1ª aposta
 *  já quente, sem "aposta de aquecimento"). Retorna undefined p/ outras casas ou se a captura falhar. */
async function bet365ConnectCtx(house: NoDelayBookmaker): Promise<{ ipv6?: string; geo?: { lat: number; lon: number; acc: number } } | undefined> {
  if (house.platform !== 'bet365') return undefined;
  try { return await captureBet365UserContext(); } catch { return undefined; }
}

/** Traduz a casa (config do admin) para o que o cliente swarm precisa. */
export function houseToSwarmConfig(house: NoDelayBookmaker): SwarmConfig {
  if (!house.wssUrl) {
    throw new SwarmError('protocol', `${house.name} está sem o endereço de conexão configurado. Avise o suporte.`);
  }
  if (house.platform !== 'swarm') {
    throw new SwarmError('protocol', `A plataforma '${house.platform || '—'}' ainda não é suportada no NoDelay.`);
  }
  return {
    wssUrl: house.wssUrl,
    siteId: house.siteId,
    source: house.source,
    language: house.language,
  };
}

/** Para qual status a conta vai quando o login falha. */
function statusForError(e: unknown): NoDelayAccountStatus {
  const kind = e instanceof SwarmError ? e.kind : 'protocol';
  if (kind === 'rejected') return 'login_failed';
  if (kind === 'mfa_required') return 'mfa_required';
  // Rede/timeout/protocolo não são culpa da credencial — a conta só ficou fora.
  return 'disconnected';
}

export function errorText(e: unknown, fallback = 'Falha ao conectar.'): string {
  if (e instanceof SwarmError) return e.message;
  const api = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return api || (e as Error)?.message || fallback;
}

/** Métodos de 2º fator que a superbet oferece na hora de conectar. */
export interface SuperbetMfa {
  methods: string[];
  phone: string | null;
  hasSms: boolean;
  hasFaceid: boolean;
  /** superbet: URL do Unico p/ abrir no CELULAR (QR/link) e fazer a selfie. */
  faceidUrl?: string | null;
}

/**
 * Resultado de um "conectar": `ok` quando a conta já ficou logada, `mfa` quando
 * a casa (superbet) exige o 2º fator — nesse caso NÃO é erro, é um passo a mais:
 * a UI abre o modal de MFA. Erros de verdade continuam sendo `throw`.
 */
export type ConnectOutcome =
  | { status: 'ok' }
  | { status: 'mfa'; account: NoDelayAccount; mfa: SuperbetMfa };

/**
 * Núcleo do "logar de novo": lê a credencial do cofre, loga NA CASA pelo browser
 * e devolve a sessão ao backend. Reporta a falha no status (login_failed/mfa/…)
 * para o painel mostrar o porquê. Usado tanto pelo Conectar manual quanto pelo
 * reconnect automático.
 */
async function loginAndSave(house: NoDelayBookmaker, accountId: string): Promise<SwarmLoginResult & { balance: SwarmBalance | null }> {
  const config = houseToSwarmConfig(house);

  const credRes = await apiGateway.getNoDelayCredentials(accountId);
  if (credRes.data?.result !== 1) {
    throw new Error(credRes.data?.message || 'Não foi possível ler as credenciais da conta.');
  }
  const { username, password } = credRes.data.data as { username: string; password: string };

  try {
    const res = await swarmLoginOnce(config, username, password);
    await apiGateway.saveNoDelaySession(accountId, {
      externalUserId: res.userId,
      authToken: res.authToken,
      jweToken: res.jweToken,
      balance: res.balance?.balance,
      currency: res.balance?.currency,
    });
    return res;
  } catch (e) {
    // Best-effort: se o report falhar, o erro original é o que importa.
    try {
      await apiGateway.setNoDelayStatus(accountId, statusForError(e), errorText(e));
    } catch { /* ignora */ }
    throw e;
  }
}

/**
 * Login SERVER-SIDE (biahosted e superbet): o back lê a credencial do cofre, loga
 * (biahosted: BFF com Origin spoofado; superbet: cycletls + WAF) e salva a sessão.
 * O front só pede pro servidor conectar.
 */
async function connectServerSide(accountId: string, betCtx?: { ipv6?: string; geo?: { lat: number; lon: number; acc: number } }): Promise<ConnectOutcome> {
  const res = await apiGateway.connectNoDelayAccount(accountId, betCtx);
  if (res.data?.result === 1) return { status: 'ok' };

  // MFA da superbet: o back devolve result:0 MAS com data.mfa (ou status
  // 'mfa_required'). Não é falha — é o 2º fator pendente. Devolve pra UI abrir o
  // modal em vez de estourar. Sem data.mfa, é erro de verdade → throw.
  const acc = res.data?.data as (NoDelayAccount & { mfa?: SuperbetMfa; status?: string }) | undefined;
  if (acc && (acc.mfa || acc.status === 'mfa_required')) {
    const mfa: SuperbetMfa = acc.mfa ?? { methods: [], phone: null, hasSms: true, hasFaceid: false };
    return { status: 'mfa', account: acc, mfa };
  }
  throw new Error(res.data?.message || 'Falha ao conectar a conta.');
}

/** Casas cujo login roda no backend (não no browser). */
const isServerSide = (platform?: string | null): boolean => platform === 'biahosted' || platform === 'superbet' || platform === 'bet365';

/**
 * Loga uma conta JÁ cadastrada. Reporta o resultado ao backend nos dois
 * caminhos (sucesso e falha) — assim o painel mostra o porquê sem adivinhar.
 */
export async function connectAccount(house: NoDelayBookmaker, account: NoDelayAccount): Promise<ConnectOutcome> {
  if (isServerSide(house.platform)) {
    const betCtx = await bet365ConnectCtx(house); // ipv6/geo do usuário → warm prima com o geo real no connect
    return connectServerSide(account.id, betCtx);
  }
  await loginAndSave(house, account.id);
  return { status: 'ok' };
}

/**
 * Cadastra uma conta nova. Loga ANTES de salvar: credencial que não funciona
 * não entra no cofre (evita a lista encher de conta quebrada).
 */
export async function addAndConnectAccount(
  house: NoDelayBookmaker,
  input: { username: string; password: string; label?: string },
): Promise<{ account: NoDelayAccount; mfa: SuperbetMfa | null }> {
  // biahosted: o login é server-side e lê a credencial do cofre — então salva
  // PRIMEIRO e conecta depois. Se o login falhar, apaga (credencial ruim não
  // fica no cofre, igual ao swarm).
  if (isServerSide(house.platform)) {
    const betCtx = await bet365ConnectCtx(house); // ipv6/geo → warm prima com o geo real no connect
    const created = await apiGateway.createNoDelayAccount({
      bookmakerSlug: house.slug, username: input.username, password: input.password, label: input.label,
    });
    if (created.data?.result !== 1) {
      throw new Error(created.data?.message || 'Não foi possível salvar a conta.');
    }
    const account = created.data.data as NoDelayAccount;
    try {
      const out = await connectServerSide(account.id, betCtx);
      // MFA pendente: a conta FICA no cofre (é preciso dela p/ completar o 2º
      // fator). Devolve o mfa p/ a UI abrir o modal em vez de dar como conectada.
      if (out.status === 'mfa') return { account, mfa: out.mfa };
    } catch (e) {
      try { await apiGateway.deleteNoDelayAccount(account.id); } catch { /* ignora */ }
      throw e;
    }
    return { account, mfa: null };
  }

  const config = houseToSwarmConfig(house);

  const res = await swarmLoginOnce(config, input.username, input.password);

  const created = await apiGateway.createNoDelayAccount({
    bookmakerSlug: house.slug,
    username: input.username,
    password: input.password,
    label: input.label,
  });
  if (created.data?.result !== 1) {
    throw new Error(created.data?.message || 'Não foi possível salvar a conta.');
  }
  const account = created.data.data as NoDelayAccount;

  await apiGateway.saveNoDelaySession(account.id, {
    externalUserId: res.userId,
    authToken: res.authToken,
    jweToken: res.jweToken,
    balance: res.balance?.balance,
    currency: res.balance?.currency,
  });

  return { account, mfa: null };
}

/**
 * "Atualizar": revalida TODAS as contas, de TODAS as casas, e diz quais ainda
 * estão logadas. Para cada conta com sessão salva: socket novo → restore_login
 * (sem senha) → se viva, relê o saldo.
 *
 * RECONNECT AUTOMÁTICO (padrão): se a sessão caiu (token vencido), tenta LOGAR de
 * novo na hora com a credencial do cofre — a conta volta sozinha, sem clique. Só
 * fica em "sessão caiu" se o relogin também falhar (senha trocada/2FA). Desligue
 * com `{ autoReconnect: false }` para só diagnosticar.
 *
 * Em paralelo porque cada conta é um socket independente e uma que caia não diz
 * nada sobre as outras. `onProgress` alimenta o "X de N" do modal.
 */
export async function refreshAllAccounts(
  houses: NoDelayBookmaker[],
  onProgress?: (done: number, total: number) => void,
  opts?: { autoReconnect?: boolean },
): Promise<NoDelayCheckResult[]> {
  const autoReconnect = opts?.autoReconnect ?? true;
  const res = await apiGateway.getNoDelaySessions();
  if (res.data?.result !== 1) {
    throw new Error(res.data?.message || 'Não foi possível ler as sessões.');
  }
  const sessions = (res.data.data || []) as NoDelaySession[];

  const bySlug = new Map(houses.map((h) => [h.slug, h]));
  let done = 0;
  const tick = () => onProgress?.(++done, sessions.length);

  const checks = sessions.map(async (s): Promise<NoDelayCheckResult> => {
    const name = s.label || s.username;
    const house = bySlug.get(s.bookmakerSlug);
    const base = { id: s.id, name, bookmakerSlug: s.bookmakerSlug };

    if (!house?.ready) {
      tick();
      return { ...base, state: 'error', message: 'Casa indisponível' };
    }

    // Server-side (biahosted/superbet): sem restore por WSS — revalida logando de
    // novo no backend (biahosted ~1h; superbet reusa o device p/ não re-disparar MFA).
    if (isServerSide(house.platform)) {
      try {
        const out = await connectServerSide(s.id, await bet365ConnectCtx(house));
        tick();
        // MFA pediu 2º fator de novo (token WAF venceu) — precisa de atenção:
        // trata como "caiu" p/ o painel pedir reconexão (o modal abre no Conectar).
        if (out.status === 'mfa') {
          return { ...base, state: 'expired', message: 'Verificação (MFA) pendente — reconecte a conta.' };
        }
        return { ...base, state: 'alive' };
      } catch (e) {
        tick();
        return { ...base, state: 'error', message: errorText(e, 'Falha ao revalidar') };
      }
    }

    const client = new SwarmClient(houseToSwarmConfig(house));
    try {
      const alive = await client.restoreLogin(s.externalUserId, s.authToken);

      if (alive === 'expired') {
        // Fecha o socket do restore antes de abrir o do login novo.
        client.close();
        if (autoReconnect) {
          try {
            const res2 = await loginAndSave(house, s.id);
            tick();
            return { ...base, state: 'alive', balance: res2.balance?.balance ?? null, currency: res2.balance?.currency, message: 'Reconectada' };
          } catch (e) {
            // loginAndSave já marcou o status (login_failed/mfa/…). Aqui só reporta.
            tick();
            return { ...base, state: 'expired', message: errorText(e, 'Sessão caiu — reconecte.') };
          }
        }
        await apiGateway.setNoDelayStatus(s.id, 'session_expired', 'A sessão caiu na casa. Conecte de novo.');
        tick();
        return { ...base, state: 'expired', message: 'Sessão caiu' };
      }

      // Viva: aproveita o socket aberto e relê o saldo.
      const bal = await client.getBalance(s.externalUserId);
      if (bal) await apiGateway.saveNoDelayBalance(s.id, bal.balance, bal.currency);
      tick();
      return { ...base, state: 'alive', balance: bal?.balance ?? null, currency: bal?.currency };
    } catch (e) {
      // Rede/casa fora não é sessão morta — não mexe no status da conta.
      tick();
      return { ...base, state: 'error', message: errorText(e, 'Falha ao verificar') };
    } finally {
      client.close();
    }
  });

  return Promise.all(checks);
}

/**
 * Desconecta = esquece a sessão no nosso cofre.
 *
 * Não manda `logout` para a casa de propósito: o socket já foi fechado no fim do
 * login, e o comando exige uma conexão autenticada — reabrir e relogar só para
 * deslogar seria absurdo. O token que descartamos aqui expira sozinho na casa.
 * Quando a fase de disparo mantiver o socket VIVO por conta, aí o logout passa a
 * fazer sentido e entra aqui (client.logout() antes do clear).
 */
export async function disconnectAccount(account: NoDelayAccount): Promise<void> {
  await apiGateway.clearNoDelaySession(account.id);
}
