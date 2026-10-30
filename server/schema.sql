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
-- Uso da IA: perguntas por aluno por dia.
CREATE TABLE IF NOT EXISTS ia_dia (aluno TEXT NOT NULL, dia TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (aluno, dia));
-- Vetores dos títulos do banco da SÁ (recalculados quando o banco muda).
CREATE TABLE IF NOT EXISTS vetores (versao TEXT NOT NULL, lote INTEGER NOT NULL, dados TEXT NOT NULL, PRIMARY KEY (versao, lote));
