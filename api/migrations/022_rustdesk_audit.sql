-- Migration 022: auditoria do RustDesk (acesso remoto), lida do VPS da Optare por SFTP.
--   rustdesk_audit_raw:  um aviso por linha do avisos.jsonl (conexao, alarme, arquivo).
--                        Chave = SHA-256 da linha: reler ou rotacionar nao duplica.
--   rustdesk_sessions:   uma linha por conexao (new -> auth -> close), montada pelo coletor.
--                        Chave (maquina, conn_id, inicio): o conn_id reinicia com o servico.
--   rustdesk_machines:   ultimo estado de cada maquina (sysinfo, que NAO vai para a raw).
--   rustdesk_file_state: onde a leitura parou em cada arquivo remoto.
-- session_id passa do limite do bigint (ex.: 14704232641301615989): numeric(20).
-- Retencao: /api/logs/cleanup (RUSTDESK_RETENTION_DAYS); maquinas nao expiram.
CREATE TABLE IF NOT EXISTS optsislog.rustdesk_audit_raw (
  line_hash TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL,        -- recebido_utc (hora em que o VPS recebeu)
  source_ip TEXT,                          -- ip_origem (IP publico de onde a maquina avisou)
  path TEXT NOT NULL,                      -- caminho (/api/audit/conn, /api/audit/alarm...)
  kind TEXT NOT NULL,                      -- conn | alarm | file | other
  machine_id TEXT,                         -- corpo.id = maquina ACESSADA
  conn_id INTEGER,
  action TEXT,                             -- new | auth | close (so em conn)
  peer_id TEXT,                            -- quem acessou (auth: peer[0]; alarme: info.id)
  peer_name TEXT,
  peer_ip TEXT,
  primary_auth SMALLINT,                   -- 1 clique, 2 senha temporaria, 3 permanente, 4 troca de lados
  conn_type SMALLINT,                      -- 0 controle, 1 arquivos, 2 port forward, 3 camera, 4 terminal
  session_id NUMERIC(20),
  alarm_type SMALLINT,                     -- 1 = >30 erros do mesmo IP, 2 = >6 erros em 1 min
  body JSONB NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rustdesk_raw_received ON optsislog.rustdesk_audit_raw (received_at);
CREATE INDEX IF NOT EXISTS idx_rustdesk_raw_machine ON optsislog.rustdesk_audit_raw (machine_id, received_at);

CREATE TABLE IF NOT EXISTS optsislog.rustdesk_sessions (
  machine_id TEXT NOT NULL,
  conn_id INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  authenticated_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  peer_id TEXT,
  peer_name TEXT,
  peer_ip TEXT,
  primary_auth SMALLINT,
  conn_type SMALLINT,
  session_id NUMERIC(20),
  alarm_type SMALLINT,
  status TEXT NOT NULL CHECK (status IN ('concluida', 'aberta', 'bloqueada', 'tentativa')),
  PRIMARY KEY (machine_id, conn_id, started_at)
);
CREATE INDEX IF NOT EXISTS idx_rustdesk_sessions_started ON optsislog.rustdesk_sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS optsislog.rustdesk_machines (
  machine_id TEXT PRIMARY KEY,
  hostname TEXT,
  username TEXT,                           -- usuario logado no ultimo sysinfo (NULL = ninguem)
  last_username TEXT,                      -- ultimo usuario visto
  os TEXT,
  version TEXT,
  cpu TEXT,
  memory TEXT,
  uuid TEXT,
  source_ip TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,  -- VM de laboratorio, notebook do tecnico...
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sysinfo_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS optsislog.rustdesk_file_state (
  file_name TEXT PRIMARY KEY,
  read_offset BIGINT NOT NULL,
  head_hash TEXT,
  head_len INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
