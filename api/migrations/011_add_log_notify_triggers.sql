-- Migration 011: notificação via LISTEN/NOTIFY para novos logs
-- Decisão (2026-09-25): explorar Postgres LISTEN/NOTIFY como alternativa ao
-- polling server-side (Opção B, atual) para detecção de novos logs na
-- stream SSE (/api/logs/stream). Objetivo é só aprender o mecanismo --
-- Opção B já funciona e já é tempo real do ponto de vista do usuário,
-- isso não resolve nenhum problema real existente (ver nota na FEAT-4 do
-- checklist).
--
-- Um único canal ("log_inserted") é usado para os 3 tipos de log -- o
-- payload identifica qual tipo mudou. Trigger é FOR EACH STATEMENT (não
-- FOR EACH ROW): um INSERT que insere 1000 linhas de uma vez (ex.: o
-- programa do Revit que insere em lote) dispara UMA notificação, não
-- 1000 -- evita inundar quem estiver ouvindo o canal.
--
-- Payload: {"log_type": "...", "count": N}. Sem max_id/min_id -- nenhum
-- consumidor (frontend ou backend) usaria essa informação hoje; o
-- fetchNewData() do frontend já resolve o delta sozinho via after_id,
-- a partir do que ele de fato baixa, não do que a notificação anuncia.

CREATE FUNCTION optsislog.notify_log_inserted() RETURNS TRIGGER AS $$
DECLARE
    row_count INTEGER;
    log_type TEXT := TG_ARGV[0];
BEGIN
    SELECT COUNT(*) INTO row_count FROM inserted_rows;

    PERFORM pg_notify(
        'log_inserted',
        json_build_object('log_type', log_type, 'count', row_count)::text
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_logs_notify
AFTER INSERT ON optsislog.process_logs 
REFERENCING NEW TABLE AS inserted_rows
FOR EACH STATEMENT
EXECUTE FUNCTION optsislog.notify_log_inserted('process');

CREATE TRIGGER windows_event_logs_notify
AFTER INSERT ON optsislog.windows_event_logs
REFERENCING NEW TABLE AS inserted_rows
FOR EACH STATEMENT
EXECUTE FUNCTION optsislog.notify_log_inserted('windows-event');

CREATE TRIGGER app_logs_notify
AFTER INSERT ON optsislog.app_logs
REFERENCING NEW TABLE AS inserted_rows
FOR EACH STATEMENT
EXECUTE FUNCTION optsislog.notify_log_inserted('app');
