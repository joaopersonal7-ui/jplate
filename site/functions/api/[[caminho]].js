// Repassa /api/* para o servidor do JPlate (server/) por uma ligação interna da Cloudflare (service binding).
// O servidor não tem endereço público: só quem passou pelo login do Cloudflare Access chega aqui.
export async function onRequest({ request, env }) {
  if (!env.SERVIDOR) return Response.json({ erro: 'indisponivel' }, { status: 503 });
  const url = new URL(request.url);
  const destino = new URL(url.pathname.replace(/^\/api/, '') || '/', 'https://servidor.interno');
  destino.search = url.search;
  return env.SERVIDOR.fetch(new Request(destino, request));
}
