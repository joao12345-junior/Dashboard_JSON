// src/lib/formatElapsed.ts

/** Minutos desde "HH:MM[:SS]" até "HH:MM[:SS]" no mesmo dia; nunca negativo. */
export function minutesBetween(fromTime: string, toTime: string): number {
	const toMinutes = (t: string): number => {
		const [h, m] = t.split(":").map(Number);
		return (h || 0) * 60 + (m || 0);
	};
	return Math.max(0, toMinutes(toTime) - toMinutes(fromTime));
}

/**
 * "agora", "há 12 min", "há 3 h", "há 3 h 57 min".
 * Para "último erro há …" — quanto tempo o sistema está sem erro novo.
 */
export function formatElapsed(minutes: number): string {
	if (minutes < 1) return "agora";
	if (minutes < 60) return `há ${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `há ${h} h` : `há ${h} h ${m} min`;
}
