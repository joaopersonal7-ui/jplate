// Conversa com o servidor do JPlate (server/): dica do dia por notificação e IA de reserva da SÁ.
// Nada de dados do diário vai para o servidor: só um código aleatório do aparelho, a pergunta feita à IA e a inscrição de notificação.
import * as db from './db.js';
import { SERVIDOR } from './config.js';

export const temServidor = () => Boolean(SERVIDOR);

// Código aleatório deste aparelho, para contar o limite diário de perguntas à IA. Não identifica a pessoa.
async function codigoAluno() {
  let id = await db.kvGet('aluno', null);
  if (!id) {
    id = crypto.randomUUID();
    await db.kvSet('aluno', id);
  }
  return id;
}

async function chamar(caminho, corpo) {
  const r = await fetch(SERVIDOR + caminho, corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : {});
  return r.json();
}

// ---------- IA ----------

const ERROS_IA = {
  limite_aluno: 'Você já usou as perguntas à IA de hoje. Amanhã tem mais.',
  limite_total: 'A IA atingiu o limite de perguntas de hoje. Tente amanhã.',
  teto_mes: 'A IA está pausada até o próximo mês. Continuo respondendo pelo meu banco de informações.',
};

// Devolve { texto, restantes } ou { erro } com uma frase pronta para mostrar.
export async function perguntarIA(pergunta) {
  if (!temServidor() || !navigator.onLine) return null;
  try {
    const r = await chamar('/ia', { aluno: await codigoAluno(), pergunta });
    if (r.resposta) return { texto: r.resposta, fora: r.fora, restantes: r.restantes };
    return { erro: ERROS_IA[r.erro] ?? 'A IA não está disponível agora.' };
  } catch {
    return { erro: 'A IA não está disponível agora.' };
  }
}

// ---------- notificações ----------

export const HORAS = [7, 8, 9, 12, 15, 18, 20, 21];

export function suporteNotificacao() {
  if (!temServidor()) return 'sem-servidor';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // No iPhone, notificação só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo).
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone ? 'instalar-ios' : 'sem-suporte';
  }
  return Notification.permission === 'denied' ? 'bloqueado' : 'ok';
}

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function inscricaoAtual() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function estadoNotificacao() {
  if (suporteNotificacao() !== 'ok') return { ativo: false };
  const sub = await inscricaoAtual();
  return { ativo: Boolean(sub), hora: await db.kvGet('dicaHora', 8) };
}

export async function ativarNotificacao(hora) {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Permissão negada. Libere as notificações do JPlate nos ajustes do aparelho.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { chave } = await chamar('/push/chave');
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) });
    } catch {
      throw new Error('Este aparelho não aceitou a inscrição de notificações. Confira se o app está instalado e com notificações liberadas.');
    }
  }
  const r = await chamar('/push/inscrever', { aluno: await codigoAluno(), hora, inscricao: sub.toJSON() });
  if (!r.ok) throw new Error('O servidor não aceitou a inscrição. Tente de novo.');
  await db.kvSet('dicaHora', hora);
}

export async function desativarNotificacao() {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await chamar('/push/cancelar', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function testarNotificacao() {
  const sub = await inscricaoAtual();
  if (!sub) throw new Error('Ative as notificações primeiro.');
  const r = await chamar('/push/teste', { endpoint: sub.endpoint });
  if (!r.ok) throw new Error('Não foi possível enviar o teste agora.');
}
