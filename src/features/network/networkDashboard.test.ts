// src/features/network/networkDashboard.test.ts
import { describe, expect, it } from "vitest";
import { makeClient, makeDevice } from "./testFactories";
import {
	clientTraffic,
	clientsPerDevice,
	countNetwork,
	splitGateway,
	topClientsByTraffic,
} from "./networkDashboard";

describe("clientTraffic", () => {
	it("soma enviado + recebido e trata um lado nulo como zero", () => {
		expect(clientTraffic(makeClient({ tx_bytes: 10, rx_bytes: 5 }))).toBe(15);
		expect(clientTraffic(makeClient({ tx_bytes: null, rx_bytes: 5 }))).toBe(5);
		expect(clientTraffic(makeClient({ tx_bytes: null, rx_bytes: null }))).toBeNull();
	});
});

describe("topClientsByTraffic", () => {
	it("só conectados com contador, do maior para o menor, limitado", () => {
		const clients = [
			makeClient({ mac: "a", tx_bytes: 100, rx_bytes: 0 }),
			makeClient({ mac: "b", tx_bytes: 500, rx_bytes: 0 }),
			makeClient({ mac: "c", tx_bytes: 900, rx_bytes: 0, connected: false }),
			makeClient({ mac: "d", tx_bytes: null, rx_bytes: null }),
			makeClient({ mac: "e", tx_bytes: 300, rx_bytes: 0 }),
		];
		expect(topClientsByTraffic(clients, 2).map((c) => c.mac)).toEqual(["b", "e"]);
		expect(topClientsByTraffic(clients, 10).map((c) => c.mac)).toEqual(["b", "e", "a"]);
	});

	it("empate pelo MAC", () => {
		const clients = [makeClient({ mac: "z", tx_bytes: 1 }), makeClient({ mac: "m", tx_bytes: 1 })];
		expect(topClientsByTraffic(clients, 2).map((c) => c.mac)).toEqual(["m", "z"]);
	});
});

describe("countNetwork", () => {
	it("conta dispositivos online e clientes conectados por tipo", () => {
		const counts = countNetwork(
			[makeDevice({ mac: "1" }), makeDevice({ mac: "2", state: "OFFLINE" })],
			[
				makeClient({ mac: "a", is_wired: true }),
				makeClient({ mac: "b", is_wired: false, is_guest: true }),
				makeClient({ mac: "c", connected: false }),
			],
		);
		expect(counts).toEqual({
			devicesOnline: 1,
			devicesTotal: 2,
			clientsConnected: 2,
			wired: 1,
			wifi: 1,
			guests: 1,
		});
	});
});

describe("clientsPerDevice", () => {
	it("conta só conectados com uplink", () => {
		const counts = clientsPerDevice([
			makeClient({ mac: "a", uplink_mac: "ap" }),
			makeClient({ mac: "b", uplink_mac: "ap" }),
			makeClient({ mac: "c", uplink_mac: "ap", connected: false }),
			makeClient({ mac: "d", uplink_mac: null }),
		]);
		expect([...counts]).toEqual([["ap", 2]]);
	});
});

describe("splitGateway", () => {
	it("acha o gateway pelo modelo e ordena o resto pelo nome", () => {
		const { gateway, others } = splitGateway([
			makeDevice({ mac: "2", name: "Switch", model: "USW" }),
			makeDevice({ mac: "1", name: "Optare", model: "UCG-Ultra" }),
			makeDevice({ mac: "3", name: "Ap 409", model: "UAP-AC-Lite" }),
		]);
		expect(gateway?.name).toBe("Optare");
		expect(others.map((d) => d.name)).toEqual(["Ap 409", "Switch"]);
	});

	it("sem gateway", () => {
		expect(splitGateway([makeDevice({ model: "UAP" })]).gateway).toBeNull();
	});
});
