// src/features/network/wanHistory.ts
//
// Regras puras do gráfico "Internet" (aba Infraestrutura): transforma os pontos que a
// API devolve (`GET /api/network/wan/history`) em séries prontas para o recharts e em
// números de resumo. Sem React e sem fetch, por isso é testado com vitest.

export type WanPeriodKey = "1h" | "1d" | "1w" | "1m";

export const WAN_PERIODS: ReadonlyArray<{ value: WanPeriodKey; label: string }> = [
	{ value: "1h", label: "1 h" },
	{ value: "1d", label: "1 dia" },
	{ value: "1w", label: "1 semana" },
	{ value: "1m", label: "1 mês" },
];

/** Um ponto agregado, como a API devolve. */
export interface WanHistoryPoint {
	/** Início do balde (ISO). */
	t: string;
	rx_bps: number | null;
	rx_bps_max: number | null;
	tx_bps: number | null;
	tx_bps_max: number | null;
	latency_ms: number | null;
	latency_ms_max: number | null;
	samples: number;
	down_samples: number;
}

/** Perda de pacotes agregada (intervalos de no mínimo 5 min, como o UniFi mede). */
export interface WanQualityPoint {
	t: string;
	packet_loss_pct: number | null;
	packet_loss_max: number | null;
}

export interface WanHistoryResponse {
	period: WanPeriodKey;
	step_seconds: number;
	span_seconds: number;
	server_time: string;
	/** Pontos por WAN ("WAN", "WAN2"...). */
	series: Record<string, WanHistoryPoint[]>;
	/** Perda de pacotes por WAN; ausente em API antiga ou sem a migração 021. */
	quality?: Record<string, WanQualityPoint[]>;
}

/** Ponto do gráfico. `null` = sem amostra naquele balde (a linha quebra ali). */
export interface WanChartPoint {
	/** Início do balde em ms (eixo X numérico). */
	t: number;
	rx: number | null;
	tx: number | null;
	rxMax: number | null;
	latency: number | null;
	latencyMax: number | null;
	/** Alguma amostra do balde com a WAN fora do ar. */
	down: boolean;
	/** Perda de pacotes (%) no balde; null onde não há medição (é de 5 em 5 min). */
	loss: number | null;
}

/**
 * Quanto do fim da série pode estar vazio só porque o poller ainda não gravou: ele
 * grava a cada ~60 s, então o minuto em andamento (e às vezes o anterior) ainda não
 * tem amostra. Buracos mais antigos que isso são reais (poller parado) e ficam.
 */
export const PENDING_TAIL_MS = 2 * 60_000;

/// <summary>
/// Monta a série contínua de [since, until): um ponto por balde de `stepSeconds`,
/// mesmo onde não há amostra (com valores null). Sem isso o recharts ligaria dois
/// pontos distantes com uma reta e "esconderia" o período em que o poller ficou
/// parado. A falta de amostra aparece como buraco, nunca como tráfego zero.
/// Exceção: os baldes vazios do FIM que começam nos últimos `step + 2 min` são
/// descartados, porque são "ainda não chegou", não "faltou" (o minuto 15:51 só
/// recebe dado logo depois das 15:52).
/// </summary>
export function buildWanChartData(
	points: readonly WanHistoryPoint[],
	stepSeconds: number,
	since: number,
	until: number,
	quality: readonly WanQualityPoint[] = [],
): WanChartPoint[] {
	const step = stepSeconds * 1000;
	const byStart = new Map<number, WanHistoryPoint>();
	for (const p of points) {
		const t = Date.parse(p.t);
		if (!Number.isNaN(t)) byStart.set(t, p);
	}
	// Os baldes de perda são de >= 5 min, alinhados ao epoch: caem no balde do gráfico
	// que começa no mesmo instante (5 min é múltiplo de 1 min).
	const lossByStart = new Map<number, number | null>();
	for (const q of quality) {
		const t = Date.parse(q.t);
		if (!Number.isNaN(t)) lossByStart.set(t, q.packet_loss_pct);
	}

	const data: WanChartPoint[] = [];
	// Baldes alinhados ao epoch, como no SQL (floor(epoch / step) * step).
	for (let t = Math.floor(since / step) * step; t < until; t += step) {
		const p = byStart.get(t);
		data.push({
			t,
			rx: p?.rx_bps ?? null,
			tx: p?.tx_bps ?? null,
			rxMax: p?.rx_bps_max ?? null,
			latency: p?.latency_ms ?? null,
			latencyMax: p?.latency_ms_max ?? null,
			down: (p?.down_samples ?? 0) > 0,
			loss: lossByStart.get(t) ?? null,
		});
	}
	const pendingFrom = until - step - PENDING_TAIL_MS;
	while (data.length > 0) {
		const last = data[data.length - 1];
		const empty = last.rx === null && last.tx === null && last.latency === null && last.loss === null;
		if (!empty || last.t < pendingFrom) break;
		data.pop();
	}
	return data;
}

/** Perda de pacotes do período: média dos intervalos e o pior intervalo. */
export function summarizeLoss(quality: readonly WanQualityPoint[]): { avg: number | null; max: number | null } {
	const avgs = quality.map((q) => q.packet_loss_pct).filter((v): v is number => v !== null);
	const maxes = quality.map((q) => q.packet_loss_max).filter((v): v is number => v !== null);
	return {
		avg: avgs.length === 0 ? null : avgs.reduce((a, b) => a + b, 0) / avgs.length,
		max: maxes.length === 0 ? null : Math.max(...maxes),
	};
}

export interface WanSummary {
	/** Média das médias dos baldes (bits/s). */
	rxAvg: number | null;
	/** Maior pico (máximo dentro dos baldes). */
	rxPeak: number | null;
	txAvg: number | null;
	txPeak: number | null;
	latencyAvg: number | null;
	latencyMax: number | null;
	/** % das amostras com a WAN no ar. null = sem amostra. */
	uptimePct: number | null;
	samples: number;
}

function average(values: number[]): number | null {
	return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function maximum(values: number[]): number | null {
	return values.length === 0 ? null : Math.max(...values);
}

function present(values: Array<number | null>): number[] {
	return values.filter((v): v is number => v !== null);
}

/// <summary>
/// Números do resumo acima do gráfico. A disponibilidade é calculada pelas AMOSTRAS
/// (minutos em que o poller viu a WAN fora / total), não pelos baldes.
/// </summary>
export function summarizeWan(points: readonly WanHistoryPoint[]): WanSummary {
	const samples = points.reduce((sum, p) => sum + p.samples, 0);
	const down = points.reduce((sum, p) => sum + p.down_samples, 0);
	return {
		rxAvg: average(present(points.map((p) => p.rx_bps))),
		rxPeak: maximum(present(points.map((p) => p.rx_bps_max))),
		txAvg: average(present(points.map((p) => p.tx_bps))),
		txPeak: maximum(present(points.map((p) => p.tx_bps_max))),
		latencyAvg: average(present(points.map((p) => p.latency_ms))),
		latencyMax: maximum(present(points.map((p) => p.latency_ms_max))),
		uptimePct: samples === 0 ? null : ((samples - down) / samples) * 100,
		samples,
	};
}

/** Formato da hora no eixo X: só hora no período de 1 h/1 dia, dia + hora no resto. */
export function formatAxisTime(ms: number, period: WanPeriodKey): string {
	const options: Intl.DateTimeFormatOptions =
		period === "1h" || period === "1d"
			? { hour: "2-digit", minute: "2-digit" }
			: period === "1w"
				? { weekday: "short", day: "2-digit", hour: "2-digit" }
				: { day: "2-digit", month: "2-digit" };
	return new Date(ms).toLocaleString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		hour12: false,
		...options,
	});
}
