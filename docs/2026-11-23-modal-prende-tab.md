# Modal: Tab preso dentro do diálogo

Data: 2026-11-23 | Status: **corrigido e verificado no Chrome com teclas reais (modal de detalhes de Logs Gerais).**

## Problema
O `Modal` compartilhado já tinha `role="dialog"`, `aria-modal`, foco ao abrir, devolução do foco ao fechar e Esc, mas **não prendia o Tab**: pelo teclado, do último botão o foco saía para a página por trás (que continua clicável/focável, `aria-modal` sozinho não impede isso). Pendência da auditoria ("o modal de detalhes não prende o Tab").

## O que mudou (`src/components/Modal.tsx`)
- Novo `trapTab` no `onKeyDown` do diálogo: em `Tab` do **último** elemento focável, vai ao **primeiro**; em `Shift+Tab` do **primeiro** (ou do próprio diálogo, que recebe o foco ao abrir) vai ao **último**; sem nenhum focável, mantém o foco no diálogo. No meio do caminho o navegador cuida do Tab normalmente (o código só intervém nas bordas).
- Focáveis = `a[href]`, `button`, `input`, `select`, `textarea` não desabilitados, `[tabindex]` diferente de `-1`, e só os visíveis (`getClientRects().length > 0`).
- Escolhi o `keydown` em vez de `inert` no `#root`: `inert` tiraria os toasts (`role="status"`) da árvore de acessibilidade enquanto o modal está aberto.
- O arquivo tem finais de linha **mistos** (CRLF e LF); a edição respeitou o de cada trecho. O `git diff --stat` pode mostrar muitas linhas por causa disso/`autocrlf`, não por mudança de conteúdo.

Os dois modais do app usam este componente: detalhes do log (`AppLogDetailsModal`) e `monitoredUrlFormModal` (Configurações). Sem cópia manual para o servidor 201.

## Verificado (Chrome, teclas Tab/Shift+Tab/Esc/Enter reais)
No modal de detalhes (8 elementos focáveis: Fechar, Antigo →, Copiar log e 5 itens da lista "ao redor"):
- `Tab` no último → foco no primeiro (Fechar).
- `Shift+Tab` no primeiro → foco no último.
- 10 `Tab` a partir do primeiro → índice 2, igual a `10 mod 8` (percurso normal + volta), sempre dentro do diálogo.
- Foco no botão da linha + `Enter` → modal abre com o foco no diálogo; `Esc` fecha e o foco **volta para o mesmo botão**.
- `tsc --noEmit` e `eslint` sem erros.

## Não verificado
- O modal de Configurações (`monitoredUrlFormModal`, com campos de formulário): mesma lógica, não testado na tela.
- Leitor de tela; modal sem nenhum focável (ramo `items.length === 0`, só por leitura do código).
- Um teste anterior, abrindo o modal com `.click()` via script, não devolveu o foco: artefato do teste (clique programático não foca o botão, então não havia "anterior"); com Enter real funcionou.

## Pendências relacionadas
- Links programa/classe com alvo de toque < 24 px.
- Busca de mensagem em Logs Gerais ignora `detalhes`.
