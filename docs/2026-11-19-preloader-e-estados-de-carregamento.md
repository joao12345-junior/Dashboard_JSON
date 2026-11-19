# Preloader e estados de carregamento (2026-11-19)

## Por que
Medi a carga real antes de mexer (dev, localhost): refresh de sessão ~1,2 s; `/api/logs/counts` em ~1,7 s; backup ~0,3 s, Windows ~1,5 s, app (de onde vêm os "Erros hoje") só termina em ~7,6 s. Total ~6 s. Durante esse tempo o app mentia:

- a Home mostrava **"Nenhum erro hoje até agora"**, "Nenhum evento nesta categoria" e zeros — um "tudo certo" falso num painel de monitoramento;
- se a API falhasse, a Home não dizia nada (só o erro da fonte estática era mostrado);
- o toast dizia **"0 registros carregados em 0s"**: a fonte estática vazia termina na hora com 0 registros e disparava o toast, enquanto a carga real (API) nunca avisava;
- o spinner **não girava**: `@keyframes spin`, `fadeIn` e `pulse` eram usados em estilos inline e nunca foram definidos no CSS (Tailwind v4 só emite keyframes que usa);
- `--status-error` (caixa de erro do `ErrorState` e do Login) também nunca foi definido: a caixa de erro ficava sem cor.

## O que mudou
- **`lib/loadStatus.ts`** (puro, testado em Node): `resolveDataState` → `"loading" | "ready" | "error"`; `loadingPercent`; `formatLoadedToast`. Conta como "carregando" também o caso "API habilitada que ainda não começou" (sem isso a Home aparecia "pronta" por ~200 ms depois do preloader — achei isso medindo e corrigi).
- **`AppPreloader`** (`components/Loading.tsx`): tela cheia (marca + barra indeterminada + "Verificando sessão…"), `role="status"`, aparece só depois de 150 ms (CSS) para não piscar, respeita `prefers-reduced-motion`. `LoadingState` ganhou `role="status"`, label e a classe `.ld-spinner`.
- **Keyframes definidos** em `style.css` (`spin`, `fadeIn`, `ld-indeterminate`) + regras de movimento reduzido. `--status-error` virou alias de `--destructive-text`.
- **Home** (`HomePage`): `LoadingNotice` ("Carregando registros. Os totais abaixo ainda estão incompletos." + %), subtítulo "Carregando… N%", KPIs com `aria-busy`. Painel de erros e feeds mostram "Carregando registros…" / "Dados indisponíveis no momento." em vez de "Nenhum erro/evento", e escondem a variação vs ontem enquanto os dados não estão completos. Erro da API agora aparece com **"Tentar de novo"** (`ErrorState` ganhou `onRetry` e `role="alert"`).
- **Lista de Logs Gerais**: o estado vazio vira "Carregando registros…" enquanto carrega (antes: "Nenhum registro com esses filtros").
- **Toast**: só avisa a carga estática se carregou algo; avisa o fim da carga da API com contagem e tempo reais ("7.333 registros carregados em 5,7 s"); região viva (`role="status"`/`alert`) sempre presente; função de dispensa estável (antes o timer de 4 s reiniciava a cada lote carregado).
- `ProgressBar`: `role="progressbar"` com `aria-valuenow`.

## Verificação
- `tsc` e `eslint` (src inteiro) limpos; `loadStatus` testado em Node (estados, retry em andamento, API desabilitada, logs manuais, singular/plural do toast).
- Chrome, recarga real amostrada a cada 60 ms: preloader (barra animando) → Home já em "carregando" → pronto; **0 instantes** com "Nenhum erro/evento/0 registros" fora do estado pronto. Percentual avança 0→100; toast "7.333 registros carregados em 5,7 s" some sozinho.
- Falha simulada (`fetch` de `/api/logs` rejeitado, depois restaurado): alerta com "Tentar de novo", painel "Dados indisponíveis no momento.", sem falso "tudo certo"; o retry recarregou e concluiu (7.333).
- **Não verificado:** captura de tela (a ferramenta é instável; usei DOM e estilos computados), leitor de tela real, `prefers-reduced-motion` na prática (a regra existe no CSS, não emulei), tema claro do preloader, Login com `--status-error`, listas de Windows e Backup (ainda mostram o vazio sem "carregando").

## Pendências / decisões do João
- **Dado:** `apiProgress.totalRecords` nunca é preenchido em `useProgressiveLogs` (fica 0), então a UI mostra só o percentual, não "N de M". Camada de dados é sua; o `counts` já vem da API, bastaria gravar o total no estado.
- **Decisão:** `@keyframes pulse` continua indefinido, então os pontinhos do `StatusBadge` (Erro/Iniciado) nunca pulsaram. Definir faria todo ponto de erro das tabelas pulsar sem parar (ruído e custo em listas longas). Deixei como está; se quiser pulso, melhor só no "Iniciado".
- Na Home, a ordem de carga é backup → Windows → app, e os "Erros hoje" dependem do app (a fonte mais lenta). Priorizar app quando a página é a Home encurtaria a espera dos números mais importantes (mexe em `useProgressiveLogs`, fica com você).
- Aplicar o mesmo estado "carregando" nas listas de Windows e Backup.
