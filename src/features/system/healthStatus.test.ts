// src/features/system/healthStatus.test.ts
import { describe, expect, it } from "vitest";
import {
	evaluateHealth,
	formatAge,
	overallLevel,
	serviceAlerts,
	type HealthSnapshot,
} from "./healthStatus";

const MIN = 60_000;
const SERVER_NOW = Date.parse("2026-11-24T15:00:00Z");
const ago = (minutes: number) => new Date(SERVER_NOW - minutes * MIN).toISOString();

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
	return {
		server_time: new Date(SERVER_NOW).toISOString(),
		unifi_poller: ago(1),
		site_check: ago(10),
		network_events: ago(5),
		app_logs: ago(5),
		windows_logs: ago(60),
		process_logs: ago(600),
		...overrides,
	};
}

const evaluate = (s: HealthSnapshot, elapsedMs = 0) => evaluateHealth(s, 1_000_000, 1_000_000 + elapsedMs);
const level = (s: HealthSnapshot, key: string, elapsedMs = 0) =>
	evaluate(s, elapsedMs).find((i) => i.key === key)!.level;

describe("evaluateHealth: limites", () => {
	it("poller: até 3 min em dia, depois atrasado, depois de 10 min parado", () => {
		expect(level(snapshot({ unifi_poller: ago(3) }), "unifi_poller")).toBe("ok");
		expect(level(snapshot({ unifi_poller: ago(3.1) }), "unifi_poller")).toBe("warn");
		expect(level(snapshot({ unifi_poller: ago(10) }), "unifi_poller")).toBe("warn");
		expect(level(snapshot({ unifi_poller: ago(10.1) }), "unifi_poller")).toBe("stale");
	});

	it("checagem de sites tolera uma rodada perdida (35 min) mas não duas (90 min)", () => {
		expect(level(snapshot({ site_check: ago(35) }), "site_check")).toBe("ok");
		expect(level(snapshot({ site_check: ago(60) }), "site_check")).toBe("warn");
		expect(level(snapshot({ site_check: ago(91) }), "site_check")).toBe("stale");
	});

	it("tudo recente: todos em dia", () => {
		expect(evaluate(snapshot()).every((i) => i.level === "ok")).toBe(true);
	});

	it("sem nenhum dado vira 'unknown', nunca alerta", () => {
		const items = evaluate(snapshot({ unifi_poller: null, app_logs: null }));
		expect(items.find((i) => i.key === "unifi_poller")?.level).toBe("unknown");
		expect(items.find((i) => i.key === "unifi_poller")?.ageMs).toBeNull();
		expect(serviceAlerts(items)).toEqual([]);
	});

	it("data inválida vira 'unknown'", () => {
		expect(level(snapshot({ unifi_poller: "lixo" }), "unifi_poller")).toBe("unknown");
	});
});

describe("evaluateHealth: relógio", () => {
	it("a idade é medida pela hora do SERVIDOR: o relógio do navegador não interfere", () => {
		const s = snapshot({ unifi_poller: ago(5) });
		const a = evaluateHealth(s, 1_000, 1_000).find((i) => i.key === "unifi_poller")!;
		const b = evaluateHealth(s, 9_999_999_999, 9_999_999_999).find((i) => i.key === "unifi_poller")!;
		expect(a.ageMs).toBe(5 * MIN);
		expect(b.ageMs).toBe(5 * MIN);
	});

	it("entre uma consulta e outra, a idade continua crescendo", () => {
		const s = snapshot({ unifi_poller: ago(2) });
		expect(level(s, "unifi_poller", 0)).toBe("ok");
		expect(level(s, "unifi_poller", 2 * MIN)).toBe("warn"); // 2 + 2 = 4 min
		expect(level(s, "unifi_poller", 9 * MIN)).toBe("stale"); // 2 + 9 = 11 min
	});

	it("data do dado no futuro (relógios desencontrados) não gera idade negativa", () => {
		const item = evaluate(snapshot({ unifi_poller: ago(-5) })).find((i) => i.key === "unifi_poller")!;
		expect(item.ageMs).toBe(0);
		expect(item.level).toBe("ok");
	});
});

describe("serviceAlerts / overallLevel", () => {
	it("só serviços atrasados ou parados entram no alerta; fontes ficam de fora", () => {
		const items = evaluate(
			snapshot({ unifi_poller: ago(20), site_check: ago(60), app_logs: ago(5000), process_logs: ago(99999) }),
		);
		expect(serviceAlerts(items).map((i) => i.key)).toEqual(["unifi_poller", "site_check"]);
	});

	it("o estado geral é o pior entre os serviços, ignorando as fontes", () => {
		expect(overallLevel(evaluate(snapshot()))).toBe("ok");
		expect(overallLevel(evaluate(snapshot({ site_check: ago(60) })))).toBe("warn");
		expect(overallLevel(evaluate(snapshot({ site_check: ago(60), unifi_poller: ago(30) })))).toBe("stale");
		expect(overallLevel(evaluate(snapshot({ app_logs: ago(99999) })))).toBe("ok");
	});

	it("sem dado em nenhum serviço, o geral é 'unknown'", () => {
		expect(overallLevel(evaluate(snapshot({ unifi_poller: null, site_check: null })))).toBe("unknown");
	});
});

describe("formatAge", () => {
	it("cobre cada faixa", () => {
		expect(formatAge(null)).toBe("sem registro");
		expect(formatAge(30_000)).toBe("agora há pouco");
		expect(formatAge(5 * MIN)).toBe("há 5 min");
		expect(formatAge(3 * 60 * MIN)).toBe("há 3 h");
		expect(formatAge(47 * 60 * MIN)).toBe("há 47 h");
		expect(formatAge(72 * 60 * MIN)).toBe("há 3 d");
	});
});
