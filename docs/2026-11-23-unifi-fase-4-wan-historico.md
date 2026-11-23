# UniFi — Fase 4: Infraestrutura (WAN), histórico de clientes, eventos ↔ clientes, card na Home

## Backend (coletor + API)

- **Migração 015** (`api/migrations/015_network_wan_sessions.sql`):
  - `network_wan`: último estado de cada link (WAN, WAN2...): nome, provedor, IP, online, failover, disponibilidade 24 h, latência, tráfego.
  - `network_client_sessions`: um período conectado por linha (`disconnected_at` NULL = ainda conectado); índice único garante no máximo uma sessão aberta por cliente; guarda 30 dias.
- **Fonte**: `UnifiHttpSource.fetch_wans()` lê `stat/device` (gateway: blocos `wan1`/`wan2`, `uptime_stats`, `geo_info`, `last_wan_status`) e, se der, `rest/networkconf` (nomes "Unifique"/"Claro NET" e "Somente failover"). Só GET.
- **Mapper puro**: `map_wans`, `find_gateway` em `unifi_mapper.py`.
- **Regra pura do histórico**: `collector/client_sessions.py` (`plan_sessions`): abre sessão para quem chegou, fecha para quem saiu, e fecha/reabre quando o "conectou em" avança mais de 2 min entre ciclos (reconectou no meio).
- **Poller**: a WAN é extra. Se a leitura da WAN falhar, o ciclo de dispositivos/clientes continua valendo e a tabela de WAN fica com o último estado bom (log de aviso). O histórico é gravado na MESMA transação do retrato dos clientes.
- **Rotas**: `GET /api/network/wan`; `GET /api/network/clients/<mac>/sessions?days=7` (máx. 30); `GET /api/network/events?client_mac=&client_ip=` (valor do `extension` igual ao MAC/IP, comparação exata, ou MAC dentro da mensagem).
- **Probe**: `python -m collector.unifi_probe` agora imprime os blocos de WAN do gateway e o que o mapeador extrai (para conferir os campos no firmware real).
- Testes: `python -m unittest collector.test_collector collector.test_unifi_poller collector.test_network_extras` (40 testes).

### Risco conhecido

Os nomes dos campos de WAN (`wan1`, `uptime_stats.WAN.availability`, `geo_info`, `wan_load_balance_type`) vêm da API legada e **não foram vistos no probe deste UCG** (o probe anterior cortava o `stat/device`). O mapeador é tolerante (campo ausente = vazio), mas se a aba Infraestrutura aparecer sem nome/latência, rodar o probe e ajustar o mapper.

## Front

- **Topologia** ganhou as abas *Topologia | Infraestrutura*. Infraestrutura (`components/InfrastructureView.tsx`): WANs no topo (nome, papel, disponibilidade %, IP, latência; offline em vermelho e linha tracejada) → curvas até o gateway (CPU/memória) → APs/switches (clientes, tempo ativo, IP). Sem dados de WAN, mostra o aviso de migração/serviço.
- **Modal do cliente**: "Conexões nos últimos 7 dias" (faixa de 24 h por dia + total, `sessionTimeline.ts`) e "Eventos de rede deste cliente" (os 15 mais recentes; o navegador confere de novo se o evento cita o cliente, por segurança contra API antiga).
- **Eventos**: evento que cita um cliente conhecido (MAC/IP no `extension` ou MAC na mensagem) mostra "Cliente: NOME", que abre o modal (`eventClient.ts`; IP prioriza quem está conectado, pois o DHCP reaproveita endereços).
- **Ícones**: lista de Clientes usa o mesmo ícone da topologia (`topologyIcons.ts`); cards de Dispositivos mostram ícone de AP/gateway.
- **Home**: card "Rede" (`components/NetworkSummaryCard.tsx`) abaixo dos KPIs: links de internet, clientes conectados, dispositivos online, último alerta (gravidade ≥ 4) das últimas 24 h, atalhos para Topologia e Eventos.

Verificado no Chrome com dados reais (dispositivos/clientes) e com respostas simuladas para WAN, histórico e evento citando cliente (a API local ainda não tinha as rotas novas).

## Deploy no servidor 201

1. `update.ps1` (puxa o código e reinicia o serviço `LogDash`).
2. `python api\migrations\run_migration.py` (aplica a 015).
3. `Restart-Service LogDashUnifiPoller` (o `update.ps1` não reinicia o poller).
4. Opcional: `cd api; .\.venv\Scripts\python.exe -m collector.unifi_probe` para conferir os campos de WAN.

O histórico de conexões começa a contar a partir daqui; não há dados retroativos.
