// src/features/network/wanHistory.test.ts
import { describe, expect, it } from "vitest";
import { buildWanChartData, summarizeLoss, summarizeWan, type WanHistoryPoint } from "./wanHistory";

const T0 = Date.parse("2026-11-24T17:00:00Z");
const MIN = 60_000;

function point(minute: number, overrides: Partial<WanHistoryPoint> = {}): WanHistoryPoint {
	return {
		t: new Date(T0 + minute * MIN).toISOString(),
		rx_bps: 6_000_000,
		rx_bps_max: 7_000_000,
		tx_bps: 1_000_000,
		tx_bps_max: 2_000_000,
		latency_ms: 10,
		latency_ms_max: 15,
		samples: 5,
		down_samples: 0,
		...overrides,
	};
}

describe("buildWanChartData", () => {
	it("cria um ponto por balde e deixa null onde não há amostra", () => {
		const data = buildWanChartData([point(0), point(10)], 300, T0, T0 + 15 * MIN);
		expect(data.map((d) => d.t)).toEqual([T0, T0 + 5 * MIN, T0 + 10 * MIN]);
		expect(data[0].rx).toBe(6_000_000);
		expect(data[1]).toMatchObject({ rx: null, tx: null, latency: null, down: false });
		expect(data[2].latencyMax).toBe(15);
	});

	it("alinha o primeiro balde ao epoch, como o SQL", () => {
		const data = buildWanChartData([point(0)], 300, T0 + 2 * MIN, T0 + 6 * MIN);
		expect(data[0].t).toBe(T0);
		expect(data[0].rx).toBe(6_000_000);
	});

	it("marca balde com amostra fora do ar e ignora horário inválido", () => {
		const data = buildWanChartData(
			[point(0, { down_samples: 1 }), { ...point(5), t: "lixo" }],
			300,
			T0,
			T0 + 20 * MIN,
		);
		expect(data[0].down).toBe(true);
		expect(data[1].rx).toBeNull();
	});
});

describe("buildWanChartData — fim da série", () => {
	it("descarta os minutos finais ainda sem amostra (poller grava depois)", () => {
		// Agora = 17:09:30, passo de 1 min; amostras até 17:07.
		const points = Array.from({ length: 8 }, (_, i) => point(i));
		const data = buildWanChartData(points, 60, T0, T0 + 9.5 * MIN);
		expect(data[data.length - 1].t).toBe(T0 + 7 * MIN);
	});

	it("mantém o buraco quando a falta é antiga (poller parado)", () => {
		// Última amostra às 17:00, agora 17:20: só os 3 últimos min (passo + 2) são
		// "ainda não chegou"; os vazios de 17:01 até 17:16 ficam como buraco.
		const data = buildWanChartData([point(0)], 60, T0, T0 + 20 * MIN);
		expect(data[data.length - 1].t).toBe(T0 + 16 * MIN);
		expect(data[data.length - 1].rx).toBeNull();
	});

	it("balde final com dado não é cortado", () => {
		const data = buildWanChartData([point(0), point(5)], 300, T0, T0 + 6 * MIN);
		expect(data[data.length - 1].rx).toBe(6_000_000);
	});
});

describe("perda de pacotes", () => {
	it("cai no balde do mesmo instante; os outros minutos ficam null", () => {
		const data = buildWanChartData(
			Array.from({ length: 6 }, (_, i) => point(i)),
			60,
			T0,
			T0 + 6 * MIN,
			[{ t: new Date(T0 + 5 * MIN).toISOString(), packet_loss_pct: 1.1, packet_loss_max: 1.1 }],
		);
		expect(data[5].loss).toBe(1.1);
		expect(data[4].loss).toBeNull();
	});

	it("resumo: média dos intervalos e o pior", () => {
		expect(
			summarizeLoss([
				{ t: "a", packet_loss_pct: 0, packet_loss_max: 0 },
				{ t: "b", packet_loss_pct: 1.2, packet_loss_max: 3 },
				{ t: "c", packet_loss_pct: null, packet_loss_max: null },
			]),
		).toEqual({ avg: 0.6, max: 3 });
		expect(summarizeLoss([])).toEqual({ avg: null, max: null });
	});
});

describe("summarizeWan", () => {
	it("média, pico e disponibilidade por amostras", () => {
		const summary = summarizeWan([
			point(0, { rx_bps: 4_000_000, rx_bps_max: 9_000_000, samples: 5, down_samples: 1 }),
			point(5, { rx_bps: 8_000_000, latency_ms: null, latency_ms_max: null, samples: 5 }),
		]);
		expect(summary.rxAvg).toBe(6_000_000);
		expect(summary.rxPeak).toBe(9_000_000);
		expect(summary.latencyAvg).toBe(10);
		expect(summary.latencyMax).toBe(15);
		expect(summary.uptimePct).toBe(90);
		expect(summary.samples).toBe(10);
	});

	it("sem pontos: tudo null", () => {
		expect(summarizeWan([])).toEqual({
			rxAvg: null,
			rxPeak: null,
			txAvg: null,
			txPeak: null,
			latencyAvg: null,
			latencyMax: null,
			uptimePct: null,
			samples: 0,
		});
	});
});
