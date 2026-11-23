# PageHeader: cabeçalho quebra linha no mobile (overflow horizontal de ~120 px)

Data: 2026-11-23 | Status: **corrigido e verificado no Chrome (390 px e 1200 px, 10 páginas).**

## Problema
Em 390 px o `<main>` rolava na horizontal ~110–120 px: a linha de ações do `PageHeader` (tema + notificações + "Carregar Logs" + "Recarregar" + "Ver Registros →") somava ~366 px, não quebrava linha, e o último botão ficava cortado à direita. Achado na rodada dos dashboards (`2026-11-23-dashboards-estado-de-carregamento.md`). Na rodada de mobile anterior eu tinha afirmado "sem rolagem horizontal", mas só havia medido o overflow do **documento** (0); o do `<main>` não.

## O que mudou (`src/components/PageHeader.tsx`)
- `wrap` passou a ter padrão **`true`** (antes `false`; só Home, Logs Gerais e Configurações passavam `wrap`). Com `wrap`, o contêiner externo já quebrava (`flexWrap` + `gap: 12`).
- A linha de ações agora também tem `flexWrap: "wrap"`. Sem isso ela nunca encolhia, então o contêiner externo quebrava, mas a própria linha continuava com 366 px.
- Efeito: onde cabe (desktop), o layout é o mesmo; em tela estreita os botões descem para baixo do título e, se ainda faltar espaço, quebram em mais de uma linha.
- `wrap={false}` continua disponível para forçar uma linha. Os três `wrap` explícitos (Home, Logs Gerais, Configurações) ficaram redundantes e não foram removidos (sem efeito).

Arquivo alterado: `src/components/PageHeader.tsx` (compartilhado pelas 10 páginas). Sem cópia manual para o servidor 201.

## Verificado (Chrome, iframe same-origin)
- **390 px, 10 páginas** (home, 3 dashboards de logs, 3 listas, site-dashboard, site-list, settings): `main.scrollWidth - main.clientWidth` = **0** em todas (antes: 110–120 em Windows e Logs Gerais); título a 64 px do topo (não fica sob o botão de menu); botões ~34 px abaixo do título.
- **1200 px** (Windows, Lista de Logs Gerais, Site, Configurações, Home): botões na **mesma linha** do título (topo do botão acima da base do título), overflow 0.
- `tsc --noEmit` e `eslint` sem erros.

## Não verificado
- Larguras intermediárias (ex.: 768 px) e tema claro.
- Páginas com muitos controles extras (Site tem o seletor de site em `leadingControls`) foram medidas em 390 px, mas só olhei overflow e posição do título, não o visual.
