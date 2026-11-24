-- Migration 016: registro de programas dos Logs Gerais (app_logs.programa).
--   Ate aqui "programa" era so' um texto em app_logs; como app_logs guarda 14 dias,
--   um programa sumia da lista junto com seus logs. Esta tabela lembra de cada
--   programa depois que os logs saem, e guarda a escolha manual de visibilidade:
--     visibility NULL     = automatico (some das telas apos 5 dias sem log; volta no proximo log)
--     visibility 'shown'  = sempre visivel (ignora a inatividade)
--     visibility 'hidden' = oculto (so' volta se for mudado nos Ajustes)
--   Programas sem linha aqui sao tratados como automaticos.
CREATE TABLE IF NOT EXISTS optsislog.app_programs (
  programa TEXT PRIMARY KEY,
  visibility TEXT CHECK (visibility IN ('shown', 'hidden')),
  visibility_changed_at TIMESTAMPTZ,
  last_log_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
