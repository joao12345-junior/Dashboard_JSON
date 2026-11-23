// src/features/network/topologyLayout.ts
import type { NetworkClient, NetworkDevice } from "./hooks/useNetworkState";
import { sortClients } from "./sortClients";

/** Modelos de gateway/roteador UniFi (o UniFi informa só "switching" para eles). */
export const GATEWAY_MODEL = /^(UCG|UDM|UDR|UXG|USG)/i;

export const isGateway = (d: NetworkDevice): boolean =>
	d.model !== null && GATEWAY_MODEL.test(d.model);

export type TopologyNodeKind = "internet" | "gateway" | "device" | "client";

/** Largura reservada para cada folha (cliente) na horizontal. */
export const SLOT_WIDTH = 116;

/** Altura do "ícone" de cada tipo: é de onde sai a linha para os filhos. */
export const NODE_ICON_HEIGHT: Record<TopologyNodeKind, number> = {
	internet: 40,
	gateway: 64,
	device: 44,
	client: 40,
};

/** Altura do rótulo abaixo do ícone: a linha para os filhos só começa depois dele. */
const LABEL_BELOW: Record<TopologyNodeKind, number> = { internet: 22, gateway: 0, device: 36, client: 36 };

/** Y de onde sai a linha que desce para os filhos (abaixo do ícone e do rótulo). */
export const linkStartY = (n: TopologyNode): number => n.y + NODE_ICON_HEIGHT[n.kind] + LABEL_BELOW[n.kind];

/** Espaço abaixo do ícone para o rótulo (nome/IP) antes do próximo barramento. */
const LABEL_SPACE = 44;
/** Distância entre o barramento horizontal e o topo dos filhos. */
const DROP = 28;
const BUS_GAP = 30;
const PADDING = 40;

/// <summary>
/// Nó já posicionado. `x` é o CENTRO horizontal e `y` o TOPO do ícone.
/// `parentId`/`busY` descrevem a ligação: linha desce do pai até `busY`,
/// corre na horizontal e desce até o filho. `dashed` = ligação sem fio.
/// </summary>
export interface TopologyNode {
	id: string;
	kind: TopologyNodeKind;
	x: number;
	y: number;
	parentId: string | null;
	busY: number | null;
	dashed: boolean;
	/** Ligação inferida (não informada pelo UniFi): desenhada mais apagada. */
	inferred: boolean;
	device?: NetworkDevice;
	client?: NetworkClient;
}

export interface TopologyLayout {
	nodes: TopologyNode[];
	width: number;
	height: number;
}

interface Branch {
	device?: NetworkDevice;
	client?: NetworkClient;
	inferred: boolean;
	children: NetworkClient[];
}

const branchWidth = (b: Branch) => Math.max(1, b.children.length) * SLOT_WIDTH;

/// <summary>
/// Monta a árvore "à la UniFi": Internet → gateway → barramento com os
/// dispositivos (AP/switch) e os clientes ligados direto no gateway → em cada
/// dispositivo, um segundo barramento com os clientes dele.
/// Função pura (sem React): recebe as listas da API e devolve coordenadas.
/// </summary>
export function buildTopologyLayout(
	devices: readonly NetworkDevice[],
	clients: readonly NetworkClient[],
): TopologyLayout {
	const gateway = devices.find(isGateway) ?? null;
	const others = devices
		.filter((d) => d !== gateway)
		.sort((a, b) => (a.name ?? a.mac).localeCompare(b.name ?? b.mac, "pt-BR", { numeric: true }));
	const deviceMacs = new Set(devices.map((d) => d.mac));

	const childrenOf = new Map<string, NetworkClient[]>();
	const direct: NetworkClient[] = [];
	const orphans: NetworkClient[] = [];
	for (const c of sortClients(clients, "name", "asc")) {
		if (c.uplink_mac && deviceMacs.has(c.uplink_mac) && c.uplink_mac !== gateway?.mac) {
			childrenOf.set(c.uplink_mac, [...(childrenOf.get(c.uplink_mac) ?? []), c]);
		} else if (c.uplink_mac && c.uplink_mac === gateway?.mac) {
			direct.push(c);
		} else {
			orphans.push(c);
		}
	}

	// Dispositivos ficam no MEIO do barramento (como no UniFi), clientes dos dois lados.
	const deviceBranches: Branch[] = others.map((d) => ({
		device: d,
		inferred: true,
		children: childrenOf.get(d.mac) ?? [],
	}));
	const clientBranches: Branch[] = [...direct, ...orphans].map((c) => ({
		client: c,
		inferred: !direct.includes(c),
		children: [],
	}));
	const half = Math.ceil(clientBranches.length / 2);
	const branches = [
		...clientBranches.slice(0, half),
		...deviceBranches,
		...clientBranches.slice(half),
	];

	const nodes: TopologyNode[] = [];
	const totalWidth = Math.max(SLOT_WIDTH * 2, branches.reduce((s, b) => s + branchWidth(b), 0));
	const centerX = PADDING + totalWidth / 2;

	const internetY = PADDING;
	const gatewayY = internetY + NODE_ICON_HEIGHT.internet + LABEL_BELOW.internet + BUS_GAP;
	nodes.push({ id: "internet", kind: "internet", x: centerX, y: internetY, parentId: null, busY: null, dashed: false, inferred: false });

	const rootId = gateway ? `dev:${gateway.mac}` : "internet";
	if (gateway) {
		nodes.push({
			id: rootId,
			kind: "gateway",
			x: centerX,
			y: gatewayY,
			parentId: "internet",
			busY: gatewayY - BUS_GAP / 2,
			dashed: false,
			inferred: false,
			device: gateway,
		});
	}

	const rootBottom = gateway ? gatewayY + NODE_ICON_HEIGHT.gateway : internetY + NODE_ICON_HEIGHT.internet;
	const busY = rootBottom + BUS_GAP;
	const level2Y = busY + DROP;
	const subBusY = level2Y + NODE_ICON_HEIGHT.device + LABEL_SPACE;
	const level3Y = subBusY + DROP;

	let cursor = PADDING;
	let hasLevel3 = false;
	for (const b of branches) {
		const w = branchWidth(b);
		const x = cursor + w / 2;
		if (b.device) {
			const id = `dev:${b.device.mac}`;
			nodes.push({ id, kind: "device", x, y: level2Y, parentId: rootId, busY, dashed: false, inferred: b.inferred, device: b.device });
			b.children.forEach((c, i) => {
				hasLevel3 = true;
				nodes.push({
					id: `cli:${c.mac}`,
					kind: "client",
					x: cursor + SLOT_WIDTH * i + SLOT_WIDTH / 2,
					y: level3Y,
					parentId: id,
					busY: subBusY,
					dashed: !c.is_wired,
					inferred: false,
					client: c,
				});
			});
		} else if (b.client) {
			nodes.push({
				id: `cli:${b.client.mac}`,
				kind: "client",
				x,
				y: level2Y,
				parentId: rootId,
				busY,
				dashed: !b.client.is_wired,
				inferred: b.inferred,
				client: b.client,
			});
		}
		cursor += w;
	}

	const bottom = (hasLevel3 ? level3Y + NODE_ICON_HEIGHT.client : level2Y + NODE_ICON_HEIGHT.device) + LABEL_SPACE;
	return { nodes, width: totalWidth + PADDING * 2, height: bottom + PADDING };
}

/** Ids do caminho do nó até a raiz (inclusive), para destacar a rota. */
export function pathToRoot(nodes: readonly TopologyNode[], id: string | null): Set<string> {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const path = new Set<string>();
	let current = id ? byId.get(id) : undefined;
	while (current) {
		path.add(current.id);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return path;
}
