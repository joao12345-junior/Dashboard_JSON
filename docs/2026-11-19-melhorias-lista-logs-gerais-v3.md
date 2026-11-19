# 2026-11-19 — Lista de Logs Gerais, terceira rodada (modal: contexto, navegação e JSON)

Itens do backlog da v2 (`2026-11-19-melhorias-lista-logs-gerais-v2.md`).

## Decisão: histograma NÃO entra na lista
Foi implementado um histograma de volume (por dia, e por hora com um dia filtrado) e **removido no mesmo dia**: a página *Dashboard — Logs Gerais* (`AppDashboard`) já tem KPIs, gráfico diário por severidade/programa e top programas. Duplicar isso na lista só ocupava espaço. A lista fica focada em **ler e investigar registros**; visão agregada fica no Dashboard.
Removidos: `AppLogHistogram.tsx`, `src/lib/logBuckets.ts` e o estado de hora do `AppList`.

## O que mudou (tudo no modal de detalhes, `AppLogDetailsModal.tsx`)
- **Copiar log:** data/hora, tipo, programa › classe, mensagem e `detalhes` originais. Se o navegador negar a área de transferência, não mostra "Copiado" falso.
- **Ao redor — <programa>:** até 5 registros antes/depois do mesmo programa (ignora os filtros da tela); clicar abre o registro (`surroundingLogs.ts`).
- **Navegação pela lista filtrada:** botões "← Mais novo" / "Mais antigo →" e as setas ← → do teclado, com "N de TOTAL na lista". Segue a lista inteira filtrada (não só a página de 100). As setas são ignoradas dentro de textarea/input/select.
  - Caso de uso: filtrar por "Erros" e percorrer um a um sem fechar o modal.
- **JSON formatado em `detalhes`:** se o texto for JSON válido, aparece indentado, com rótulo "Detalhes · JSON" e botão "Ver original". Texto que não é JSON (stack trace, etc.) não muda.
  - `src/lib/formatDetails.ts` **não** usa `JSON.stringify(JSON.parse(x))`: o parse arredonda inteiros grandes (ex.: `9007199254740993`) e um visualizador de logs não pode alterar valores. A função só insere quebras/espaços fora das strings; o `JSON.parse` é usado apenas para validar.

## Arquivos
- Novos: `src/lib/formatDetails.ts`, `src/lib/surroundingLogs.ts`.
- Alterados: `src/features/app-logs/AppList.tsx`, `src/features/app-logs/components/AppLogDetailsModal.tsx`.
- Nenhum arquivo ignorado pelo git foi tocado (nada para copiar manualmente ao servidor 201).

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- `formatDetails` testado em Node: id de 64 bits preservado, `,` `:` `{` dentro de strings preservados, `{}`/`[]` compactos, texto não-JSON e JSON quebrado voltam como original, e o resultado re-minificado é igual ao original.
- Chrome: filtro "Erros" (241 registros) → ← → percorrem 1→2→1, "Mais novo" desabilitado no primeiro; log do Atendimento_bot mostra "Detalhes · JSON" indentado e alterna com "Ver original".
- Não verificado: feedback visual de "Copiar log" (a automação não tem permissão de clipboard). Testar manualmente.

## Backlog
- Filtros na URL e views salvas.
- Mesma correção de largura (`flex:1; minWidth:0`) em `WindowsList`/`ProcessList`.
- Busca com mais de um termo / exclusão (`-termo`).
