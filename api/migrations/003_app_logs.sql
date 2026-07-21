-- Migration 003: criar app_logs (logs genéricos de aplicações — origem: OptRevit.Logs)
CREATE TABLE optsislog.app_logs (
    id           BIGSERIAL PRIMARY KEY,
    origem       VARCHAR(100) NOT NULL,
    tipo         VARCHAR(10)  NOT NULL,
    mensagem     TEXT         NOT NULL,
    detalhes     TEXT,
    ocorrido_em  TIMESTAMPTZ  NOT NULL,
    coletado_em  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT app_logs_tipo_check CHECK (tipo IN ('debug', 'info', 'aviso', 'erro'))
);

CREATE INDEX ix_app_logs_ocorrido ON optsislog.app_logs (ocorrido_em DESC);