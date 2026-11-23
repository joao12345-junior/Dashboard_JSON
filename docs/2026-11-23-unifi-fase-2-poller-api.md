# UniFi fase 2: poller da API local (dispositivos e clientes)

Data: 2026-11-23

## Contexto
A fase 1 recebe eventos por syslog. Faltava o estado atual da rede: quais dispositivos existem e quem está conectado. Isso só sai da API local do UCG (Network 11.0.104), com uma chave criada em Network > Integrations.

## O que a sonda mostrou (`collector/unifi_probe.py`, só GET)
- Integration API (`/proxy/network/integration/v1`, header `X-API-KEY`): `info`, `sites`, `devices`, `devices/{id}/statistics/latest` e `clients` respondem 200. Os clientes dela trazem só nome, MAC, tipo (WIRELESS/WIRED), `connectedAt` e `uplinkDeviceId`.
- API legada (`/proxy/network/api/s/default`): `stat/device` e `stat/sta` respondem 200 com a mesma chave; `stat/sta` traz IP, hostname, nota, rede, AP/switch de origem e tráfego.
- `stat/alarm` e `stat/event` devolvem 404 nessa versão. Os alertas já chegam pelo syslog (fase 1), na página Rede.

Decisão: dispositivos pela Integration API (estável, com CPU/memória/uptime); clientes pelo `stat/sta` legado (traz o que a integração não traz). `stat/device` fica para a fase 3 (topologia: portas e o que está ligado em cada uma).

## O que mudou
- **Migration 014**: `optsislog.network_devices` e `optsislog.network_clients` (último estado conhecido, uma linha por MAC).
- **`api/collector/`** (Ports and Adapters):
  - `unifi_mapper.py`: tradução pura das respostas para `NetworkDevice`/`NetworkClient` (dataclasses frozen/slots). Campo ausente ou de tipo inesperado vira `None`.
  - `unifi_source.py`: porta `UnifiSource` + adaptador `UnifiHttpSource` (requests, só GET, site em cache, paginação limit/offset, uma falha de estatísticas não derruba o ciclo).
  - `state_sinks.py`: porta `StateSink` + `PostgresStateSink` (uma transação por ciclo: upsert de dispositivos e clientes, remove dispositivo que sumiu, marca `connected=false` + `disconnected_at` em quem sumiu, apaga cliente sem atividade há 30 dias).
  - `unifi_poller.py`: ciclo a cada `UNIFI_POLL_SECONDS` (padrão 60, mínimo 15). **Se a leitura falhar, nada é gravado** (um ciclo ruim não pode virar "todo mundo desconectou"); após falhas seguidas o intervalo dobra até 5 min.
  - `db_config.py`: configuração do banco compartilhada; `sinks.py` passou a usá-la (sem mudança de comportamento).
- **API Flask** (`routes/network_state.py`): `GET /api/network/devices` e `GET /api/network/clients` (`status=connected|disconnected|all`, `q`, `limit`), ambos com `@require_auth`.
- **`install-unifi-poller.ps1`** (gitignored; copiar à mão para o 201): serviço NSSM `LogDashUnifiPoller`, log `unifi-poller.log`. A chave fica no `api/.env`, não no NSSM.
- **Testes**: `collector/test_unifi_poller.py` (14 testes; com os 11 do syslog, 25 passando).

## Configuração (`api/.env` no 201)
```
UNIFI_HOST=https://192.168.16.1
UNIFI_API_KEY=<chave>
# opcionais: UNIFI_POLL_SECONDS=60, UNIFI_VERIFY_TLS=true
```

## Segurança
- A chave de API pode ter poder de escrita (a conta usada tem acesso total, ver abaixo); o código só faz GET e há teste garantindo isso na fonte HTTP.
- A chave vive só no `api/.env` do 201 (fora do git). O TLS não é validado por padrão (certificado autoassinado, tráfego só da LAN); `UNIFI_VERIFY_TLS=true` liga a validação.
- O campo "nota" dos clientes (UniFi) pode conter nome de pessoa; fica visível para quem acessa o LogDash.
- Tentativa de usar uma conta somente leitura: a página Integrations não aparece nem com Network "Total"; por isso a chave foi criada com a conta principal.

## Front (Rede)
- Menu: grupo **Rede** com Clientes, Dispositivos e Eventos.
- **Rede — Clientes** (`NetworkClientsPage`): chips Conectados/Desconectados/Todos e Wi-Fi/cabo, busca (nome, nota, IP, MAC, fabricante) no servidor, lista no padrão de Logs Gerais (cliente, IP, conexão com AP e sinal, rede, estado e há quanto tempo), Exportar CSV.
- **Rede — Dispositivos** (`NetworkDevicesPage`): um cartão por dispositivo com estado, CPU, memória, uptime, firmware (e aviso de atualização), tráfego do uplink e último sinal.
- As duas atualizam sozinhas a cada 30 s (só com a aba visível; falha mantém os últimos dados) e mostram um aviso se o último ciclo do coletor tiver mais de 3 min (`StaleDataBanner`).
- Verificado no Chrome com os dados reais (16 clientes, 2 dispositivos). Não há modal de detalhes nem versão mobile conferida em 390 px.

## Como aplicar
1. Commit/push; no 201 `update.ps1` (reinicia `LogDash`, que carrega as rotas novas).
2. Migration: `python api\migrations\run_migration.py` (como nas anteriores).
3. Copiar `install-unifi-poller.ps1` para `C:\Optare\LogDash` e rodar como administrador.
4. Conferir `unifi-poller.log`: "Ciclo ok: N dispositivo(s), M cliente(s)."

Não testado contra o banco real nem em PowerShell: o SQL do sink e das rotas e o instalador rodam pela primeira vez no 201.

## Pendências
- Fase 3: mapa de topologia (`stat/device`).
- Histórico de métricas dos dispositivos (hoje só o último valor).

## Melhorias nas páginas Rede > Clientes e Dispositivos

- **Clientes**: cabeçalhos clicáveis (Cliente, IP, Conexão, Estado) alternam crescente/decrescente (`sortClients.ts`; IP compara numericamente, sem IP vai ao fim); chips Wi-Fi/Cabo mostram contagem; clicar na linha (ou no nome, via teclado) abre o modal `NetworkClientDetailsModal` com todos os dados; sinal ≤ -75 dBm aparece como "sinal fraco" (`isWeakSignal` em `format.ts`).
- **Dispositivos**: KPIs (online/total, clientes conectados, atualizações de firmware), campo "Clientes" por card (contagem por `uplink_mac`), gateway primeiro e offline logo depois, borda avermelhada quando offline.
- Só front-end: sem migração nem reinício de serviço; basta `update.ps1` no servidor 201.
