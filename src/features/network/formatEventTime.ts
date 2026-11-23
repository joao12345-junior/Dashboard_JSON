// src/features/network/formatEventTime.ts

const TIMEZONE = "America/Sao_Paulo";

/** Dia (AAAA-MM-DD) em Brasília, para agrupar a lista e para os chips Hoje/Ontem. */
export function eventDayKey(iso: string): string {
	// O locale en-CA formata como AAAA-MM-DD.
	return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Hora (HH:MM:SS, 24 h) em Brasília. */
export function eventClock(iso: string): string {
	return new Date(iso).toLocaleTimeString("pt-BR", {
		timeZone: TIMEZONE,
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

/** Data/hora em Brasília, com segundos (eventos de rede acontecem em rajadas). */
export function formatEventTime(iso: string): string {
	return new Date(iso).toLocaleString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}
