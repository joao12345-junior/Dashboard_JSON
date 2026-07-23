-- Migration 005: função de limpeza de refresh tokens expirados/revogados
CREATE OR REPLACE FUNCTION optsislog.cleanup_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM optsislog.refresh_tokens
    WHERE expires_at < now()
       OR revoked_at < now() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;