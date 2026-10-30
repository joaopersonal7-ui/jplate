// Conversa com o servidor do JPlate (server/): dica do dia por notificação e interpretação das perguntas da SÁ.
// Nada de dados do diário vai para o servidor: só um código aleatório do aparelho, a pergunta feita à SÁ e a inscrição de notificação.
import * as db from './db.js';
import { SERVIDOR } from './config.js';

export const temServidor = () => Boolean(SERVIDOR);

// Código aleatório deste aparelho, para contar o limite diário de perguntas. Não identifica a pessoa.
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

// ---------- interpretação da pergunta ----------

// A IA do servidor só escolhe qual pergunta cadastrada no banco responde à dúvida do aluno.
// Devolve { titulo } (título do banco, ou null se nenhum responde) ou null quando o servidor não pôde ajudar
// (sem internet, limite do dia, falha): aí a SÁ usa a própria busca do app.
export async function entenderPergunta(pergunta, candidatos) {
  if (!temServidor() || !navigator.onLine) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`${SERVIDOR}/entender`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ aluno: await codigoAluno(), pergunta, candidatos }) }).then((x) => x.json()).finally(() => clearTimeout(t));
    return 'titulo' in r ? { titulo: r.titulo } : null;
  } catch {
    return null;
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
