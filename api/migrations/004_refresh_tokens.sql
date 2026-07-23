-- Migration 004: refresh tokens para sessão persistente com rotação
CREATE TABLE optsislog.refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,  -- sha256 hex do token opaco
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX ix_refresh_tokens_token_hash ON optsislog.refresh_tokens (token_hash);