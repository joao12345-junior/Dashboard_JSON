# Documentação de mudanças do LogDash

Regra de trabalho (definida em 2026-11-19): **toda mudança no LogDash gera um registro nesta pasta**, um arquivo por mudança, no padrão `AAAA-MM-DD-assunto.md` (contexto/motivo, o que mudou, arquivos alterados, como testar, pendências). Mudanças em arquivos ignorados pelo git (`*.ps1`, `.env`, `certs/`) devem dizer que precisam ser copiadas manualmente para o servidor 201.

## Índice (mais recente primeiro)
- [2026-11-19 — Correção do parse de data/hora](2026-11-19-correcao-parse-timestamp.md) — helper `parseTimestamp` único; corrige hora com sufixo de fuso quando o timestamp não tem fração
- [2026-11-19 — Auditoria inicial](2026-11-19-auditoria-inicial.md) — análise de lint/tipos/segurança e backlog das próximas mudanças (nenhum código alterado).
- [2026-11-12 — init.ps1 falha ao rodar como serviço](2026-11-12-init-ps1-falha-como-servico.md) — causa, correções (`return ,$result`, `WaitForExit`, regex HTTPS) e pendências.
