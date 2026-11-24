# Clientes de VPN no LogDash (24/11/2026)

## Problema
Os 8 usuários OpenVPN (rede ServOvpn, 10.10.10.2–.9) que o UniFi mostra em Clientes > VPN não apareciam no LogDash. O probe mostrou que **não estão** em nenhum dos endpoints de clientes: Integration `/clients` (inclusive o de detalhes/visão geral da documentação v11), `stat/sta` e v2 `clients/active` devolvem os mesmos 16 (14 cabo, 2 Wi-Fi). Eles vêm de **`GET /api/s/default/stat/remoteuservpn`** (API legada, só leitura): usuário, interface (`tun1`), IP do túnel, IP público de origem, bytes, `assoc_time`, `vpn_type` (`openvpn-server`), `up`. Não têm MAC.

## Decisão
Tabela própria em vez de enfiar na `network_clients` (chave = MAC, usada por topologia, sessões e uplink): **`optsislog.network_vpn_clients`** (migração 018), chave `"<vpn_type>:<usuário>"`. O `id` do UniFi (`tun1:charles.farias:168430082`) muda com o IP do túnel, por isso não serve de chave. Consequência: duas conexões simultâneas do mesmo usuário viram uma linha.

## O que mudou
- `collector/unifi_mapper.py`: `VpnClient` e `map_vpn_client` (ignora item sem usuário ou com `up: false`).
- `collector/unifi_source.py`: `fetch_vpn_clients()` (GET; resposta sem `data` levanta exceção, para uma falha não "desconectar" todo mundo).
- `collector/state_sinks.py`: `replace_vpn_clients` (transação própria): presentes = conectados, ausentes = desconectados agora, apaga sem atividade há 30 dias.
- `collector/unifi_poller.py`: `poll_once` ficou com `_poll_wans` e `_poll_vpn`, ambos extras (falha só loga; VPN é lida mesmo se a WAN falhar).
- Rota `GET /api/network/vpn-clients?status=connected|disconnected|all`.
- Front: filtro **VPN** em Rede > Clientes (troca a lista por `VpnClientsTable`: usuário, tipo, IP na VPN, conectou de, tráfego, estado; busca e CSV); no Painel, contador VPN e cartão "VPN" com quem está conectado. Regras puras em `src/features/network/vpnClients.ts` (testadas).

## Testes
Python: 4 do mapeador (com o item real do probe), 3 do poller (mesmo horário do ciclo; falha de leitura não grava; VPN lida mesmo com WAN falhando). Front: `vpnClients.test.ts`.

## Deploy (201)
1. `update.ps1` (reinicia LogDash, LogDashSyslog e LogDashUnifiPoller).
2. `python api\migrations\run_migration.py` (018).
3. Reiniciar `LogDashUnifiPoller` se a migração rodou depois do update.
4. Conferir: `SELECT username, tunnel_ip, connected, last_seen_at FROM optsislog.network_vpn_clients ORDER BY username;`

## Aplicativos (pendente)
`traffic-flow-latest-statistics` só traz `application_id`/`category_id`. Os nomes estão em `GET /integration/v1/dpi/applications` e `/dpi/categories` (documentação oficial). Falta confirmar se o id bate direto ou combinado com a categoria: `python -m collector.unifi_probe --dpi`.
