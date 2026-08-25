-- Migration 009: adiciona permalink em sentry_events
-- GET /api/site/sentry-events seleciona permalink, mas o INSERT em
-- sync_sentry() (versao real do site_monitor.py) ja grava esse campo --
-- so a minha reconstrucao do 000 nao tinha. Sem DEFAULT: se ficar NULL
-- pra eventos ja sincronizados antes, tudo bem, e so um link pro Sentry.
ALTER TABLE optsislog.sentry_events
  ADD COLUMN IF NOT EXISTS permalink TEXT;
