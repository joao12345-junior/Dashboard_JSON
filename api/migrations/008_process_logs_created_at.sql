-- Migration 008: adiciona created_at em process_logs
-- Descoberta em producao: /api/logs/last-activity faz MAX(created_at) sobre
-- process_logs, mas essa coluna nunca esteve no INSERT do PostgresRepository.py
-- nem foi criada por nenhuma migration anterior -- provavelmente um ALTER TABLE
-- rodado direto na Neon, nunca versionado. DEFAULT now() é seguro: nao quebra
-- os INSERTs existentes, que nao referenciam essa coluna.
ALTER TABLE optsislog.process_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
