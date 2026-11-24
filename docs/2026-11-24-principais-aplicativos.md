# Principais aplicativos no Rede > Painel (24/11/2026)

## Fonte (conferida no UCG com o probe)
- Ranking: `GET /proxy/network/v2/api/site/default/traffic-flow-latest-statistics?period=HOUR|DAY&top=10` → `top_all_traffic_by_application`, itens `{application_id, category_id, bytes}`. Só ids.
- Nomes: `GET /proxy/network/integration/v1/dpi/applications` (2.127 itens) e `/dpi/categories` (35), da documentação oficial da Network API.
- **O id do catálogo é `(category_id << 16) | application_id`.** Conferido: 140/17 → 1114252 = Sharepoint, 185/20 → SSL/TLS, 37/10 → AnyDesk (o id 37 cru no catálogo é Xfire, que estaria errado). Bate com o painel do UniFi.
- Tudo GET: a regra "o código nunca escreve no UCG" continua valendo (o DPI legado `stat/sitedpi` é POST e não é usado).

## Desenho
O poller continua sendo o único que fala com o UCG. A cada ~5 min (`TOP_APPS_INTERVAL_SECONDS`) busca os rankings de 1 h e 24 h e grava em `optsislog.network_top_apps` (migração 019), substituindo o anterior; sem histórico, porque o UniFi já calcula a janela. O catálogo de nomes fica em memória no poller e é recarregado a cada 24 h; se falhar, o ranking segue com os ids ("App 140" no front).

## Arquivos
- `collector/unifi_mapper.py`: `AppUsage`, `dpi_catalog_key`, `map_top_apps` (ordena por bytes).
- `collector/unifi_source.py`: `fetch_top_apps(period)` e cache do catálogo.
- `collector/state_sinks.py`: `replace_top_apps` (transação própria).
- `collector/unifi_poller.py`: `_poll_top_apps` (extra; falha só loga, um período não derruba o outro).
- Rota `GET /api/network/top-apps?period=hour|day`.
- Front: `components/TopAppsCard.tsx` (10 aplicativos, barra relativa ao 1º, hora da coleta), hook `useNetworkTopApps`.

## Testes
5 do mapeador (com os valores reais do probe, inclusive o caso do id 37) e 2 do poller (busca os dois períodos e espera o intervalo; falha não derruba o ciclo).

## Deploy (201)
`update.ps1` → `python api\migrations\run_migration.py` (019; e 018 se ainda não rodou) → reiniciar `LogDashUnifiPoller`. O cartão enche no primeiro ciclo depois disso.
