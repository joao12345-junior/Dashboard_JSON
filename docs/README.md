# Documentação de mudanças do LogDash

Regra de trabalho (definida em 2026-11-19): **toda mudança no LogDash gera um registro nesta pasta**, um arquivo por mudança, no padrão `AAAA-MM-DD-assunto.md` (contexto/motivo, o que mudou, arquivos alterados, como testar, pendências). Mudanças em arquivos ignorados pelo git (`*.ps1`, `.env`, `certs/`) devem dizer que precisam ser copiadas manualmente para o servidor 201.

## Índice (mais recente primeiro)
- [2026-11-19 — Lista de Logs Gerais: acabamento visual, acessibilidade e copy](2026-11-19-acabamento-visual-lista-logs-gerais.md) — faixa cinza nos INFO, tom em erro/aviso, hover, linha sem botão aninhado (horário abre o modal), foco/rótulos nos filtros, contraste, estado vazio com ação
- [2026-11-19 — Lista de Logs Gerais, segunda rodada](2026-11-19-melhorias-lista-logs-gerais-v2.md) — chips de severidade com contagem, clique para filtrar, agrupar repetidos, pausar, exportar CSV
- [2026-11-19 — Lista de Logs Gerais, terceira rodada](2026-11-19-melhorias-lista-logs-gerais-v3.md) — modal: copiar log, eventos ao redor, navegação ← → pela lista filtrada, JSON formatado (histograma descartado: já existe no Dashboard)
- [2026-11-19 — Revisão final da lista de Logs Gerais](2026-11-19-revisao-final-lista-logs-gerais.md) — correção de defeitos: lista invisível no mobile, filtros recolhíveis, toda linha abre o modal, foco/teclado, linha selecionada
- [2026-11-19 — Home: principais erros de hoje e ontem](2026-11-19-home-principais-erros-hoje-e-ontem.md) — painel com erros agrupados de backup, Windows e app; NOVO vs ontem; clique abre a lista filtrada; 2ª rodada: variação vs ontem até a mesma hora, último erro, acessibilidade e copy; 3ª rodada: cartões "Erros/Avisos hoje" com média de 7 dias, "último registro" por fonte, cartões como botões, mobile; 4ª rodada: ordenação dos erros, feeds Críticos/Avisos refeitos (tabela única, botão por linha, abre a lista filtrada)
- [2026-11-19 — Preloader e estados de carregamento](2026-11-19-preloader-e-estados-de-carregamento.md) — tela de sessão com atraso anti-flash, "carregando/indisponível" em vez de "nenhum erro", erro da API com retry, toast com contagem real, keyframes e `--status-error` que não existiam.
- [2026-11-19 — Listas: carregamento, foco nos filtros e mobile](2026-11-19-listas-carregamento-foco-e-mobile.md) — Windows/Backup com "carregando" e erro com retry, foco visível e rótulos nos filtros, hambúrguer sem cobrir o título em todas as páginas.
- [2026-11-19 — Lista de Logs Gerais agrupada por dia](2026-11-19-lista-app-logs-agrupada-por-dia.md) — cabeçalho por dia com totais, origem (programa/classe) em destaque, botões Hoje/Ontem
- [2026-11-19 — Limpeza da página de Configurações](2026-11-19-limpeza-pagina-configuracoes.md) — remove fontes/tipos legados, Toast de erro, apaga modais e `ingest.py` mortos
- [Combinados de trabalho](combinados-de-trabalho.md) — quem escreve o quê, fluxo de cada mudança, restrições (leia primeiro)
- [2026-11-19 — Correção do parse de data/hora](2026-11-19-correcao-parse-timestamp.md) — helper `parseTimestamp` único; corrige hora com sufixo de fuso quando o timestamp não tem fração
- [2026-11-19 — Auditoria inicial](2026-11-19-auditoria-inicial.md) — análise de lint/tipos/segurança e backlog das próximas mudanças (nenhum código alterado).
- [2026-11-12 — init.ps1 falha ao rodar como serviço](2026-11-12-init-ps1-falha-como-servico.md) — causa, correções (`return ,$result`, `WaitForExit`, regex HTTPS) e pendências.
