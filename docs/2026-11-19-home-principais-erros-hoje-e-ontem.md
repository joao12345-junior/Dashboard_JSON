# 2026-11-19 — Home: "Principais erros — hoje e ontem"

## Problema
A Home só tinha totais gerais (KPIs sem recorte de dia) e dois feeds planos com todos os eventos críticos/avisos. Não dava para responder rápido: *o que está quebrando hoje? o que é novo? é pior que ontem?*

## O que mudou
Novo painel logo abaixo dos KPIs, com **hoje e ontem lado a lado** (empilhados no mobile), juntando **Backup, Windows Event e Logs Gerais**:
- **Agrupamento por "mesmo erro":** origem + mensagem com os números ignorados (`maskNumbers`), então "chamado 142" e "chamado 143" viram um grupo "×2". A mensagem exibida é a da ocorrência mais recente.
- Cada grupo mostra: contagem (`×N`), mensagem (2 linhas), fonte (Backup/Windows/App), origem (`programa › classe`, provider do Windows ou "Backup"), hora da última ocorrência.
- **NOVO** (só na coluna de hoje): o grupo não apareceu ontem. Nos demais, "ontem ×N" / "hoje ×N" mostra quantas vezes ocorreu no outro dia.
- Cabeçalho de cada dia: total de erros e total por fonte. Em "hoje" aparece também **"ontem até HH:MM: N"**: hoje é um dia em andamento, então comparar com o total do dia inteiro de ontem seria injusto.
- Mostra 6 grupos por dia, com "Ver todos os N tipos de erro".
- **Clique no grupo abre a lista certa já filtrada** (reseta os filtros antes):
  - App: dia, programa, classe e tipo "erro" (testado: o grupo ×3 abriu exatamente 3 linhas);
  - Windows: dia + criticidade "High";
  - Backup: dia.
- "Hoje" e "ontem" se atualizam sozinhos (relógio reavaliado a cada minuto), então a página aberta de um dia para o outro não fica com o dia errado.

## Arquivos
- Novos: `src/lib/logSeverity.ts` (`isCriticalLog`), `src/lib/errorGroups.ts` (lógica pura), `src/features/home/useDailyErrors.ts`, `src/features/home/components/DailyErrorsPanel.tsx`.
- Alterados: `src/features/home/HomePage.tsx`; `src/features/home/usehomeStats.ts` (CRLF preservado) passa a usar `isCriticalLog` em vez de uma cópia da mesma regra (uma só definição de "erro crítico" para KPIs e painel).
- Nenhum arquivo ignorado pelo git foi tocado (nada para copiar manualmente ao servidor 201).

## Correções de layout feitas junto (Home, mobile)
- A `main` da Home é uma coluna flex de altura fixa: cartões com `overflow: hidden` **encolhiam** e cortavam o conteúdo (já acontecia com os feeds). `flexShrink: 0` no painel novo e no grid dos feeds.
- `padding-top: 64px` no mobile para o botão de menu (Sidebar, fixo) não cobrir o título.

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- Lógica testada em Node (`errorGroups`): avisos, Windows "Medium", backup com status 0 e outros dias ficam fora; ids diferentes viram um grupo; mensagem do registro mais recente; `otherDayCount`; "ontem até a hora"; ordenação (contagem, depois mais recente).
- Chrome, dados reais: hoje 5 erros (3 grupos, todos NOVO), ontem 44 (10 grupos); clique abriu Logs Gerais com os filtros certos e 3 linhas; mobile sem corte e sem sobreposição.
- **Não verificado em tela:** clique de grupos de **Windows** e **Backup** (não há erro desses tipos hoje/ontem nos dados atuais). O código só define filtros de data/criticidade e navega; testar quando aparecer um.

## Observações
- O KPI "Erros Críticos" continua sendo o total de todos os logs carregados (não é do dia). O painel novo é o recorte de hoje/ontem.
- Datas/horas vêm como gravadas nos logs (sem conversão de fuso), como no resto do sistema.

## Pendências
- O botão de menu (hambúrguer) ainda cobre o início do conteúdo das demais páginas no mobile (Dashboards, Windows, Backup, Site, Ajustes). Correção ideal é global.
- Os dois feeds antigos (Eventos Críticos / Avisos) continuam como estavam; com o painel novo, vale decidir se ainda são necessários.

---

## Segunda rodada: acabamento (design, acessibilidade, copy)
Revisão com as skills de design (crítica, acessibilidade, copy). O painel foi reescrito por dentro, mantendo a identidade visual do dashboard (sem fonte ou cor nova).

**Informação**
- **Variação contra "ontem até a mesma hora"**: "▲ 3 a mais que ontem até 17:51" / "▼ 39 a menos…" / "= igual…". O ▲/▼ é decorativo (o texto já diz "a mais/a menos"), e o tooltip mostra os dois totais. Vermelho só quando piora.
- **Recência**: hoje mostra "último erro há 4 h 5 min"; ontem, "último erro às 16:18". Responde "ainda está quebrando?" sem abrir nada.
- **Janela do erro**: "13:45 → 13:46" quando o grupo se repetiu; "às 13:46" quando foi uma vez só.
- **Barra de participação** em cada grupo (proporcional ao mais frequente do dia), no estilo dos cartões de KPI.
- **Agrupamento mais robusto** (`maskNumbers` em `collapseRepeats.ts`): além dos dígitos, agora mascara GUID (`<id>`), `0x…` e hashes hexadecimais longos (`<hex>`). Antes, mensagens com GUID/hash diferentes nunca se juntavam. A lista de Logs Gerais usa a mesma função (agrupar repetidos). Testado em Node.

**Acessibilidade**
- Estrutura semântica: `<section aria-labelledby>`, `<h2>`, grupo por dia, lista (`<ul>`), e cada linha é um `<button>` com `aria-label` completo (contagem, mensagem, fonte/origem, horário, "Novo hoje", "abre a lista filtrada").
- Foco por teclado visível e hover (classe `.daily-error-row` em `style.css`; pseudo-classes não existem em estilo inline, e o `background` inline venceria o da folha, por isso o fundo transparente também fica na classe).
- "Mostrar mais N tipos de erro" com `aria-expanded`.
- Contraste medido (tema escuro e claro): texto pequeno ≥ 4,5:1. O selo "×N" e "Novo hoje" davam 3,9:1/3,8:1; passaram a usar o token `--destructive-text` (ver abaixo).

**Copy (pt-BR)**
- Plural correto com `plural()` (`src/lib/plural.ts`): "1 erro", "5 erros", sem "erro(s)".
- "Novo hoje" (em vez de "NOVO"), "ontem ×4" / "hoje ×4", estados vazios claros ("Nenhum erro hoje até agora." / "Nenhum erro registrado ontem.").

## Arquivos (segunda rodada)
- Novos: `src/lib/formatElapsed.ts`, `src/lib/plural.ts`.
- Alterados: `src/lib/errorGroups.ts` (`firstTime`, `lastErrorTime`), `src/lib/collapseRepeats.ts`, `src/features/home/components/DailyErrorsPanel.tsx`, `src/style.css`.
- Sem arquivos ignorados pelo git (nada a copiar para o servidor 201).

## Validação (segunda rodada)
- `tsc --noEmit` e `eslint` sem erros; `maskNumbers` e `formatElapsed` testados em Node.
- Chrome, dados reais: painel renderiza; contraste medido por script nos dois temas, sem texto abaixo de 4,5:1 (fora texto grande ≥ 22px).
- **Não verificado:** leitor de tela real (NVDA/VoiceOver); só a estrutura/rotulagem foi conferida. Captura visual do mobile desta rodada falhou por instabilidade da ferramenta de captura (a medição por DOM mostrou sem rolagem horizontal).

---

## Terceira rodada: cartões de resumo e cabeçalho da Home
Crítica: os KPIs do topo eram **totais de todos os logs carregados** ("Erros Críticos 246", "Avisos 1.693"), enquanto o painel logo abaixo mostrava o dia ("hoje 5 erros"). Dois números de "erros" sem relação aparente, e nenhum dizia se o dia está bom ou ruim. Além disso, o subtítulo da página mostrava "0 do servidor · 0 manuais" com 7 mil logs carregados pela API.

**O que mudou**
- **Cartões "Erros hoje" e "Avisos hoje"** (substituem Total de Logs, Erros Críticos e Avisos): número do dia, variação contra ontem **até a mesma hora** ("▼ 39 a menos que ontem até 18:45") e **média dos últimos 7 dias** ("20/dia"). A média só conta os dias em que o sistema registrou algo (dia sem nenhum log não é "dia sem erro"); sem histórico, o cartão diz "sem histórico nos últimos 7 dias".
- **Cartões das fontes** (Backup, Windows, Logs Gerais): total carregado + **"último registro há 4 h 27 min"** + atalho. Em monitoramento, silêncio não é saúde: se a coleta parar, o cartão mostra isso. Não há limiar nem alarme (não inventei regra de "atrasado"): só a informação.
- **Subtítulo** da página: "7.332 registros carregados · último registro há 18 min" (e "N manuais" quando houver).
- Texto da variação unificado (`describeDelta`) no painel e nos cartões.
- **Acessibilidade:** os cartões clicáveis eram `div` com `onClick` (sem teclado, sem foco). Agora são `<button>` reais (foco visível, Enter/Espaço), numa `<ul>` rotulada. Hover/foco em CSS (`.kpi-card`). O total das fontes usa a cor de texto normal (o `--chart-2` quase sumia no tema escuro); a cor ficou na borda.
- **Mobile:** o grid era `repeat(6, 1fr)` sem tratamento (6 colunas espremidas). Agora `auto-fit`: 5 cartões no desktop, 2 por linha no celular. A linha de botões do cabeçalho estourava a largura (rolagem horizontal); `wrap` aplicado.
- Uma só definição de "aviso" (`isWarningLog` em `logSeverity.ts`), como já era para "erro crítico".

## Arquivos (terceira rodada)
- Novos: `src/lib/dayOverview.ts` (resumo do dia em uma passada + "último registro"), `src/lib/formatDelta.ts`.
- Alterados: `src/lib/logSeverity.ts`, `src/features/home/HomePage.tsx`, `useDailyErrors.ts` (devolve também `overview` e `todayIso`), `usehomeStats.ts` (CRLF preservado), `components/GlobalKpiRow.tsx` (reescrito, CRLF preservado), `components/DailyErrorsPanel.tsx`, `src/style.css`.
- Sem arquivos ignorados pelo git (nada a copiar para o servidor 201).

## Validação (terceira rodada)
- `tsc --noEmit` e `eslint` sem erros; `dayOverview`/`formatDelta` testados em Node (janela de 7 dias, ontem até a hora, dia sem histórico, virada de mês/ano, dias fora da janela).
- Chrome, dados reais: erros hoje 5 (▼ 39 vs ontem até 18:45, média 20/dia), avisos hoje 29 (▲ 17, média 28/dia), Backup "há 13 h 3 min", Windows "há 4 h 27 min", Logs Gerais "há 18 min". Clique no cartão de fonte abre a lista. Contraste medido nos dois temas: texto pequeno ≥ 4,5:1; número grande ≥ 3:1.
- Mobile (iframe 390px), por DOM: 2 colunas, sem rolagem horizontal.
- **Não verificado:** captura de tela do mobile desta rodada (a ferramenta de captura travou), leitor de tela real, e o comportamento à meia-noite (virada de dia com a página aberta; a lógica usa o mesmo relógio de 1 min do painel).

## Pendências
- Os totais "todos os logs carregados" de erros/avisos saíram da Home (decisão desta rodada). Se alguém ainda precisar do acumulado, ele existe nos dashboards de cada fonte.
- ~~Os dois feeds antigos continuam como estavam~~ — refeitos na 4ª rodada (abaixo). Continuam redundantes com o painel de erros; mantê-los ou não é decisão do João.
- O toast "0 registros carregados em 0.6s" aparece no carregamento pela API e engana (já havia); entra no trabalho do preloader.

## Quarta rodada — feeds "Eventos Críticos" e "Avisos" + ordenação do painel

Pesquisa feita antes (resumo, sem copiar texto): dashboards operacionais devem responder uma pergunta por página (saúde primeiro, triagem depois, com drill-down — Grafana, OpenObserve); listas de erros do estilo Sentry mostram primeira/última ocorrência e deixam escolher a ordenação (mais frequentes / mais recentes / novos); linha de tabela clicável não deve depender de `<tr onClick>` — o ponto de entrada por teclado é um link/botão dentro da linha (Adrian Roselli, Evinced, W3C APG); e a "frescura" do dado deve aparecer junto dele, por fonte (já feito na 3ª rodada).

### O que mudou
- **Ordenação do painel "Principais erros"**: controle "Mais frequentes / Mais recentes / Novos primeiro" (`SegmentedControl`, `aria-pressed`). Lógica pura em `lib/errorGroups.ts` (`sortErrorGroups`); em "ontem", "Novos primeiro" cai em "Mais frequentes" (novo só faz sentido em hoje).
- **`CriticalEventsFeed` reescrito**:
  - uma tabela só com cabeçalho `sticky` (antes eram duas tabelas com larguras fixas que desalinhavam com a barra de rolagem);
  - a mensagem é um `<button>` real (foco visível, `aria-label` com fonte, quando e mensagem); o clique na linha inteira ficou só como conveniência do mouse (ignora botões internos e texto selecionado);
  - clicar abre a lista da fonte **já filtrada** no evento: dia dele + (app) programa/classe/tipo, (Windows) criticidade, (backup) dia. `HomePage.openList` é compartilhado com o painel de erros;
  - coluna "Quando" relativa ("Hoje 13:46", "Ontem 16:18", "12/11 03:00" — `formatWhen` em `lib/dayOverview.ts`);
  - zebra/hover em CSS (`.feed-row`), não mais por handlers de mouse; `<caption>` só para leitor de tela; região rolável focável;
  - mobile: coluna "Origem" some (o botão ainda diz a fonte no `aria-label`); espaçamento lateral menor;
  - cor de texto com contraste (`--destructive-text` / `--warning-text`); "Avisos" passou de `--chart-5` para `--chart-4`, igual ao resto do sistema;
  - estado vazio por fonte ("Nenhum evento desta fonte nesta lista."); texto antigo "Carregue arquivos de log" removido (enganava com a API);
  - rodapé usa `plural` ("50 de 246 eventos", "Ver os 196 restantes").

### Verificação
- Lógica: `formatWhen` (hoje/ontem/virada de ano/mês/ano diferente) e `sortErrorGroups` (3 ordens + não mutar) testados em Node.
- tsc e eslint limpos.
- Chrome, dados reais: 2 feeds × 50 linhas, 0 botões aninhados, cabeçalho `sticky`; clique em linha de app abriu "Logs Gerais" com programa=OptOrbia, classe=Enviados, data=hoje, só Erros (3 registros); linha do Windows abriu com data=hoje e criticidade=Média; linha de backup (27/10) abriu com data=2026-10-27; seleção de texto não dispara navegação; filtro "Backup" sem eventos mostra o estado vazio; ordenação "Mais recentes" mudou a ordem na tela.
- Contraste (texto, 140 elementos; badges ficaram de fora dessa varredura e foram medidos à parte, ver abaixo): 0 falhas em claro e escuro.
- Mobile (iframe 390px), por DOM: sem rolagem horizontal, 3 colunas, mensagem com 120px, sem corte em "Quando" nem no badge.
- **Não verificado:** leitor de tela real; captura de tela (a ferramenta segue instável, usei DOM); o botão da mensagem acionado pelo teclado de verdade (testei foco + `click()`, não a tecla Enter); "Novos primeiro" com dados em que há grupo novo e antigo misturados (só pelo teste unitário, os dados de hoje não tinham essa mistura).
- **Falha achada e corrigida nesta rodada:** o `StatusBadge` (backup) tinha contraste 3,12:1 no claro e 3,9:1 no escuro (texto de 11px na cor pura). Agora o texto usa `--destructive-text` / `--warning-text` / novo `--primary-text` (`style.css`); medido "Erro": 6,23:1 claro e 7,02:1 escuro. "Iniciado" e "Finalizado" usam a mesma fórmula, mas **não foram medidos** (não havia linhas assim nos dados). O `StatusBadge` também é usado na tabela de Logs Backup (`LogTable`), então ela ganha a correção. O `CriticalityBadge` (Windows) mediu ≥ 15:1 no wrapper; o texto interno dele não foi medido separadamente.
