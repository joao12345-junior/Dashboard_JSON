-- migrations/007_rename_origem_to_classe_add_programa.sql
ALTER TABLE optsislog.app_logs RENAME COLUMN origem TO classe;
ALTER TABLE optsislog.app_logs ADD COLUMN programa TEXT;