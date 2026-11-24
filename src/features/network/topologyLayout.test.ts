// src/features/network/topologyLayout.test.ts
import { describe, expect, it } from "vitest";
import { buildTopologyLayout, isGateway, pathToRoot, SLOT_WIDTH, type TopologyNode } from "./topologyLayout";
import { makeClient, makeDevice } from "./testFactories";

const gateway = makeDevice({ mac: "gw:00", name: "UCG", model: "UCG-Ultra" });
const ap = makeDevice({ mac: "ap:00", name: "AP Sala", model: "U7-Pro" });
const nodeById = (nodes: TopologyNode[], id: string) => nodes.find((n) => n.id === id);

describe("isGateway", () => {
	it("reconhece os modelos de gateway da UniFi, sem diferenciar maiúsculas", () => {
		for (const model of ["UCG-Ultra", "udm-pro", "UDR", "UXG-Lite", "USG-3P"]) {
			expect(isGateway(makeDevice({ model }))).toBe(true);
		}
	});

	it("AP, switch e modelo ausente não são gateway", () => {
		expect(isGateway(makeDevice({ model: "U7-Pro" }))).toBe(false);
		expect(isGateway(makeDevice({ model: "USW-Lite-8" }))).toBe(false);
		expect(isGateway(makeDevice({ model: null }))).toBe(false);
	});
});

describe("buildTopologyLayout", () => {
	it("sem dispositivos nem clientes, ainda devolve o nó Internet e uma área mínima", () => {
		const layout = buildTopologyLayout([], []);
		expect(layout.nodes.map((n) => n.id)).toEqual(["internet"]);
		expect(layout.width).toBeGreaterThan(0);
		expect(layout.height).toBeGreaterThan(0);
	});

	it("liga Internet → gateway", () => {
		const layout = buildTopologyLayout([gateway], []);
		const gw = nodeById(layout.nodes, "dev:gw:00");
		expect(gw?.kind).toBe("gateway");
		expect(gw?.parentId).toBe("internet");
	});

	it("cliente no gateway é ligação direta; cliente no AP fica um nível abaixo", () => {
		const direto = makeClient({ mac: "c:01", name: "Direto", uplink_mac: "gw:00" });
		const noAp = makeClient({ mac: "c:02", name: "NoAp", uplink_mac: "ap:00" });
		const { nodes } = buildTopologyLayout([gateway, ap], [direto, noAp]);
		const d = nodeById(nodes, "cli:c:01")!;
		const a = nodeById(nodes, "cli:c:02")!;
		const apNode = nodeById(nodes, "dev:ap:00")!;
		expect(d.parentId).toBe("dev:gw:00");
		expect(d.inferred).toBe(false);
		expect(a.parentId).toBe("dev:ap:00");
		expect(a.y).toBeGreaterThan(apNode.y);
		expect(a.y).toBeGreaterThan(d.y);
	});

	it("cliente sem uplink, ou com uplink desconhecido, vira ligação inferida no gateway", () => {
		const sem = makeClient({ mac: "c:03", uplink_mac: null });
		const estranho = makeClient({ mac: "c:04", uplink_mac: "zz:zz" });
		const { nodes } = buildTopologyLayout([gateway], [sem, estranho]);
		for (const mac of ["c:03", "c:04"]) {
			const n = nodeById(nodes, `cli:${mac}`)!;
			expect(n.parentId).toBe("dev:gw:00");
			expect(n.inferred).toBe(true);
		}
	});

	it("sem gateway, os clientes penduram direto na Internet", () => {
		const { nodes } = buildTopologyLayout([ap], [makeClient({ mac: "c:05", uplink_mac: "ap:00" })]);
		expect(nodes.some((n) => n.kind === "gateway")).toBe(false);
		expect(nodeById(nodes, "dev:ap:00")?.parentId).toBe("internet");
	});

	it("AP fica no meio do barramento, com clientes diretos dos dois lados", () => {
		const diretos = [
			makeClient({ mac: "c:10", name: "A", uplink_mac: "gw:00" }),
			makeClient({ mac: "c:11", name: "B", uplink_mac: "gw:00" }),
		];
		const filhos = [
			makeClient({ mac: "c:12", name: "C", uplink_mac: "ap:00" }),
			makeClient({ mac: "c:13", name: "D", uplink_mac: "ap:00" }),
		];
		const { nodes } = buildTopologyLayout([gateway, ap], [...diretos, ...filhos]);
		const ax = nodeById(nodes, "cli:c:10")!.x;
		const bx = nodeById(nodes, "cli:c:11")!.x;
		const apx = nodeById(nodes, "dev:ap:00")!.x;
		expect(Math.min(ax, bx)).toBeLessThan(apx);
		expect(Math.max(ax, bx)).toBeGreaterThan(apx);
	});

	it("clientes do mesmo AP ficam separados por um slot inteiro (nada se sobrepõe)", () => {
		const filhos = [1, 2, 3].map((i) => makeClient({ mac: `c:2${i}`, name: `F${i}`, uplink_mac: "ap:00" }));
		const { nodes } = buildTopologyLayout([gateway, ap], filhos);
		const xs = filhos.map((c) => nodeById(nodes, `cli:${c.mac}`)!.x).sort((a, b) => a - b);
		expect(xs[1] - xs[0]).toBe(SLOT_WIDTH);
		expect(xs[2] - xs[1]).toBe(SLOT_WIDTH);
	});

	it("cliente sem fio tem ligação tracejada; com fio, contínua", () => {
		const cabo = makeClient({ mac: "c:30", is_wired: true, uplink_mac: "gw:00" });
		const wifi = makeClient({ mac: "c:31", is_wired: false, uplink_mac: "gw:00" });
		const { nodes } = buildTopologyLayout([gateway], [cabo, wifi]);
		expect(nodeById(nodes, "cli:c:30")?.dashed).toBe(false);
		expect(nodeById(nodes, "cli:c:31")?.dashed).toBe(true);
	});

	it("a área desenhada cobre todos os nós", () => {
		const clientes = Array.from({ length: 12 }, (_, i) =>
			makeClient({ mac: `c:4${i}`, name: `N${i}`, uplink_mac: i % 2 ? "ap:00" : "gw:00" }),
		);
		const { nodes, width, height } = buildTopologyLayout([gateway, ap], clientes);
		for (const n of nodes) {
			expect(n.x).toBeGreaterThanOrEqual(0);
			expect(n.x).toBeLessThanOrEqual(width);
			expect(n.y).toBeLessThan(height);
		}
	});
});

describe("pathToRoot", () => {
	const { nodes } = buildTopologyLayout([gateway, ap], [makeClient({ mac: "c:50", uplink_mac: "ap:00" })]);

	it("sobe do cliente até a Internet, passando pelo AP e pelo gateway", () => {
		expect([...pathToRoot(nodes, "cli:c:50")].sort()).toEqual(
			["cli:c:50", "dev:ap:00", "dev:gw:00", "internet"].sort(),
		);
	});

	it("sem id ou com id desconhecido, o caminho é vazio", () => {
		expect(pathToRoot(nodes, null).size).toBe(0);
		expect(pathToRoot(nodes, "nao-existe").size).toBe(0);
	});
});
