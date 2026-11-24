# Probe do UniFi: clientes de VPN e aplicativos mais usados (24/11/2026)

## Motivo
1. **Clientes de VPN não aparecem no LogDash.** No UniFi há 8 clientes OpenVPN (rede ServOvpn, 10.10.10.2 a .9). O poller só lê `stat/sta` (cabo e Wi-Fi), e `map_client` descarta quem não tem MAC. Hipótese **não verificada**: VPN não está em `stat/sta` ou vem sem MAC (a tabela `network_clients` usa o MAC como chave).
2. **Painel "Principais aplicativos" e gráfico "Internet"** (atividade, latência, perda de pacotes, conexões) do UniFi. Os dados de DPI e de relatório do gateway ainda não foram vistos de verdade.

## O que mudou
`api/collector/unifi_probe.py` ganhou duas seções, **somente GET** e com valores sensíveis mascarados:
- VPN 1/3: Integration API `/clients`, contagem por tipo e exemplo de cada tipo.
- VPN 2/3: `stat/sta`, quantos clientes parecem VPN (IP 10.10.10.x ou rede com "vpn").
- VPN 3/3: v2 `clients/active`, contagem por tipo e exemplo de VPN.
- APLICATIVOS: v2 `traffic-flow-latest-statistics?period=DAY&top=5` (GET).
Testado contra um UCG falso: só GET, nenhuma escrita.

## Como rodar (servidor 201)
`cd C:\Optare\LogDash\api; .\.venv\Scripts\python.exe -m collector.unifi_probe` e colar a saída (a chave da API fica só no `api/.env`).

## Primeira saída (probe ANTIGO, rodado no 201 às 15:14)
O 201 ainda tinha a versão anterior do probe, sem as seções novas. Mesmo assim: Integration `/clients` = 16 e `stat/sta` = 16, enquanto o UniFi mostra mais 8 em VPN. Ou seja, os clientes OpenVPN **não estão em nenhum dos dois** (não é só "sem MAC"). Falta o v2 `clients/active`: levar o probe novo e rodar de novo.

## Próximos passos (dependem da saída real)
- VPN: definir a chave dos clientes sem MAC (provavelmente o id do cliente no UniFi) antes de mexer no mapper.
- Aplicativos: o endpoint legado de DPI (`stat/sitedpi`) é **POST**, o que conflita com a regra "o código nunca escreve no UniFi". Só usar com aprovação explícita; a v2 por GET é a alternativa.
- Gráfico de Internet: tabela de amostras (`network_wan_samples`) gravada pelo poller a cada ciclo, com histórico só a partir do deploy. Perda de pacotes depende do probe.
