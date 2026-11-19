# 2026-11-19 — Revisão final da lista de Logs Gerais (defeitos corrigidos)

Rodada de revisão crítica (código + uso real no Chrome: desktop, mobile em iframe de 390px, tema claro). Foco em **corrigir defeitos**, não em recursos novos.

## Defeitos encontrados e corrigidos
| # | Defeito | Correção |
|---|---|---|
| 1 | **Mobile: a lista ficava com 0px de altura** (invisível). `main` tinha `overflow:hidden` e o feed era `flex:1; minHeight:0`; cabeçalho + toolbar + filtros ocupavam a tela. | Feed com `minHeight: 360` no mobile; `main` rola (`overflowY:auto`) no mobile. |
| 2 | **Mobile: filtros empilhados (6 campos) tomavam a tela inteira.** | Botão **Filtros ▾ (n)** recolhe/abre o painel no mobile; mostra quantos estão ativos. |
| 3 | **Só linhas com `detalhes` abriam o modal** (medido: 7 de 67). O contexto "ao redor", copiar e navegação ficavam inacessíveis nos registros mais comuns. | Toda linha abre o modal. O ícone de arquivo continua indicando "tem detalhes". |
| 4 | Modal não movia o foco ao abrir nem devolvia ao fechar (teclado/leitor de tela). | `Modal.tsx` (compartilhado): foca o diálogo ao abrir (se nada dentro já tem foco) e devolve o foco ao fechar, com `preventScroll`. |
| 5 | Ao navegar ← →, o modal mantinha a rolagem do registro anterior. | Volta ao topo a cada troca de registro. |
| 6 | A linha aberta não ficava marcada e a lista não acompanhava a navegação. | Linha com fundo destacado (`aria-current`) e `scrollIntoView` até ela (com folga para os cabeçalhos sticky). |
| 7 | Filtro de mensagem não ignorava espaços nas pontas, mas o destaque sim (`"falha "` filtrava diferente do que destacava). | Filtro usa o mesmo termo (`trim`). |
| 8 | Cabeçalho da página espremia o título em 3 linhas no mobile; barra ← → do modal quebrava em 2 linhas. | `PageHeader wrap`; rótulos do modal "← Novo / Antigo →" e contador "N de TOTAL". |
| 9 | Mobile: o botão de menu (hambúrguer, fixo no canto) cobria o início do título. | `padding-top: 64px` no mobile **só nesta página** (ver pendências). |

## Arquivos
- `src/components/Modal.tsx` — **compartilhado** com outras páginas. O arquivo original tem terminação mista (linha 1 LF, resto CRLF); foi preservado. Ver "Atenção".
- `src/features/app-logs/AppList.tsx`, `components/AppLogFeed.tsx`, `components/AppLogDetailsModal.tsx`.
- Nenhum arquivo ignorado pelo git foi tocado (nada para copiar manualmente ao servidor 201).

## Validação
- `tsc --noEmit` e `eslint` sem erros.
- Chrome, mobile (iframe 390px): feed com 359px de altura (antes 0); filtros abrem/fecham; linha sem detalhes abre o modal; foco vai para o diálogo; linha marcada.
- Chrome, desktop: abrir com Enter → foco no diálogo; 40× → leva ao registro 44 de 5.904 com a linha selecionada visível; Esc fecha e devolve o foco a uma linha.
- Tema claro: lista, chips, filtros e cabeçalho legíveis.

## Atenção
- **Teste manual recomendado:** outros modais que usam `Modal.tsx` (Configurações: formulário de URL monitorada). A mudança só foca o diálogo quando nenhum campo dele já tem foco e devolve o foco ao fechar; não foi testada fora da lista.
- Não verificado: botão "Copiar log" (a automação não tem permissão de clipboard).
- Não há "prisão de Tab" no modal (Tab pode sair para a página atrás). Ficou como melhoria possível.

## Pendências (fora da lista)
- O hambúrguer (`Sidebar`, `position: fixed; top:16; left:16`) cobre o início do conteúdo de **todas** as páginas no mobile (Home, Dashboards…). Correção ideal é global (ex.: padding-top do `main` em `App.tsx` no mobile).
- Paginação no mobile: "← Anterior" quebra em duas linhas.
- A busca por mensagem não olha `detalhes`/`classe`; buscar um id que só está no JSON não acha. Mudar isso é decisão de produto (o destaque só aparece na mensagem).
