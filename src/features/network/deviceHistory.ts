// src/features/network/deviceHistory.ts
//
// Regras puras do gráfico de CPU e memória dos dispositivos UniFi (Rede > Painel).
// Mesmo desenho do gráfico de Internet (`wanHistory.ts`): baldes sem amostra viram
// null (a linha quebra) e o fim "ainda não gravado" é descartado.
import { PENDING_TAIL_MS, type WanPeriodKey } from "./wanHistory";

/** Um ponto agregado, como `GET /api/network/devices/<mac>/history` devolve. */
export interface DeviceHistoryPoint {
	t: string;
	cpu_pct: number | null;
	cpu_pct_max: number | null;
	memory_pct: number | null;
	memory_pct_max: number | null;
	samples: number;
}

export interface DeviceHistoryResponse {
	period: WanPeriodKey;
	step_seconds: number;
	span_seconds: number;
	server_time: string;
	mac: string;
	points: DeviceHistoryPoint[];
}

export interface DeviceChartPoint {
	t: number;
	cpu: number | null;
	cpuMax: number | null;
	memory: number | null;
	memoryMax: number | null;
}

/// <summary>
/// Série contínua de [since, until), um ponto por balde; null onde não há amostra.
/// Baldes vazios do FIM que começam nos últimos `step + 2 min` são descartados
/// (o poller ainda não gravou), como no gráfico de Internet.
/// </summary>
export function buildDeviceChartData(
	points: readonly DeviceHistoryPoint[],
	stepSeconds: number,
	since: number,
	until: number,
): DeviceChartPoint[] {
	const step = stepSeconds * 1000;
	const byStart = new Map<number, DeviceHistoryPoint>();
	for (const p of points) {
		const t = Date.parse(p.t);
		if (!Number.isNaN(t)) byStart.set(t, p);
	}
	const data: DeviceChartPoint[] = [];
	for (let t = Math.floor(since / step) * step; t < until; t += step) {
		const p = byStart.get(t);
		data.push({
			t,
			cpu: p?.cpu_pct ?? null,
			cpuMax: p?.cpu_pct_max ?? null,
			memory: p?.memory_pct ?? null,
			memoryMax: p?.memory_pct_max ?? null,
		});
	}
	const pendingFrom = until - step - PENDING_TAIL_MS;
	while (data.length > 0) {
		const last = data[data.length - 1];
		if (last.cpu !== null || last.memory !== null || last.t < pendingFrom) break;
		data.pop();
	}
	return data;
}

export interface DeviceSummary {
	cpuAvg: number | null;
	cpuMax: number | null;
	memoryAvg: number | null;
	memoryMax: number | null;
	/**
	 * Memória no último ponto menos a do primeiro (pontos percentuais). Mostra se
	 * subiu no período, que é a pergunta de quem abre o gráfico. null com menos de 2 pontos.
	 */
	memoryDelta: number | null;
}

/** Resumo do período (médias das médias, máximos dos máximos, variação da memória). */
export function summarizeDevice(points: readonly DeviceHistoryPoint[]): DeviceSummary {
	const cpu = points.map((p) => p.cpu_pct).filter((v): v is number => v !== null);
	const cpuMax = points.map((p) => p.cpu_pct_max).filter((v): v is number => v !== null);
	const memory = points.map((p) => p.memory_pct).filter((v): v is number => v !== null);
	const memoryMax = points.map((p) => p.memory_pct_max).filter((v): v is number => v !== null);
	const avg = (v: number[]) => (v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length);
	const max = (v: number[]) => (v.length === 0 ? null : Math.max(...v));
	return {
		cpuAvg: avg(cpu),
		cpuMax: max(cpuMax),
		memoryAvg: avg(memory),
		memoryMax: max(memoryMax),
		memoryDelta: memory.length < 2 ? null : memory[memory.length - 1] - memory[0],
	};
}

/** "+3,2 p.p.", "−0,4 p.p.", "estável" (|Δ| < 0,5). */
export function formatDelta(delta: number | null): string {
	if (delta === null) return "—";
	if (Math.abs(delta) < 0.5) return "estável";
	const sign = delta > 0 ? "+" : "−";
	return `${sign}${Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
}
