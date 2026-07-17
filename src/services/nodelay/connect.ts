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
 * Loga uma conta JÁ cadastrada. Reporta o resultado ao backend nos dois
 * caminhos (sucesso e falha) — assim o painel mostra o porquê sem adivinhar.
 */
export async function connectAccount(house: NoDelayBookmaker, account: NoDelayAccount): Promise<SwarmLoginResult> {
  return loginAndSave(house, account.id);
}

/**
 * Cadastra uma conta nova. Loga ANTES de salvar: credencial que não funciona
 * não entra no cofre (evita a lista encher de conta quebrada).
 */
export async function addAndConnectAccount(
  house: NoDelayBookmaker,
  input: { username: string; password: string; label?: string },
): Promise<NoDelayAccount> {
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

  return account;
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
