# 2026-11-19 — Lista de Logs Gerais (app_logs) agrupada por dia

## Problema
A tabela plana com milhares de linhas dificultava ver de quem veio o log (programa/classe ficavam em colunas separadas e escondidas no mobile), em que dia e com que severidade.

## O que mudou
- **Novo** `features/app-logs/components/AppLogFeed.tsx`: lista agrupada por dia.
  - Cabeçalho de cada dia fixo ao rolar (sticky): "Hoje · quinta-feira, 19/11/2026" / "Ontem · …" / data completa, com total de registros, erros e avisos **do dia inteiro** (calculado sobre todos os registros filtrados, não só a página de 100).
  - Cada linha: faixa colorida lateral pela severidade, hora, badge do tipo, **origem em duas linhas (programa em destaque, classe abaixo)** e mensagem. Ícone de detalhes + clique/Enter/Espaço abre o modal quando há `detalhes`.
  - No mobile a origem e a mensagem ocupam a largura toda (antes as colunas eram escondidas).
- `AppList.tsx`: troca `LogTable` pelo `AppLogFeed`; botões rápidos **Todos os dias / Hoje / Ontem** (usam o filtro de data que já existia; data local do navegador, não UTC).
- **Novo** `lib/dayLabel.ts`: `toLocalIsoDate` e `formatDayLabel` (funções puras).
- **Novo** `features/app-logs/appTypeColors.ts`: `COLOR_BY_TIPO` saiu do `AppTypeBadge.tsx` (regra `react-refresh/only-export-components`) para ser compartilhada com a faixa lateral.

## Correções após o primeiro teste (mesmo dia)
- **Rolagem presa ao filtrar/trocar de página:** o container mantinha o scroll antigo e a lista abria no meio, com o cabeçalho do dia cortando a primeira linha. Agora a rolagem volta ao topo quando filtro ou página mudam (`resetScrollKey`).
- **Canto:** borda e arredondamento passaram para um wrapper com `overflow: hidden`; a rolagem fica no filho. Como ainda vazavam pixels da cor, a faixa de severidade deixou de ser `border-left` (quadrada) e virou uma barrinha interna (3px, afastada 4px da borda e 8px do topo/base, cantos arredondados), que não encosta no canto do container.
- **"Quinta-Feira":** o `text-transform: capitalize` do CSS maiusculizava depois do hífen; saiu, e `formatDayLabel` capitaliza só a primeira letra (e só quando não há "Hoje ·"/"Ontem ·").
- **Cabeçalho de colunas (Hora, Tipo, Origem, Mensagem)** adicionado no desktop, fixo no topo; o cabeçalho do dia gruda logo abaixo. No mobile não aparece (layout empilhado).

- **Página encolhia ao filtrar:** o `div` raiz de `AppList` é filho de um container flex (`App.tsx`) e não tinha `flex: 1`, então a largura seguia o conteúdo; com filtro (mensagens curtas, poucos registros) a tela inteira ficava estreita. Agora `flex: 1; minWidth: 0`. Conferido no Chrome com os filtros "Atendimento_bot" e "Cofre Optare". As outras páginas (`WindowsList`, `ProcessList`, etc.) têm a mesma estrutura e podem ter o mesmo problema; não foram alteradas.

## Não mudou
- Filtros, paginação (100 por página, até 30 páginas), ordenação, modal de detalhes e `AppLogMapper.columns` (continua usado em outros lugares).
- Sem virtualização: a página limita 100 linhas, então a lista não precisa dela.

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- `formatDayLabel` conferido com data fixa (hoje/ontem/outro dia, virada de mês, string vazia).
- **Não conferido visualmente**: abrir Logs Gerais e olhar desktop e mobile (largura < 768px), clicar em linha com detalhes e testar Hoje/Ontem.

## Pontos de atenção
- Hoje/Ontem comparam com a data do **navegador**; as datas dos logs são as do banco sem conversão de fuso. Com o servidor e o navegador no mesmo fuso (Brasil) bate.
- Se quiser "últimos 7 dias", precisa de um filtro de intervalo (muda `AppFilterState`); deixei de fora.

Commit sugerido: `feat: agrupa lista de logs gerais por dia com origem em destaque`
