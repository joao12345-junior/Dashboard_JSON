// src/lib/dayLabel.ts

/**
 * Converte um Date no formato "AAAA-MM-DD" usando o fuso LOCAL do navegador.
 * (`toISOString()` usaria UTC e, à noite no Brasil, devolveria o dia seguinte.)
 */
export function toLocalIsoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * Rótulo legível para o cabeçalho de um dia da lista.
 *
 *   "2026-11-19" (hoje)  → "Hoje · quinta-feira, 19/11/2026"
 *   "2026-11-18"         → "Ontem · quarta-feira, 18/11/2026"
 *   "2026-11-12"         → "quinta-feira, 12/11/2026"
 *
 * `isoDate` vem dos mappers (já em "relógio de parede", sem fuso) e é
 * interpretado como data de calendário, sem conversão.
 * `now` é parâmetro para a função continuar pura e testável.
 */
export function formatDayLabel(isoDate: string, now: Date = new Date()): string {
	const [y, m, d] = isoDate.split("-").map(Number);
	if (!y || !m || !d) return isoDate || "Sem data";

	const day = new Date(y, m - 1, d);
	const weekday = day.toLocaleDateString("pt-BR", { weekday: "long" });
	const date = `${weekday}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;

	const today = toLocalIsoDate(now);
	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(now.getDate() - 1);
	const yesterday = toLocalIsoDate(yesterdayDate);

	// Sem "text-transform: capitalize" no CSS: ele deixaria "Quinta-Feira".
	// Só a primeira letra vai em maiúscula, e só quando não há prefixo.
	if (isoDate === today) return `Hoje · ${date}`;
	if (isoDate === yesterday) return `Ontem · ${date}`;
	return date.charAt(0).toUpperCase() + date.slice(1);
}
