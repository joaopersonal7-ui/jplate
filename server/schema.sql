-- Banco do servidor (Cloudflare D1). Pode rodar de novo sem apagar nada.
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);
-- Quem aceitou as notificações: uma linha por aparelho.
CREATE TABLE IF NOT EXISTS inscricoes (
  endpoint TEXT PRIMARY KEY,
  aluno TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  hora INTEGER NOT NULL,
  criado TEXT NOT NULL,
  ultimo TEXT
);
CREATE INDEX IF NOT EXISTS inscricoes_hora ON inscricoes (hora);
-- Uso da IA: por aluno por dia, e gasto do mês.
CREATE TABLE IF NOT EXISTS ia_dia (aluno TEXT NOT NULL, dia TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (aluno, dia));
CREATE TABLE IF NOT EXISTS ia_mes (mes TEXT PRIMARY KEY, usd REAL NOT NULL, perguntas INTEGER NOT NULL);
