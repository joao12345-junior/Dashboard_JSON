# UniFi: página Rede (eventos)

Data: 2026-11-23

## Contexto
A fase 1 do UniFi (coletor syslog) já grava eventos reais em `optsislog.network_events`. Faltava uma tela para consultá-los sem abrir o banco.

## O que mudou
- **API** `GET /api/network/events` (`api/routes/network_events.py`, protegida por `@require_auth`):
  - `limit` (padrão 200, máximo 500), `before_id` (paginação por cursor), `min_severity`, `q` (busca em `name` e em `extension->>'msg'`, com escape de `%`, `_` e `\`).
  - Resposta: `{ "events": [...], "has_more": bool }`. Não devolve `raw` (campo grande); erros devolvem mensagem genérica, sem `str(e)`.
  - Blueprint registrado em `api/app.py`.
- **Front** (`src/features/network/`): `NetworkEventsPage` (busca com debounce de 350 ms, filtro de gravidade, tabela com cabeçalho fixo, "Carregar mais"), `NetworkEventDetailsModal` (campos, `msg` completa, extension em JSON, Copiar), `SeverityBadge`, `severity.ts` (>=7 alta, >=4 média, resto baixa), `formatEventTime.ts` (pt-BR, America/Sao_Paulo), `hooks/useNetworkEvents.ts` (descarta respostas antigas com contador de requisição).
- Menu: grupo "Rede" > "Eventos" em `Sidebar.tsx`; rota `network-events` em `App.tsx`.
- `components/Error.tsx`: `ErrorState` ganhou prop opcional `title` (padrão continua "Erro ao carregar logs").

## Segunda rodada: visual de Logs Gerais
- Menu: o item agora é **Rede** (ícone de rede), no lugar de "Eventos".
- Página reescrita no padrão da lista de Logs Gerais: chips Todos os dias / Hoje / Ontem e de gravidade, busca, "Quebrar linhas", "Exportar CSV" (o que está carregado), lista agrupada por dia (cabeçalho de colunas e de dia fixos, totais por dia, faixa lateral e fundo por gravidade, termo buscado destacado, clique no nome do evento filtra a busca). Componente novo `NetworkEventFeed.tsx`; `Highlighted` passou a ser exportado de `AppLogFeed.tsx`.
- API: novo parâmetro `date=AAAA-MM-DD` (dia inteiro em horário de Brasília, usando `event_time` ou, na falta, `created_at`). Os chips Hoje/Ontem usam o dia de Brasília.
- Os totais por dia contam só o que já foi carregado.
- Fora desta rodada: agrupar repetidos e pausar (não fazem sentido sem atualização ao vivo) e ← → no modal.

## Como testar
1. Reiniciar o Flask local (a rota é nova; sem isso o front mostra "Failed to fetch" porque o preflight OPTIONS dá 404).
2. Abrir Rede > Eventos: devem aparecer "Test Syslog" e "Admin Made Config Changes".
3. Buscar por parte da `msg`, filtrar por gravidade, clicar numa linha (modal), "Carregar mais" quando houver mais de 200.

Verificado: `tsc -b --noEmit` e `eslint` limpos; layout em tela cheia e título do erro conferidos no Chrome. A listagem com dados reais ainda não foi vista (depende do Flask local reiniciado).

## Deploy no 201
`git pull` + `update.ps1` (reinicia o serviço `LogDash`, que carrega a rota nova). `LogDashSyslog` não precisa reiniciar: o coletor não mudou.

## Pendências
- Fase 2 (clientes conectados, dispositivos, alertas via API local do UCG) e fase 3 (mapa de topologia).
