# UniFi, fase 1: coletor syslog (eventos de rede) — 2026-11-23

## Contexto
Console da Optare: **UCG Ultra** (gateway local; site "Optare", visto em unifi.ui.com).
Escolha: começar por **eventos via syslog**, coletor no servidor 201 como serviço.
O UniFi exporta eventos em CEF por UDP (Activity Logging > SIEM Server; o caminho do menu muda
com a versão: *Settings > Control Plane > Integrations*, *System > Integrations* ou
*CyberSecure > Traffic Logging*). Fontes: help.ui.com/hc/en-us/articles/33349041044119.

## O que foi feito (não é frontend ainda)
- `api/migrations/013_network_events.sql`: tabela `optsislog.network_events` (cabeçalho CEF em colunas,
  resto em `extension` JSONB, linha original em `raw`). **Não executada.**
- `api/collector/cef_parser.py`: parser CEF puro (escapes `\|` `\=` `\\`, valores com espaços, severidade
  numérica ou texto, `rt` em ms). Mensagem não-CEF é guardada em `name`/`raw`, sem perder o evento.
- `api/collector/sinks.py`: porta `EventSink` + adaptador `PostgresEventSink` (conexão própria, não usa o
  pool do Flask; reconecta sozinho).
- `api/collector/unifi_syslog.py`: receptor UDP (thread de recepção + thread de gravação em lotes de até
  100/1 s, fila de 10.000, backoff se o banco cair). **Só aceita IPs em `SYSLOG_ALLOWED_IPS`** (obrigatória;
  vazia = não sobe). Porta padrão 5514.
- `api/collector/test_collector.py`: 10 testes (`cd api; python -m unittest collector.test_collector -v`),
  todos passando no ambiente de desenvolvimento (parser, filtro de IP, retentativa com banco falhando).
- `api/routes/logs.py`: `POST /api/logs/cleanup` passa a apagar `network_events` com **7 dias** de retenção
  (os mais volumosos) e devolve `network` nos campos `deleted` e `retention_days`.
- `install-syslog-collector.ps1` (raiz): instala o serviço NSSM `LogDashSyslog` e a regra de firewall só
  para o IP do console. **`*.ps1` é gitignored: copiar manualmente para o 201.**

Arquitetura: Ports and Adapters (Alistair Cockburn) — o parser é o miolo; o socket UDP e o Postgres são
adaptadores nas pontas, trocáveis (por isso os testes usam um sink em memória).

## Como ligar (João)
1. Commit/push; no 201: `.\update.ps1`.
2. Migration: `python api\migrations\run_migration.py` (no 201 também, se o banco for diferente).
3. Copiar `install-syslog-collector.ps1` para `C:\Optare\LogDash` e rodar, como administrador:
   `.\install-syslog-collector.ps1 -UcgIp <IP do UCG Ultra>`
4. No UniFi: Activity Logging > **SIEM Server**, IP do 201, porta 5514, escolher as categorias.
   (A documentação cita que a porta é UDP e fica entre 1024 e 65535.)
5. Conferir: `SELECT created_at, signature_id, name, severity, extension FROM optsislog.network_events ORDER BY id DESC LIMIT 20;`
   e o `syslog-collector.log` (estatísticas a cada minuto: recebidos/gravados/rejeitados/descartados).

Depois de qualquer `update.ps1` que mude `api/collector/`, reiniciar: `Restart-Service LogDashSyslog`
(o `update.ps1` ainda só gerencia o serviço `LogDash`).

## Primeiros dados reais (2026-11-23 16:17)
Funcionou de ponta a ponta (UCG Ultra `UDRULT` 6.0.17 -> firewall -> coletor -> `network_events`).
- Origem aceita: `192.168.16.1`. Eventos vistos: `1` "Test Syslog" e `1005` "Admin Made Config Changes" (severidade 2).
- Campos de `extension`: `msg`, `UNIFIhost`, `UNIFIutcTime`, `UNIFIdeviceIp` (IP **publico/WAN**), `UNIFIdeviceMac`, `UNIFIdeviceName`, `UNIFIdeviceModel`, `UNIFIdeviceVersion`.
- **O UniFi não manda `rt`**: o horário do evento vem em `UNIFIutcTime` (ISO com "Z"). Parser corrigido para ler esse campo; linhas gravadas antes da correção ficaram com `event_time` NULL. Backfill opcional (quem roda é o João):
  `UPDATE optsislog.network_events SET event_time = (extension->>'UNIFIutcTime')::timestamptz WHERE event_time IS NULL AND extension ? 'UNIFIutcTime';`
- Quase tudo útil está no texto livre de `msg` (ex.: quem mudou o quê). Extrair "quem conectou" disso seria frágil: isso é papel da fase 2 (API).
- Atenção de privacidade: `msg` traz nome do administrador e IP de origem; a tabela fica visível a quem usa o LogDash.

## Não verificado
- `PostgresEventSink` (precisa de banco; não rodou) e o `.ps1` (sem PowerShell no ambiente).
- O formato real das mensagens do UCG Ultra: o parser segue a especificação CEF; os nomes de campos
  (`src`, `msg`...) só ficam conhecidos com dados reais. Por isso o `extension` é JSONB.
- Volume: se as categorias de cliente/tráfego forem todas ligadas, a tabela pode crescer rápido.
  Olhar `recebidos` nos primeiros dias e filtrar categorias no UniFi se preciso.

## Próximos passos
- **Fase 1b (frontend):** página "Rede > Eventos" (lista com filtros e modal de detalhes). Só depois de
  ver dados reais, para não desenhar tela em cima de campos supostos.
- **Fase 2:** quem está conectado, dispositivos e alertas pela API local do UCG Ultra (chave criada no
  console); syslog não entrega inventário.
- **Fase 3:** mapa de topologia (relação uplink dos dispositivos, via API local).
