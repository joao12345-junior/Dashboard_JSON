// src/features/network/sessionTimeline.test.ts
import { describe, expect, it } from "vitest";
import { buildTimeline, formatMinutes } from "./sessionTimeline";
import type { ClientSession } from "./hooks/useNetworkExtras";

// Datas em horário LOCAL, como a função usa; assim o teste não depende do fuso da máquina.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute, 0);
const session = (from: Date, to: Date | null): ClientSession => ({
	connected_at: from.toISOString(),
	disconnected_at: to ? to.toISOString() : null,
	ip_address: null,
	uplink_mac: null,
	uplink_name: null,
});

describe("buildTimeline", () => {
	const now = local(24, 15);

	it("devolve um item por dia, do mais recente para o mais antigo", () => {
		const days = buildTimeline([], now, 3);
		expect(days).toHaveLength(3);
		expect(days[0].dayStart.getDate()).toBe(24);
		expect(days[2].dayStart.getDate()).toBe(22);
		expect(days[0].connectedMinutes).toBe(0);
	});

	it("sessão fechada dentro do dia vira um segmento em % do dia", () => {
		const [today] = buildTimeline([session(local(24, 6), local(24, 12))], now, 1);
		expect(today.segments).toHaveLength(1);
		expect(today.segments[0].startPct).toBeCloseTo(25, 5);
		expect(today.segments[0].endPct).toBeCloseTo(50, 5);
		expect(today.connectedMinutes).toBe(360);
	});

	it("sessão aberta vai até agora e nunca conta o futuro", () => {
		const [today] = buildTimeline([session(local(24, 12), null)], now, 1);
		expect(today.connectedMinutes).toBe(180);
		expect(today.segments[0].endPct).toBeCloseTo((15 / 24) * 100, 5);
	});

	it("sessão que atravessa a meia-noite é dividida entre os dois dias", () => {
		const days = buildTimeline([session(local(23, 22), local(24, 2))], now, 2);
		expect(days[1].connectedMinutes).toBe(120); // 23/11: 22h–24h
		expect(days[0].connectedMinutes).toBe(120); // 24/11: 0h–2h
		expect(days[1].segments[0].endPct).toBeCloseTo(100, 5);
		expect(days[0].segments[0].startPct).toBeCloseTo(0, 5);
	});

	it("ordena os segmentos do dia pela hora de início", () => {
		const [today] = buildTimeline(
			[session(local(24, 10), local(24, 11)), session(local(24, 2), local(24, 3))],
			now,
			1,
		);
		expect(today.segments[0].startPct).toBeLessThan(today.segments[1].startPct);
	});

	it("ignora sessão fora da janela", () => {
		const [today] = buildTimeline([session(local(10, 8), local(10, 9))], now, 1);
		expect(today.segments).toEqual([]);
	});
});

describe("formatMinutes", () => {
	it("formata horas e minutos", () => {
		expect(formatMinutes(0)).toBe("0 min");
		expect(formatMinutes(45)).toBe("45 min");
		expect(formatMinutes(60)).toBe("1 h");
		expect(formatMinutes(200)).toBe("3 h 20 min");
	});
});
