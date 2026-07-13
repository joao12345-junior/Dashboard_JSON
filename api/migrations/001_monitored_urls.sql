-- Migration 001: criar monitored_urls, generalizar site_availability
CREATE TABLE optsislog.monitored_urls (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  url VARCHAR(500) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  timeout_seconds INT NOT NULL DEFAULT 10 CHECK (timeout_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO optsislog.monitored_urls (label, url, timeout_seconds)
VALUES
  ('Site Optare', 'https://optare.com.br', 10),
  ('Atendimento Bot', 'https://optare-atendimento.onrender.com/health', 90);

ALTER TABLE optsislog.site_availability
  ADD COLUMN monitored_url_id INT REFERENCES optsislog.monitored_urls(id);

UPDATE optsislog.site_availability
SET monitored_url_id = (SELECT id FROM optsislog.monitored_urls WHERE url = 'https://optare.com.br')
WHERE url = 'https://optare.com.br';

CREATE INDEX idx_site_availability_monitored_url_id
  ON optsislog.site_availability(monitored_url_id);