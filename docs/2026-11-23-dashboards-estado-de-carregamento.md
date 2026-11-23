# Dashboards: estado "carregando" e erro com retry (Backup, Windows, Logs Gerais, Site)

Data: 2026-11-23 | Status: **pronto e verificado no Chrome com dados reais (desktop); mobile tem um problema antigo no cabeçalho, fora do escopo (ver "Achado no mobile").**

## Problema
Os dashboards desenhavam KPIs e gráficos direto, sem olhar o estado da carga:
- **Backup, Windows e Logs Gerais:** durante a carga apareciam zeros (e, em Logs Gerais, "Nenhum log geral registrado ainda", que é falso). O subtítulo só olhava a carga **estática** (`progress`), nunca a da API; o erro da API era ignorado (só `progress.error` era mostrado), então uma falha da API virava zeros.
- **Site:** já tinha "carregando", mas toda atualização (a cada 5 min e no "Recarregar") **escondia o painel inteiro** até a resposta chegar; o erro era um texto solto, sem "Tentar de novo".

## O que mudou
1. **`components/DataGate.tsx` (novo):** recebe o estado já resolvido (`getDataStatus`) e escolhe o que mostrar:
   - carregando **sem nenhum registro** → só o spinner "Carregando registros…" (zeros seriam mentira);
   - carregando **com registros parciais** → aviso "totais ainda incompletos" (`LoadingNotice`) + conteúdo;
   - erro → banner com "Tentar de novo" (`reload`); se já havia registros, o conteúdo parcial continua visível;
   - pronto e vazio → `emptyMessage` (usado em Logs Gerais, com o texto de antes); sem `emptyMessage`, mostra o conteúdo (zeros reais);
   - `aria-busy` enquanto carrega.
2. **`lib/dataStatus.ts`:** nova `describeStatus(status, hasData, readyText)` para o subtítulo: "Carregando… N%", "Não foi possível carregar os registros" (erro sem dados) ou o texto normal.
3. **`BackupDashboard`, `WindowsDashboard`, `AppDashboard`:** usam `getDataStatus` + `DataGate` + `describeStatus`. Saiu o "(x/y arquivos)" do subtítulo (a barra de progresso do cabeçalho continua).
4. **`SiteDashboard`:** `ErrorState` com "Tentar de novo" e `LoadingState`; o painel **fica na tela** durante a atualização, com "Atualizando…" no subtítulo. "Dados deste site" = `availability[0].monitored_url_id === selectedUrlId`, para não mostrar o site anterior ao trocar de site (se o registro vier com `monitored_url_id` nulo, cai no comportamento antigo: esconde durante a carga). O retry usa `refresh`, ou `refreshMonitoredUrls` quando ainda não há site selecionado (nesse caso o `refresh` não faz nada).

Arquivos: `src/components/DataGate.tsx` (novo), `src/lib/dataStatus.ts`, `src/features/{backup/BackupDashboard,windows-event/WindowsDashboard,app-logs/AppDashboard,site/SiteDashboard}.tsx`. Nenhum é ignorado pelo git, não há cópia manual para o servidor 201.

Camadas: `DataGate` só **apresenta**; quem decide carregando/erro/pronto continua sendo a camada de dados (`getDataStatus` → `resolveDataState`, sobre o `useProgressiveLogs`, que não foi tocado).

## Como testar
1. **Carga:** F5 num dashboard (Logs Gerais é o mais visível): deve aparecer o spinner "Carregando registros…" em vez de zeros, e o subtítulo "Carregando… N%"; depois os KPIs. Nunca "Nenhum log geral registrado" durante a carga.
2. **Erro da API:** parar o Flask (ou bloquear `localhost:8765` no DevTools) e dar F5: banner "Erro ao carregar logs: …" com "Tentar de novo"; subtítulo "Não foi possível carregar os registros". Religar e clicar em "Tentar de novo": deve carregar.
3. **Site:** clicar "Recarregar": o painel não some, o subtítulo mostra "Atualizando…" e depois "Atualizado às HH:MM". Trocar de site no seletor: mostra o spinner (não os números do site anterior).

## Verificado
- `tsc --noEmit` e `eslint` nos arquivos alterados: sem erros.
- 19 testes de renderização no Node (React no servidor, TSX transpilado com o próprio `typescript`) do `DataGate` e do `describeStatus`: os seis estados acima, incluindo "carregando sem dados não mostra conteúdo nem mensagem de vazio" e "erro sem dados não mostra o vazio falso".

## Verificado no Chrome (dados reais, iframe same-origin; 2026-11-23)
- **Logs Gerais, Backup e Windows (carga completa, amostragem a cada ~40 ms):** preloader da sessão → spinner "Carregando registros…" **sem nenhum KPI** (subtítulo "Carregando… 0%") → aviso "totais ainda incompletos" + KPIs parciais → pronto (ex.: "7.081 logs gerais", "75 logs de backup", "1.371 eventos carregados"). Em nenhum instante apareceu "Nenhum log geral registrado" nem zeros de carga. Único "0" visto: um KPI real e parcial de Windows durante a carga, já com o aviso.
- **Erro da API (chamadas `/api/` derrubadas no iframe + "Recarregar"):** banner "Erro ao carregar logs: Erro ao carregar dados da API" com "Tentar de novo", subtítulo "Não foi possível carregar os registros", sem KPIs e sem mensagem de vazio falsa. Ao restaurar a rede e clicar "Tentar de novo": spinner → aviso parcial → pronto, com KPIs reais (total 7.081, igual ao subtítulo).
- **Site (chamadas `/api/site/` atrasadas 900 ms para poder observar):** "Recarregar" → subtítulo "Atualizando…" com o painel **mantido**, depois "Atualizado às HH:MM"; **trocar de site** → spinner e painel do site anterior some, depois volta. (Sem o atraso o refresh local é rápido demais para amostrar.)
- `tsc --noEmit` e `eslint` nos arquivos alterados sem erros; 19 testes de renderização no Node do `DataGate` e do `describeStatus`.

## Achado no mobile (390 px), anterior a esta mudança — **corrigido** em `2026-11-23-pageheader-quebra-de-linha-mobile.md`
Em Windows e Logs Gerais (provavelmente em todas as páginas com o mesmo cabeçalho), o `<main>` rola na horizontal ~110–120 px: a linha de ações do `PageHeader` (tema + notificações + "Carregar Logs" + "Recarregar" + "Ver Registros →") soma 366 px e não quebra linha, então "Ver Registros →" fica cortado à direita. É igual em todos os estados (inclusive pronto), logo não vem do `DataGate`. O overflow do **documento** é 0, e foi isso que eu medi na rodada anterior ao afirmar "sem rolagem horizontal"; o overflow do `<main>` eu não tinha medido. Correção provável: quebra de linha na linha de ações (`flexWrap`) no `PageHeader`, que é compartilhado, por isso não mexi sem você pedir.

## Não verificado
- Tema claro e leitor de tela (`aria-busy`, `role=status/alert`).
- Mobile do `DataGate` além de: spinner e aviso aparecem em 390 px e o `h1` não fica sob o botão de menu.
- Site com `monitored_url_id` nulo (cai no comportamento antigo) e com a lista de sites vazia (achado 1 abaixo).

## Achados no `useSiteData` (camada de dados, é sua; não alterei)
1. **Spinner eterno sem sites cadastrados:** com `monitored-urls` vazio, `selectedUrlId` fica `null`, `fetchData` sai cedo e `loading` (inicial `true`) nunca vira `false`.
2. **Erro que não limpa:** se `fetchMonitoredUrls` falhar e depois der certo, `error` só é limpo porque o `fetchData` seguinte faz `setError(null)`; com lista vazia isso não acontece.
3. `fetchData` depende de `selectedSite`, que é um objeto novo a cada render do `find`: pode recriar o intervalo de 5 min mais vezes que o necessário (não medi).

## Pendências
- Mesmo padrão ainda não aplicado às listas de Site (`SiteList`, que usa o mesmo hook) nem à Home/listas, que já usam `getDataStatus` com markup próprio (poderiam usar `DataGate`).
- Continuam abertos os itens do doc `2026-11-19-listas-carregamento-foco-e-mobile.md` (`totalRecords` sempre 0, prioridade de carga do app na Home, `pulse` indefinido, etc.).
