-- Migration 006: marca quais sites monitorados têm integração com Sentry
ALTER TABLE optsislog.monitored_urls
  ADD COLUMN has_sentry BOOLEAN NOT NULL DEFAULT false;

UPDATE optsislog.monitored_urls
SET has_sentry = true
WHERE url = 'https://optare.com.br';