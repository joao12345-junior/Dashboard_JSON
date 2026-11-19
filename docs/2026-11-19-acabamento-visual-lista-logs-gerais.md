# 2026-11-19 — Lista de Logs Gerais: acabamento visual, acessibilidade e copy

Revisão da lista com as skills de design (crítica de design, revisão de acessibilidade WCAG 2.1 AA, UX copy). Foco: o que ainda atrapalhava a leitura e o uso por teclado/leitor de tela.

## Achados e o que foi feito
**Hierarquia visual (sinal x ruído)**
- Quase todo registro é INFO, e todas as linhas tinham uma faixa lateral laranja: um "muro" de faixas escondia os poucos erros. Info/debug agora têm faixa cinza discreta; erro/aviso mantêm cor forte.
- Linhas de **erro** e **aviso** ganham um tom de fundo leve (7% / 6%). Dá para achar um erro rolando a lista sem ler.
- **Hover** nas linhas (não existia, apesar do cursor de clique). É uma camada por cima do fundo (`inset box-shadow`), então não apaga o tom de erro/aviso nem a marcação da linha aberta.

**Acessibilidade**
- **Botão dentro de botão**: a linha era `role="button"` e continha os botões de programa/classe/×N. Em `role="button"` os filhos são apresentacionais, então leitores de tela não alcançavam os filtros. Agora a linha é um `<div>`; o **horário é o botão** que abre o modal (único ponto de foco da linha por teclado, com `aria-label` "Abrir registro das HH:MM:SS: origem. mensagem…"). O mouse continua abrindo pela linha toda, exceto cliques em botões internos e quando há texto selecionado (dá para selecionar e copiar sem abrir o modal).
- **Campos de filtro sem foco visível** (`outline: none` inline, sem alternativa): agora têm anel de foco (`.ld-control`). Chips e links ganham foco por classe (`.ld-chip`, `.ld-link-btn`).
- **Rótulos sem associação** (`<label>` sem `htmlFor`): agora ligados aos campos com `useId`.
- Alturas dos campos igualadas (36px): o `<select>` e o campo de data eram mais altos e os rótulos desalinhavam.
- Opções ligadas (Agrupar repetidos, Quebrar linhas) mostram "✓" além da cor (não depender só de cor).
- Ícone "Tem detalhes" com `role="img"`.
- **Contraste do texto de erro/aviso**: no tema claro, "ERRO"/"AVISO" e as contagens do cabeçalho do dia davam 2,8–3,8:1. Novos tokens `--destructive-text` e `--warning-text` (em `style.css`, misturam a cor com o `--foreground`) levam o texto a ≥ 4,5:1 nos dois temas. Fundos, faixas e ícones continuam com a cor original.

**Redundância e copy**
- Removido o filtro **"Tipo"** do painel: duplicava os chips Erros/Avisos/Info/Debug (que já têm contagem). O botão passou a **"Limpar filtros"** e fica apagado quando não há filtro ligado.
- Subtítulo: "3.000 de 5.912 encontrados (limite de exibição atingido)" virou "Mostrando os 3.000 mais recentes de 5.912 encontrados".
- Estado vazio com o que aconteceu + o que fazer + ação: "Nenhum registro com esses filtros / Amplie o período ou remova algum filtro para ver mais / [Limpar filtros]".
- Plural correto no cabeçalho do dia e no botão de repetidos ("1 registro parecido", "5 registros parecidos") com `plural()`.

## Arquivos
- Alterados: `src/features/app-logs/AppList.tsx`, `components/AppLogFeed.tsx`, `components/AppLogFilters.tsx` (CRLF preservado), `components/AppTypeBadge.tsx` (CRLF preservado), `appTypeColors.ts` (`BAR_COLOR_BY_TIPO`, `TEXT_COLOR_BY_TIPO`), `src/style.css`, `src/features/home/components/DailyErrorsPanel.tsx` (usa o token de texto).
- Sem arquivos ignorados pelo git (nada a copiar para o servidor 201).

## Como testar
1. Logs Gerais > Registros: faixas cinza nos INFO, tom avermelhado nos erros, hover em qualquer linha.
2. Teclado: Tab chega ao horário da primeira linha; Enter abre o modal; Esc fecha e o foco volta ao horário.
3. Selecione um trecho da mensagem com o mouse: o modal **não** abre. Clique na linha: abre.
4. Digite algo sem resultado: aparece o estado vazio; "Limpar filtros" restaura a lista.
5. Alterne o tema claro/escuro: "ERRO"/"AVISO" legíveis nos dois.

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- Chrome (dados reais), por script: rótulos associados (4/4), 0 `role="button"` com botão aninhado, foco do campo com anel de 2px; teclado (Enter abre, Esc fecha, foco volta ao botão), clique na linha abre, clique em programa filtra sem abrir, seleção de texto não abre; estado vazio + "Limpar filtros" restauram 100 linhas.
- Contraste medido por script nos dois temas: nenhum texto abaixo de 4,5:1 na lista e no painel da Home (fora texto grande).
- **Não verificado:** leitor de tela real; a captura de tela do mobile (a ferramenta de captura travou várias vezes, sem relação com o app: o JS e a renderização continuavam respondendo). Pelo DOM, no mobile não há rolagem horizontal e o feed mantém a altura mínima.

## Pendências
- Links de programa/classe (11–13px, empilhados) têm alvo de toque menor que 24px (WCAG 2.2 AA 2.5.8). No toque a ação principal é tocar a linha, então o impacto é baixo, mas vale aumentar o espaçamento no mobile.
- O menu lateral (gaveta) no mobile **não fecha sozinho ao navegar** para outra página. Comportamento existente, fora desta mudança.
- A busca de mensagem ainda não olha dentro de `detalhes`.
- Sem armadilha de Tab no modal (Tab pode sair para a página atrás).
