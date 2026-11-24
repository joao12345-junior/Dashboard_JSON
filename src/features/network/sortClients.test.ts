// src/features/network/sortClients.test.ts
import { describe, expect, it } from "vitest";
import { clientTitle, sortClients } from "./sortClients";
import { makeClient } from "./testFactories";

const names = (list: { name: string | null; mac: string }[]) => list.map((c) => c.name ?? c.mac);

describe("clientTitle", () => {
	it("usa nome, depois hostname, depois MAC", () => {
		expect(clientTitle(makeClient({ name: "Sala", hostname: "h", mac: "m" }))).toBe("Sala");
		expect(clientTitle(makeClient({ name: null, hostname: "h", mac: "m" }))).toBe("h");
		expect(clientTitle(makeClient({ name: null, hostname: null, mac: "m" }))).toBe("m");
	});
});

describe("sortClients", () => {
	it("ordena por nome em ordem natural (OPT2 antes de OPT10)", () => {
		const list = [makeClient({ name: "OPT10" }), makeClient({ name: "OPT2" }), makeClient({ name: "OPT1" })];
		expect(names(sortClients(list, "name", "asc"))).toEqual(["OPT1", "OPT2", "OPT10"]);
	});

	it("ignora maiúsculas e acentos na ordem por nome", () => {
		const list = [makeClient({ name: "zeca" }), makeClient({ name: "Álvaro" }), makeClient({ name: "bia" })];
		expect(names(sortClients(list, "name", "asc"))).toEqual(["Álvaro", "bia", "zeca"]);
	});

	it("ordena IP pelos números do endereço, não como texto", () => {
		const list = [
			makeClient({ name: "a", ip_address: "192.168.16.10" }),
			makeClient({ name: "b", ip_address: "192.168.16.9" }),
			makeClient({ name: "c", ip_address: "192.168.2.200" }),
		];
		expect(names(sortClients(list, "ip", "asc"))).toEqual(["c", "b", "a"]);
	});

	it("cliente sem IP (ou IP inválido) vai sempre para o fim, em qualquer direção", () => {
		const list = [
			makeClient({ name: "sem", ip_address: null }),
			makeClient({ name: "x", ip_address: "10.0.0.2" }),
			makeClient({ name: "ruim", ip_address: "999.1.1.1" }),
			makeClient({ name: "y", ip_address: "10.0.0.1" }),
		];
		expect(names(sortClients(list, "ip", "asc")).slice(0, 2)).toEqual(["y", "x"]);
		expect(names(sortClients(list, "ip", "desc")).slice(0, 2)).toEqual(["x", "y"]);
		expect(names(sortClients(list, "ip", "desc")).slice(2).sort()).toEqual(["ruim", "sem"]);
	});

	it("conexão: cabo antes de Wi-Fi, depois pelo SSID", () => {
		const list = [
			makeClient({ name: "w2", is_wired: false, ssid: "Visitantes" }),
			makeClient({ name: "cabo", is_wired: true }),
			makeClient({ name: "w1", is_wired: false, ssid: "Optare" }),
		];
		expect(names(sortClients(list, "connection", "asc"))).toEqual(["cabo", "w1", "w2"]);
	});

	it("estado: conectado usa connected_since; desconectado usa quando saiu", () => {
		const list = [
			makeClient({ name: "novo", connected: true, connected_since: "2026-11-24T10:00:00Z" }),
			makeClient({ name: "velho", connected: true, connected_since: "2026-11-20T10:00:00Z" }),
			makeClient({ name: "saiu", connected: false, disconnected_at: "2026-11-22T10:00:00Z" }),
		];
		expect(names(sortClients(list, "state", "asc"))).toEqual(["velho", "saiu", "novo"]);
	});

	it("desempata pelo nome, para a ordem não pular entre atualizações", () => {
		const list = [
			makeClient({ name: "b", ip_address: "10.0.0.1" }),
			makeClient({ name: "a", ip_address: "10.0.0.1" }),
		];
		expect(names(sortClients(list, "ip", "asc"))).toEqual(["a", "b"]);
	});

	it("descendente inverte a ordem", () => {
		const list = [makeClient({ name: "a" }), makeClient({ name: "b" })];
		expect(names(sortClients(list, "name", "desc"))).toEqual(["b", "a"]);
	});

	it("não altera a lista original", () => {
		const list = [makeClient({ name: "b" }), makeClient({ name: "a" })];
		sortClients(list, "name", "asc");
		expect(names(list)).toEqual(["b", "a"]);
	});
});
