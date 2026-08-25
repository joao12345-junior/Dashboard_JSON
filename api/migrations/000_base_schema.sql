-- =====================================================================
-- Migration 000 -- base schema do optsislog (reconstrucao best-effort)
-- =====================================================================
-- Este arquivo NAO existia como migration original -- as migrations reais
-- do projeto comecam em 001, o que confirma que este schema base foi
-- criado a mao, sem versionamento, antes do runner existir.
--
-- Reconstruido lendo os INSERT/SELECT reais no codigo (ingestor Python +
-- Flask API) porque o banco original (Neon) esta fora do ar (limite de
-- CPU-h excedido) e nao ha dump nem schema.sql anterior a isso.
--
-- Confianca alta (colunas batem com o codigo real):
--   ingestion_runs, process_logs, windows_event_logs, users,
--   site_availability, sentry_events, ENUM criticality_level
--
-- Reconstrucao especulativa, testar antes de confiar:
--   finish_ingestion_run() -- assinatura confirmada via PostgresRunLogger.py,
--   mas a logica interna de success/partial/failed e um chute informado.
--
-- Fora deste arquivo (sem fonte confiavel encontrada em lugar nenhum):
--   optsislog.purge_old_logs(), v_recent_ingestion_runs,
--   v_process_log_summary, v_windows_event_summary
--   -> nao aparecem referenciadas em nenhum lugar do codigo (Flask nem
--      frontend). Se voce sabe que algo externo ao repo usa isso, avise
--      antes de considerar a migracao "completa".
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS optsislog;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'criticality_level') THEN
        CREATE TYPE optsislog.criticality_level AS ENUM ('High', 'Medium', 'Low', 'Unknown');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS optsislog.ingestion_runs (
    id                BIGSERIAL PRIMARY KEY,
    source_type       TEXT NOT NULL,
    source_host       TEXT,
    status            TEXT NOT NULL DEFAULT 'running',
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ,
    files_processed   INTEGER,
    files_failed      INTEGER,
    records_inserted  INTEGER,
    error_message     TEXT
);

CREATE TABLE IF NOT EXISTS optsislog.process_logs (
    id           BIGSERIAL PRIMARY KEY,
    message      TEXT NOT NULL,
    log_date     DATE NOT NULL,
    log_time     TIME NOT NULL,
    start        SMALLINT NOT NULL,
    source_name  TEXT NOT NULL,
    run_id       BIGINT REFERENCES optsislog.ingestion_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_process_logs_source_name
    ON optsislog.process_logs (source_name);
CREATE INDEX IF NOT EXISTS idx_process_logs_date_time
    ON optsislog.process_logs (log_date DESC, log_time DESC);

CREATE TABLE IF NOT EXISTS optsislog.windows_event_logs (
    id            BIGSERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL,
    level         SMALLINT,
    level_label   TEXT,
    provider      TEXT,
    computer      TEXT,
    channel       TEXT,
    time_created  TIMESTAMPTZ NOT NULL,
    message       TEXT,
    criticality   optsislog.criticality_level,
    summary       TEXT,
    source_file   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    run_id        BIGINT REFERENCES optsislog.ingestion_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_windows_event_logs_time_created
    ON optsislog.windows_event_logs (time_created DESC);

CREATE TABLE IF NOT EXISTS optsislog.users (
    id             BIGSERIAL PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- site_availability precisa existir SEM monitored_url_id aqui --
-- a migration 001 adiciona a coluna e a 002 trava como NOT NULL.
CREATE TABLE IF NOT EXISTS optsislog.site_availability (
    id                BIGSERIAL PRIMARY KEY,
    url               TEXT NOT NULL,
    status_code       INTEGER,
    response_time_ms  INTEGER,
    is_up             BOOLEAN NOT NULL,
    checked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_availability_checked_at
    ON optsislog.site_availability (checked_at DESC);

CREATE TABLE IF NOT EXISTS optsislog.sentry_events (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    level       TEXT,
    culprit     TEXT,
    first_seen  TIMESTAMPTZ,
    last_seen   TIMESTAMPTZ,
    count       INTEGER,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ESPECULATIVO -- ver aviso no topo do arquivo.
CREATE OR REPLACE FUNCTION optsislog.finish_ingestion_run(
    p_run_id           BIGINT,
    p_files_processed  INTEGER,
    p_files_failed     INTEGER,
    p_records_inserted INTEGER,
    p_error_message    TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE optsislog.ingestion_runs
    SET
        files_processed  = p_files_processed,
        files_failed     = p_files_failed,
        records_inserted = p_records_inserted,
        error_message    = p_error_message,
        finished_at      = now(),
        status = CASE
            WHEN p_error_message IS NOT NULL THEN 'failed'
            WHEN p_files_failed > 0 AND p_files_processed > 0 THEN 'partial'
            WHEN p_files_failed > 0 AND p_files_processed = 0 THEN 'failed'
            ELSE 'success'
        END
    WHERE id = p_run_id;
END;
$$ LANGUAGE plpgsql;
