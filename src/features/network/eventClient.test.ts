// src/features/network/eventClient.test.ts
import { describe, expect, it } from "vitest";
import { buildClientLookup, findEventClient } from "./eventClient";
import { makeClient, makeEvent } from "./testFactories";

describe("buildClientLookup", () => {
	it("indexa por MAC em minúsculas", () => {
		const c = makeClient({ mac: "AA:BB:CC:00:00:01" });
		expect(buildClientLookup([c]).byMac.get("aa:bb:cc:00:00:01")).toBe(c);
	});

	it("no empate de IP, quem está conectado vence, em qualquer ordem da lista", () => {
		const antigo = makeClient({ mac: "aa:aa:aa:00:00:01", ip_address: "10.0.0.5", connected: false });
		const atual = makeClient({ mac: "aa:aa:aa:00:00:02", ip_address: "10.0.0.5", connected: true });
		expect(buildClientLookup([antigo, atual]).byIp.get("10.0.0.5")).toBe(atual);
		expect(buildClientLookup([atual, antigo]).byIp.get("10.0.0.5")).toBe(atual);
	});

	it("cliente sem IP não entra no índice de IP", () => {
		expect(buildClientLookup([makeClient({ ip_address: null })]).byIp.size).toBe(0);
	});
});

describe("findEventClient", () => {
	const notebook = makeClient({ mac: "aa:bb:cc:00:00:01", ip_address: "192.168.16.10", name: "Notebook" });
	const outro = makeClient({ mac: "aa:bb:cc:00:00:02", ip_address: "192.168.16.100", name: "Outro" });
	const lookup = buildClientLookup([notebook, outro]);

	it("acha pelo MAC em qualquer valor do extension, sem diferenciar maiúsculas", () => {
		const ev = makeEvent({ extension: { UNIFIclientMac: "AA:BB:CC:00:00:01" } });
		expect(findEventClient(ev, lookup)).toBe(notebook);
	});

	it("acha pelo IP, com comparação EXATA (.10 não casa com .100)", () => {
		expect(findEventClient(makeEvent({ extension: { src: "192.168.16.10" } }), lookup)).toBe(notebook);
		expect(findEventClient(makeEvent({ extension: { src: "192.168.16.1" } }), lookup)).toBeNull();
	});

	it("acha um MAC escrito dentro da mensagem", () => {
		const ev = makeEvent({ extension: { msg: "Client aa:bb:cc:00:00:02 roamed to AP" } });
		expect(findEventClient(ev, lookup)).toBe(outro);
	});

	it("MAC vence IP quando o evento cita os dois", () => {
		const ev = makeEvent({ extension: { src: "192.168.16.10", UNIFIclientMac: "aa:bb:cc:00:00:02" } });
		expect(findEventClient(ev, lookup)).toBe(outro);
	});

	it("evento que não cita nenhum cliente conhecido devolve null", () => {
		expect(findEventClient(makeEvent({ extension: { msg: "Gateway reiniciado" } }), lookup)).toBeNull();
		expect(findEventClient(makeEvent({ extension: {} }), lookup)).toBeNull();
	});
});
