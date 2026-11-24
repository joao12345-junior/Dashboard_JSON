# Gráfico "Internet" na aba Infraestrutura (24/11/2026)

## O que é
No **Rede > Painel** (antes ficava embaixo da aba Infraestrutura; ver `2026-11-24-rede-painel.md`), um painel no estilo do UniFi com o histórico de cada link (Internet 1 / Internet 2):
- **Tráfego**: download e upload (média por ponto; o tooltip e o resumo mostram o pico).
- **Latência**: média e máxima.
- Resumo: download/upload médio e pico, latência média e máxima, % do tempo no ar (pelas amostras).
- Períodos: 1 h, 1 dia (padrão), 1 semana, 1 mês.

**Não tem** perda de pacotes nem número de conexões: o `stat/device` do UCG (que o poller já lê) traz `latency`, `rx_rate`, `tx_rate`, `availability` e `up` por WAN, mas não esses dois. Depende do probe novo achar outro endpoint (somente GET).

## Por que precisa de tabela nova
`network_wan` guarda só o último estado. O UniFi não entrega histórico por GET (os relatórios `stat/report` são POST, o que fere a regra de nunca escrever no UCG). Então o próprio poller passa a guardar **uma amostra por WAN por ciclo (~60 s)**. O histórico começa no deploy: no primeiro dia, "1 mês" mostra só o que existe.

## Arquitetura
- `api/migrations/017_network_wan_samples.sql`: `network_wan_samples (wan_group, sampled_at, is_up, latency_ms, rx_bps, tx_bps)`, PK `(wan_group, sampled_at)`, índice em `sampled_at`. ~90 mil linhas em 31 dias.
- `collector/state_sinks.py` → `append_wan_samples`: insere e apaga o que passou de 31 dias, numa transação **separada**. No `unifi_poller.py` é um extra: se falhar (ex.: 017 não aplicada), só loga aviso; dispositivos, clientes e o estado da WAN continuam sendo gravados.
- `api/wan_history.py` (Repository): períodos (`1h`→1 min, `1d`→5 min, `1w`→30 min, `1m`→2 h por ponto, sempre 60–360 pontos) e o SQL agregado (média e máximo por balde). PostgreSQL 13 não tem `date_bin`, o balde sai de `floor(epoch / passo)`. Testado sem banco em `api/test_wan_history.py`.
- Rota `GET /api/network/wan/history?period=1h|1d|1w|1m` em `routes/network_state.py` (login exigido; período inválido vira 1 dia).
- Front: `src/features/network/wanHistory.ts` (puro: preenche baldes sem amostra com `null` para a linha **quebrar** em vez de ligar dois pontos distantes; resumo), `wanHistory.test.ts`, `components/WanHistoryPanel.tsx` (recharts, gráficos sincronizados), ligado em `InfrastructureView.tsx`.

`rx_rate`/`tx_rate` do UCG já vêm em bits/s (`rx_rate` = `rx_bytes-r` × 8, conferido na saída do probe).

## Deploy (servidor 201)
1. `update.ps1`.
2. `python api\migrations\run_migration.py` (aplica a 017; a 016 também, se faltar).
3. Reiniciar `LogDashUnifiPoller` (passa a gravar amostras) e `LogDash` (rota nova).
4. Conferir após uns minutos: `SELECT wan_group, count(*), max(sampled_at) FROM optsislog.network_wan_samples GROUP BY 1;`

Na máquina de desenvolvimento, o Flask aberto pelo `npm run dev` precisa ser reiniciado para enxergar a rota (sem isso: 404 / "Failed to fetch").

## Testes
Python: `test_wan_history` (6) + 3 novos em `collector/test_unifi_poller` (amostra com o mesmo horário do ciclo; falha da WAN não grava amostra; falha da amostra não derruba o ciclo). Front: 5 em `wanHistory.test.ts`.
