# CPU e memória dos dispositivos UniFi no Painel (24/11/2026)

## Motivo
A partir das 14:55 a CPU e a memória do gateway subiram (memória ~3–4 p.p., para ~68–69%). Suspeita: o LogDash. Teste do João às 16:42: com `unifi.ui.com` aberto a **CPU sobe** e a memória fica em ~68%; o horário bate com quando a tela do UniFi foi aberta (prints das 14:50). O poller faz só GETs leves (~6–8/min) e não guarda estado no UCG. Ainda falta o teste de parar o `LogDashUnifiPoller` por 2 h e ver se a curva achata.

## O que mudou
- Migração 020: `network_device_samples (mac, sampled_at, cpu_pct, memory_pct)`, 31 dias.
- Poller: `append_device_samples` depois do retrato (extra; sem a 020 só loga). **Nenhuma chamada nova ao UCG**: os números já vêm em `fetch_devices`.
- `wan_history.fetch_device_history` + rota `GET /api/network/devices/<mac>/history?period=1h|1d|1w|1m`.
- Front: `deviceHistory.ts` (puro, testado) e `components/DeviceHistoryPanel.tsx` no Painel, abaixo do gráfico Internet: escolha do dispositivo (gateway primeiro), CPU e memória (0–100%), resumo com média, máximo e **variação da memória no período** (p.p.).
- Histórico só a partir do deploy: não mostra o salto das 14:55 (para isso, o gráfico do próprio UniFi).

## Perda de pacotes (ligada)
- Fonte: `GET v2 aggregated-dashboard?historySeconds=3600` → `wan_activity.activity_by_network_group.<WAN>.history[]`: um ponto a cada 5 min com `timestamp` (ms), `avg_packet_loss_pct`, latência média/mín/máx e taxas.
- É o endpoint da tela do UniFi (pesa no UCG). O poller chama **a cada 15 min** (`WAN_QUALITY_INTERVAL_SECONDS`), pegando a última hora: 4 chamadas/hora, e uma leitura perdida não deixa buraco. Upsert por WAN + horário (o último intervalo de cada leitura ainda está em andamento).
- Migração 021: `network_wan_quality`. `wan_history.fetch_quality` agrega em baldes de no mínimo 5 min; a rota `/api/network/wan/history` devolve `quality` (sem a 021 a rota segue sem ela).
- Front: linha "Perda de pacotes" (eixo % à direita) no gráfico de latência, em degraus e ligando os pontos (null entre medições = não medido); resumo com média e pior intervalo.
- "Conexões": nenhum endpoint lido traz (o `connectivity_status` só conta clientes). Fica de fora.

## Deploy (201)
`update.ps1` → `run_migration.py` (018 a 021) → reiniciar `LogDashUnifiPoller`. A perda de pacotes aparece no primeiro ciclo depois disso (e cobre a última hora).
