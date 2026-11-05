// Endereços do JPlate. Preenchidos automaticamente pelo GitHub Actions; não precisa editar à mão.

// Servidor (notificações e IA da SÁ) no endereço público do Cloudflare Workers.
// Usado só pela cópia antiga do app (GitHub Pages) e no teste local, enquanto a mudança de endereço acontece.
// Gravado por .github/workflows/servidor.yml.
export const SERVIDOR_EXTERNO = 'https://jplate-servidor.joaopersonal-7.workers.dev';

// Endereço novo e protegido do app (Cloudflare Pages + Cloudflare Access). Vazio enquanto não foi publicado.
// Gravado por .github/workflows/site.yml.
export const NOVO_ENDERECO = '';

const host = globalThis.location?.hostname ?? '';
const enderecoAntigo = host.endsWith('github.io') || host === 'localhost' || host === '127.0.0.1';

// No endereço novo o servidor fica atrás do próprio site (/api), protegido pelo mesmo login.
// Vazio = o app funciona só offline, sem esses recursos.
export const SERVIDOR = enderecoAntigo ? SERVIDOR_EXTERNO : `${globalThis.location?.origin ?? ''}/api`;

// Cópia antiga (GitHub Pages) com o endereço novo já no ar: o app avisa o aluno para levar o backup.
export const MUDOU_DE_ENDERECO = Boolean(NOVO_ENDERECO) && host.endsWith('github.io');
