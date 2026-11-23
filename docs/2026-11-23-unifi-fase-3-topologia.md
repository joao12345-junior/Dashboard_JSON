# UniFi — Fase 3: Topologia (Rede > Topologia)

Página `NetworkTopologyPage.tsx`, só front-end: reaproveita `/api/network/devices` e `/api/network/clients?status=connected` (polling de 30 s).

Visual no estilo do mapa "Topologia" do UniFi:

- Internet → gateway (cartão com CPU/memória) → barramento horizontal com os clientes de cabo ligados no gateway e, no meio, os APs/switches → barramento tracejado com os clientes Wi-Fi de cada AP.
- `topologyLayout.ts`: função pura que calcula as coordenadas (largura por folha = `SLOT_WIDTH`); `pathToRoot` para destacar a rota.
- `components/TopologyCanvas.tsx`: linhas em SVG + nós em HTML; arrastar move, roda do mouse/botões dão zoom, botão "enquadrar" volta ao encaixe automático; passar o mouse destaca o caminho até a Internet.
- `topologyIcons.ts`: ícone do cliente por palavra-chave (nome/hostname/fabricante/nota): TV, servidor, impressora, câmera, ar-condicionado, celular…; sem pista, desktop (cabo) ou notebook (Wi-Fi).
- Filtros Todos/Com fio/Wi-Fi e busca APAGAM o que não casa (não escondem), para o desenho não mudar de lugar. Clique no cliente abre o modal de detalhes.
- Clientes cujo `uplink_mac` não é de nenhum dispositivo ficam no barramento do gateway com linha pontilhada ("ligação não identificada").
- Verificado no Chrome com dados reais (1 gateway, 1 AP, 14 cabo + 2 Wi-Fi), tema escuro e claro.

## Limitação conhecida

As ligações **entre dispositivos** são inferidas (todo AP/switch aparece ligado ao gateway). O coletor ainda não guarda o uplink de cada dispositivo (`stat/device` → `uplink`/`port_table`/LLDP). Com 1 gateway + 1 AP isso é correto; com switches em cascata não será. Próximo passo, se necessário: coluna `uplink_mac` em `network_devices` (migração 015), mapper e poller.

Fora do escopo por enquanto: a aba "Infraestrutura" do UniFi (WAN1/WAN2 com provedor, IP público e disponibilidade). O poller não coleta WAN; dá para tirar de `stat/device` do gateway (campos `wan1`/`wan2`) com migração nova.

Deploy: só `update.ps1` no servidor 201.
