// Web Push sem bibliotecas: assinatura VAPID (RFC 8292) e criptografia aes128gcm (RFC 8291).
// Tudo com WebCrypto, que existe tanto no Cloudflare Workers quanto no Node.

const enc = new TextEncoder();

export const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// Par de chaves VAPID do servidor. A pública vai para o app; a privada só assina.
export async function newVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

export async function vapidAuth(endpoint, vapid, subject, now = Date.now()) {
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${vapid.publicKey}`;
}

// Cifra a mensagem para um aparelho. `salt` e `serverKeys` só são passados nos testes.
export async function encrypt(payload, { p256dh, auth }, { salt = crypto.getRandomValues(new Uint8Array(16)), serverKeys } = {}) {
  const uaPublic = unb64url(p256dh);
  const as = serverKeys ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256));

  const ikm = await hkdf(unb64url(auth), shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Um registro só: texto + 0x02 (marca de último registro).
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// Envia uma notificação. Devolve o status HTTP do serviço de push (201 = entregue; 404/410 = inscrição vencida).
export async function sendPush(sub, data, vapid, subject) {
  const body = await encrypt(JSON.stringify(data), sub);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(12 * 3600),
      Urgency: 'normal',
    },
    body,
  });
  return r.status;
}
