# Estados de carregamento nas listas, foco nos filtros e mobile (2026-11-19)

Continuação de `2026-11-19-preloader-e-estados-de-carregamento.md`.

## O que mudou
- **`lib/dataStatus.ts`** (`getDataStatus`): junta `resolveDataState` + percentual + erro (estático ou API) num lugar só. Home, Logs Gerais, **Windows** e **Backup** usam. (Lê o localStorage para saber se a API está habilitada, por isso fica separado de `loadStatus.ts`, que é puro e testado.)
- **Listas de Windows e Backup** (e Logs Gerais, para ficar igual): subtítulo "Carregando… N%" (antes mostrava "N de M registros" crescendo, ou arquivos da fonte estática); `LogTable` mostra "Carregando registros…" no vazio enquanto carrega (antes: "Nenhum log encontrado para os filtros aplicados"); erro da API aparece com "Tentar de novo" (antes só o erro da fonte estática aparecia).
- **`loadingPercent`**: sem nenhuma fonte carregando devolve 0. Achei medindo: no primeiro instante o subtítulo dizia "Carregando… 100%" (a fonte estática terminava antes da API começar).
- **Foco nos filtros:** o `inputStyle` compartilhado tinha `outline: none` inline, então os filtros de Windows, Backup, Settings e Login não mostravam onde estava o foco. Removido, e `style.css` ganhou uma regra global `input/select/textarea:focus-visible`.
- **Rótulos:** filtros de Windows ganharam `aria-label` (só tinham placeholder; data e criticidade não tinham nada); `LogFilter` (Backup) associou `<label htmlFor>` aos campos com `useId` (os labels existiam mas não estavam ligados). Botões "Limpar" ganharam o anel de foco (`ld-chip`).
- **Mobile, todas as páginas:** `padding-top: 64px` no `<main>` (o botão de menu fixo cobria o título) em Dashboards (Backup, Windows, Logs Gerais, Site), listas (Backup, Windows, Site) e Configurações; `minWidth: 0` nas listas de Windows e Backup (mesmo problema de largura flex que já tinha sido corrigido na Home e em Logs Gerais).

## Verificação
- `tsc` e `eslint` (src inteiro) limpos; `loadStatus` testado em Node (inclui o caso do "100%" falso).
- Chrome, mobile (iframe 390px), **as 10 páginas**: sem sobreposição entre o botão de menu e o título; sem rolagem horizontal do documento.
- Chrome, desktop, recarga real amostrada a cada 60 ms em Windows e Backup: 0 instantes de "Nenhum log encontrado" durante a carga; "Carregando registros…" no vazio; subtítulo vai de 0% a pronto ("1.339 de 1.339", "67 de 67"); todos os controles dos filtros têm nome acessível (0 sem nome); campo focado mostra contorno de 2 px.
- Drawer do menu no mobile: abre (fundo escuro aparece) e **fecha ao navegar** (fundo some, página muda). A pendência antiga "drawer não fecha ao navegar" **não se confirmou**; o estado fecha. A animação de deslize em si eu não consegui observar (o `transform` lido ficou em -260px nas duas situações no iframe), então o visual da transição não está verificado.
- **Não verificado:** screenshots (ferramenta instável; usei DOM), leitor de tela, tema claro das listas, Login/Settings com o novo foco dos campos, dashboards durante a carga.

## Pendências
- **Dashboards** (Backup/Windows/Logs Gerais/Site) ainda mostram zeros/vazio durante a carga, sem "carregando" (só a barra no topo).
- A busca por mensagem em Logs Gerais ignora o campo `detalhes`; o modal de detalhes não prende o Tab; alvos de toque dos links programa/classe < 24 px. (Backlog de acessibilidade da lista, não mexi.)
