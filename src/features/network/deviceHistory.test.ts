// src/features/network/deviceHistory.test.ts
import { describe, expect, it } from "vitest";
import {
	buildDeviceChartData,
	formatDelta,
	summarizeDevice,
	type DeviceHistoryPoint,
} from "./deviceHistory";

const T0 = Date.parse("2026-11-24T17:00:00Z");
const MIN = 60_000;

function point(minute: number, overrides: Partial<DeviceHistoryPoint> = {}): DeviceHistoryPoint {
	return {
		t: new Date(T0 + minute * MIN).toISOString(),
		cpu_pct: 30,
		cpu_pct_max: 40,
		memory_pct: 67,
		memory_pct_max: 68,
		samples: 1,
		...overrides,
	};
}

describe("buildDeviceChartData", () => {
	it("preenche baldes sem amostra com null e corta o fim ainda não gravado", () => {
		const data = buildDeviceChartData([point(0), point(2), point(3)], 60, T0, T0 + 5.5 * MIN);
		expect(data.map((d) => d.t)).toEqual([T0, T0 + MIN, T0 + 2 * MIN, T0 + 3 * MIN]);
		expect(data[1].memory).toBeNull();
		expect(data[3].cpuMax).toBe(40);
	});
});

describe("summarizeDevice", () => {
	it("médias, máximos e variação da memória do primeiro ao último ponto", () => {
		const s = summarizeDevice([
			point(0, { memory_pct: 66, cpu_pct: 20 }),
			point(1, { memory_pct: null, cpu_pct: null, cpu_pct_max: null, memory_pct_max: null }),
			point(2, { memory_pct: 69.5, cpu_pct: 40, cpu_pct_max: 55, memory_pct_max: 70 }),
		]);
		expect(s.cpuAvg).toBe(30);
		expect(s.cpuMax).toBe(55);
		expect(s.memoryMax).toBe(70);
		expect(s.memoryDelta).toBeCloseTo(3.5);
	});

	it("menos de 2 pontos de memória: sem variação", () => {
		expect(summarizeDevice([point(0)]).memoryDelta).toBeNull();
		expect(summarizeDevice([]).cpuAvg).toBeNull();
	});
});

describe("formatDelta", () => {
	it("sinal, p.p. e 'estável' para variação pequena", () => {
		expect(formatDelta(3.24)).toBe("+3,2 p.p.");
		expect(formatDelta(-1)).toBe("−1 p.p.");
		expect(formatDelta(0.3)).toBe("estável");
		expect(formatDelta(null)).toBe("—");
	});
});
