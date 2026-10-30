// Confere a criptografia das notificações com o http_ece (implementação de referência do RFC 8188)
// e a assinatura VAPID com o crypto do Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, createPublicKey, verify, randomBytes } from 'node:crypto';
import ece from 'http_ece';
import { encrypt, newVapidKeys, vapidAuth, b64url, unb64url } from '../src/webpush.js';

test('mensagem cifrada abre no aparelho (aes128gcm, RFC 8291)', async () => {
  // O "aparelho": par de chaves P-256 e segredo de autenticação, como o navegador cria na inscrição.
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const texto = JSON.stringify({ title: 'Dica do dia: Calorias', body: 'Caloria é uma unidade de medida de energia. Ação, coração.' });
  const body = await encrypt(texto, { p256dh: b64url(ua.getPublicKey()), auth: b64url(auth) });
  const aberto = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth });
  assert.equal(aberto.toString('utf8'), texto);
});

test('assinatura VAPID é um ES256 válido para o serviço de push', async () => {
  const keys = await newVapidKeys();
  const h = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', keys, 'https://github.com/joaopersonal7-ui/jplate', Date.UTC(2026, 9, 30));
  const [, t, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, keys.publicKey);
  const [hd, cl, sig] = t.split('.');
  const claims = JSON.parse(Buffer.from(unb64url(cl)).toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'https://github.com/joaopersonal7-ui/jplate');
  const pub = unb64url(keys.publicKey);
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33)) }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${hd}.${cl}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(unb64url(sig))));
});
