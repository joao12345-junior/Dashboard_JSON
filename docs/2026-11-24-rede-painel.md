# Rede > Painel (24/11/2026)

## O que é
Primeiro item da seção Rede na sidebar: a "home" da rede, no espírito da tela inicial do UniFi. O gráfico "Internet" saiu da aba Infraestrutura (Topologia) e veio para cá.

- **Gateway** (coluna da esquerda): nome, modelo e firmware; clientes com fio / Wi-Fi e dispositivos online; tempo ligado, CPU/memória, se há atualização; convidados (só se houver).
- **Internet**: cada WAN com estado, disponibilidade, provedor, IP, taxa atual (↓/↑) e latência.
- **Gráfico Internet** (direita): o mesmo painel de antes (`WanHistoryPanel`), agora como cartão.
- **Principais clientes**: os 8 conectados com mais tráfego. Os contadores do UniFi zeram a cada conexão: é "desde que conectou", não "no dia".
- **Dispositivos**: APs/switches com nº de clientes e tempo ligado.
- **Alertas recentes**: últimos 6 eventos de gravidade média ou alta.
- Card de Rede da Home: o link "Topologia →" virou "Painel →".

**Ainda não tem** "Principais aplicativos" (DPI) nem perda de pacotes/conexões: dependem da saída do probe novo no 201.

## Arquitetura
Só front, reaproveita as rotas existentes (`/api/network/devices`, `/clients`, `/wan`, `/wan/history`, `/events`).
- `src/features/network/networkDashboard.ts` (puro): `topClientsByTraffic`, `countNetwork`, `clientsPerDevice`, `splitGateway`; testes em `networkDashboard.test.ts`.
- `src/features/network/NetworkDashboardPage.tsx`; rota `network-dashboard` em `App.tsx`; item "Painel" em `Sidebar.tsx`.
- `InfrastructureView.tsx` voltou a ser só o diagrama.

## Deploy
Só `update.ps1` (sem migração nova).
