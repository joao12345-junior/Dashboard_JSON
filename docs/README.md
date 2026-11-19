# Documentação de mudanças do LogDash

Regra de trabalho (definida em 2026-11-19): **toda mudança no LogDash gera um registro nesta pasta**, um arquivo por mudança, no padrão `AAAA-MM-DD-assunto.md` (contexto/motivo, o que mudou, arquivos alterados, como testar, pendências). Mudanças em arquivos ignorados pelo git (`*.ps1`, `.env`, `certs/`) devem dizer que precisam ser copiadas manualmente para o servidor 201.

## Índice (mais recente primeiro)
- [2026-11-19 — Lista de Logs Gerais, segunda rodada](2026-11-19-melhorias-lista-logs-gerais-v2.md) — chips de severidade com contagem, clique para filtrar, agrupar repetidos, pausar, exportar CSV
- [2026-11-19 — Lista de Logs Gerais, terceira rodada](2026-11-19-melhorias-lista-logs-gerais-v3.md) — modal: copiar log, eventos ao redor, navegação ← → pela lista filtrada, JSON formatado (histograma descartado: já existe no Dashboard)
- [2026-11-19 — Revisão final da lista de Logs Gerais](2026-11-19-revisao-final-lista-logs-gerais.md) — correção de defeitos: lista invisível no mobile, filtros recolhíveis, toda linha abre o modal, foco/teclado, linha selecionada
- [2026-11-19 — Lista de Logs Gerais agrupada por dia](2026-11-19-lista-app-logs-agrupada-por-dia.md) — cabeçalho por dia com totais, origem (programa/classe) em destaque, botões Hoje/Ontem
- [2026-11-19 — Limpeza da página de Configurações](2026-11-19-limpeza-pagina-configuracoes.md) — remove fontes/tipos legados, Toast de erro, apaga modais e `ingest.py` mortos
- [Combinados de trabalho](combinados-de-trabalho.md) — quem escreve o quê, fluxo de cada mudança, restrições (leia primeiro)
- [2026-11-19 — Correção do parse de data/hora](2026-11-19-correcao-parse-timestamp.md) — helper `parseTimestamp` único; corrige hora com sufixo de fuso quando o timestamp não tem fração
- [2026-11-19 — Auditoria inicial](2026-11-19-auditoria-inicial.md) — análise de lint/tipos/segurança e backlog das próximas mudanças (nenhum código alterado).
- [2026-11-12 — init.ps1 falha ao rodar como serviço](2026-11-12-init-ps1-falha-como-servico.md) — causa, correções (`return ,$result`, `WaitForExit`, regex HTTPS) e pendências.
