-- Migration 010: remove o pipeline do ingestor (ports/adapters)
-- Decisão (2026-09-15): o ingestor (ingestor/, rota /api/ingest) foi desligado
-- de vez. Backup logs passam a ser inseridos diretamente no banco pelo
-- programa que gera o log, mesmo padrão do app_logs. run_id existia só para
-- rastrear qual execução do ingestor inseriu cada registro -- sem o
-- ingestor, essa informação não é mais produzida por ninguém.
--
-- Decisão explícita do João: ok perder o vínculo histórico de run_id nos
-- registros antigos (opção "b" -- limpa de vez em vez de manter
-- ingestion_runs só como histórico órfão).

ALTER TABLE optsislog.process_logs DROP COLUMN IF EXISTS run_id;
ALTER TABLE optsislog.windows_event_logs DROP COLUMN IF EXISTS run_id;

DROP FUNCTION IF EXISTS optsislog.finish_ingestion_run(BIGINT, INTEGER, INTEGER, INTEGER, TEXT);
DROP TABLE IF EXISTS optsislog.ingestion_runs;
