-- Migration 012: corpo da resposta nos checks de disponibilidade + cadastro do cofre
-- response_body: primeiros bytes da resposta HTTP do check (texto simples ou JSON),
--   exibidos no modal de detalhes do Site. NULL = nada guardado (timeout, sem
--   resposta, ou URL sem save_response_body).
-- save_response_body: liga a gravacao do corpo POR URL. Desligado por padrao: o
--   Site Optare devolve a home em HTML e nao faz sentido guardar isso a cada check.
-- Idempotente (IF NOT EXISTS / WHERE NOT EXISTS), no mesmo estilo da 009.
ALTER TABLE optsislog.site_availability
  ADD COLUMN IF NOT EXISTS response_body TEXT;

ALTER TABLE optsislog.monitored_urls
  ADD COLUMN IF NOT EXISTS save_response_body BOOLEAN NOT NULL DEFAULT false;

-- Cofre: /health publico em texto chave=valor (status, checked_at, latency_ms, checks).
-- WHERE NOT EXISTS: se o cofre ja foi cadastrado pela tela de Settings, nao duplica.
INSERT INTO optsislog.monitored_urls (label, url, timeout_seconds, has_sentry, save_response_body)
SELECT 'Cofre', 'https://cofre.optare.com.br/health', 10, false, true
WHERE NOT EXISTS (
  SELECT 1 FROM optsislog.monitored_urls
  WHERE url = 'https://cofre.optare.com.br/health'
);
