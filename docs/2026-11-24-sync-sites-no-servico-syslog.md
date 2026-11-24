# Sync de sites dentro do serviço LogDashSyslog (24/11/2026)

## Problema

O `sync_site.ps1` (Agendador de Tarefas, a cada 30 min) parou de rodar no 201. Causa mais provável (não confirmada no servidor): o script chama `http://localhost:8765`, mas a API passou a rodar só em **HTTPS** (hypercorn com certificado). Outros pontos frágeis do script: chave de sync escrita no próprio arquivo (fora do git, mas duplicada do `api/.env`) e pasta de log com o caminho da máquina de desenvolvimento.

## Decisão (João)

- O serviço **LogDashSyslog** passa a fazer as duas coisas: continua escutando o syslog do UniFi **o tempo todo** (não tem intervalo; parar perderia eventos) e roda o sync de sites **a cada 30 min**.
- O poller do UniFi (**LogDashUnifiPoller**) continua em 1 min.

## Implementação

- `api/collector/site_sync.py`: `SiteSyncJob` chama, em ordem, `POST /api/site/check`, `/api/site/sync-sentry` (corpo `{}`), `/api/site/cleanup` e `/api/logs/cleanup` com `X-Sync-Key`. Cada passo é independente (um que falha não impede os outros), igual ao `.ps1`. Roda um ciclo ao subir o serviço e depois a cada intervalo.
- Roda numa thread própria iniciada em `unifi_syslog.main()`: se o sync falhar ou travar, o syslog segue recebendo. Sem `SYNC_API_KEY`, o sync fica desligado (aviso no log) e o coletor sobe normalmente.
- Configuração no `api/.env`: `SYNC_API_KEY` (já existe, é a da API), `SITE_SYNC_API_URL` (padrão `https://localhost:8765`), `SITE_SYNC_MINUTES` (padrão 30, mínimo 5), `SITE_SYNC_VERIFY_TLS` (padrão: não valida; a chamada é loopback).
- Testes: `python -m unittest collector.test_site_sync` (5 testes; ordem dos passos, chave, falha isolada, intervalo).
- Log: o mesmo do serviço, `syslog-collector.log` (linhas `site_sync`).

## Deploy no servidor 201

1. `update.ps1`
2. Conferir se `SYNC_API_KEY` está no `api\.env`.
3. Desligar a tarefa antiga, para não rodar em dobro se alguém consertá-la:
   `Get-ScheduledTask | Where-Object { $_.Actions.Arguments -like '*sync_site*' } | Disable-ScheduledTask`
4. `Restart-Service LogDashSyslog` (o `update.ps1` não reinicia este serviço).
5. Conferir no `syslog-collector.log`: `Sync de sites ligado: https://localhost:8765 a cada 30 min` e, logo depois, `Sync de sites ok (4 passos).`

O `sync_site.ps1` fica só para rodar à mão; o agendamento agora é do serviço.

## Front

Sidebar: o grupo "Site Optare" virou **Sites**, com o ícone `MonitorCheck` (monitor com check, de monitoramento de disponibilidade).
