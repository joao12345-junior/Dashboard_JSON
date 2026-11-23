// src/features/network/sessionTimeline.ts
import type { ClientSession } from "./hooks/useNetworkExtras";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimelineSegment {
	/** Início e fim dentro do dia, em % (0–100). */
	startPct: number;
	endPct: number;
}

export interface TimelineDay {
	/** Meia-noite local do dia. */
	dayStart: Date;
	segments: TimelineSegment[];
	/** Minutos conectado no dia (sem contar o futuro). */
	connectedMinutes: number;
}

/// <summary>
/// Converte as sessões em uma faixa por dia (horário local do navegador), do dia
/// mais recente para o mais antigo. Sessão aberta (`disconnected_at` null) vai até
/// `now`. Função pura: testável sem React.
/// </summary>
export function buildTimeline(sessions: readonly ClientSession[], now: Date, days: number): TimelineDay[] {
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	const ranges = sessions.map((s) => [
		new Date(s.connected_at).getTime(),
		s.disconnected_at ? new Date(s.disconnected_at).getTime() : now.getTime(),
	]);
	const result: TimelineDay[] = [];
	for (let i = 0; i < days; i++) {
		const dayStart = new Date(today);
		dayStart.setDate(today.getDate() - i);
		const start = dayStart.getTime();
		const next = new Date(dayStart);
		next.setDate(dayStart.getDate() + 1);
		const end = next.getTime();
		const length = end - start || DAY_MS; // dia de 23/25 h no horário de verão
		const segments: TimelineSegment[] = [];
		let ms = 0;
		for (const [a, b] of ranges) {
			const from = Math.max(a, start);
			const to = Math.min(b, end, now.getTime());
			if (to <= from) continue;
			ms += to - from;
			segments.push({ startPct: ((from - start) / length) * 100, endPct: ((to - start) / length) * 100 });
		}
		segments.sort((x, y) => x.startPct - y.startPct);
		result.push({ dayStart, segments, connectedMinutes: Math.round(ms / 60000) });
	}
	return result;
}

/** "3 h 20 min", "45 min", "0 min". */
export function formatMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
