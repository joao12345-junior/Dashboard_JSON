// src/lib/errorGroups.ts
import type { Log } from "./types/Log";
import { isCriticalLog } from "./logSeverity";
import { maskNumbers } from "./collapseRepeats";

export type ErrorSource = "process" | "windows-event" | "app";

/** Erros "parecidos" de um dia juntados num só item (mesma origem e mensagem, ignorando números). */
export interface ErrorGroup {
	/** Assinatura: o que torna dois erros "o mesmo erro". */
	key: string;
	source: ErrorSource;
	/** Texto curto de origem para exibição (ex.: "OptOrbia › Enviados", "Backup"). */
	origin: string;
	/** Mensagem do registro mais recente do grupo. */
	message: string;
	count: number;
	/** Hora (HH:MM:SS) da primeira ocorrência do dia. */
	firstTime: string;
	/** Hora (HH:MM:SS) da ocorrência mais recente. */
	lastTime: string;
	/** Dia do grupo (AAAA-MM-DD). */
	date: string;
	/** Só para app: usados para abrir a lista já filtrada. */
	programa: string | null;
	classe: string | null;
	/** Quantas vezes a MESMA assinatura apareceu no outro dia comparado (0 = não apareceu). */
	otherDayCount: number;
}

export interface DayErrorSummary {
	date: string;
	total: number;
	bySource: Record<ErrorSource, number>;
	/** Hora (HH:MM:SS) do erro mais recente do dia; `null` se não houve erro. */
	lastErrorTime: string | null;
	/** Mais frequentes primeiro; empate = ocorrência mais recente primeiro. */
	groups: ErrorGroup[];
}

export interface TodayAndYesterdayErrors {
	today: DayErrorSummary;
	yesterday: DayErrorSummary;
	/** Erros de ontem até a mesma hora do dia de hoje (comparação justa com um dia em andamento). */
	yesterdayUntilNow: number;
}

interface Signature {
	key: string;
	source: ErrorSource;
	origin: string;
	programa: string | null;
	classe: string | null;
}

/** Calcula a assinatura de um erro. Números da mensagem são mascarados ("chamado 142" = "chamado 143"). */
export function errorSignature(log: Log): Signature {
	const text = maskNumbers(log.message);
	if (log.logType === "windows-event") {
		const origin = log.provider || log.channel || "Windows";
		return {
			key: `windows|${origin}|${log.eventId}|${text}`,
			source: "windows-event",
			origin,
			programa: null,
			classe: null,
		};
	}
	if (log.logType === "app") {
		const programa = log.programa ?? null;
		return {
			key: `app|${programa ?? ""}|${log.classe}|${text}`,
			source: "app",
			origin: `${programa ?? "Sem programa"} › ${log.classe}`,
			programa,
			classe: log.classe,
		};
	}
	return {
		key: `process|${text}`,
		source: "process",
		origin: "Backup",
		programa: null,
		classe: null,
	};
}

interface MutableGroup extends Omit<ErrorGroup, "otherDayCount"> {
	lastStamp: string;
}

function emptyBySource(): Record<ErrorSource, number> {
	return { process: 0, "windows-event": 0, app: 0 };
}

/** Hora do erro mais recente do dia (maior `lastTime` entre os grupos). */
function lastTimeOf(day: DayAccumulator): string | null {
	let last: string | null = null;
	for (const group of day.groups.values()) {
		if (last === null || group.lastTime > last) last = group.lastTime;
	}
	return last;
}

/** Agrupa os erros críticos de cada dia (uma passada pela lista). */
interface DayAccumulator {
	total: number;
	bySource: Record<ErrorSource, number>;
	groups: Map<string, MutableGroup>;
}

function groupByDay(logs: Log[], dates: string[]): Map<string, DayAccumulator> {
	const wanted = new Set(dates);
	const days = new Map<string, DayAccumulator>();
	for (const date of dates) {
		days.set(date, { total: 0, bySource: emptyBySource(), groups: new Map() });
	}

	for (const log of logs) {
		if (!wanted.has(log.date) || !isCriticalLog(log)) continue;
		const day = days.get(log.date);
		if (!day) continue;

		const signature = errorSignature(log);
		day.total += 1;
		day.bySource[signature.source] += 1;

		const stamp = `${log.date}T${log.time}`;
		const existing = day.groups.get(signature.key);
		if (!existing) {
			day.groups.set(signature.key, {
				key: signature.key,
				source: signature.source,
				origin: signature.origin,
				message: log.message,
				count: 1,
				firstTime: log.time,
				lastTime: log.time,
				date: log.date,
				programa: signature.programa,
				classe: signature.classe,
				lastStamp: stamp,
			});
		} else {
			existing.count += 1;
			if (log.time < existing.firstTime) existing.firstTime = log.time;
			if (stamp > existing.lastStamp) {
				existing.lastStamp = stamp;
				existing.lastTime = log.time;
				existing.message = log.message;
			}
		}
	}
	return days;
}

/**
 * Principais erros de hoje e de ontem, de todos os tipos de log.
 *
 * `nowTime` ("HH:MM:SS", hora local) serve só para `yesterdayUntilNow`.
 * As datas vêm "como gravadas" nos logs (sem conversão de fuso), igual ao resto do sistema.
 */
export function summarizeTodayAndYesterday(
	logs: Log[],
	todayIso: string,
	yesterdayIso: string,
	nowTime: string,
): TodayAndYesterdayErrors {
	const days = groupByDay(logs, [todayIso, yesterdayIso]);
	const todayDay = days.get(todayIso);
	const yesterdayDay = days.get(yesterdayIso);
	if (!todayDay || !yesterdayDay) throw new Error("datas inválidas");

	const build = (
		date: string,
		own: DayAccumulator,
		other: DayAccumulator,
	): DayErrorSummary => ({
		date,
		total: own.total,
		bySource: own.bySource,
		lastErrorTime: lastTimeOf(own),
		groups: Array.from(own.groups.values())
			.map(
				(group): ErrorGroup => ({
					key: group.key,
					source: group.source,
					origin: group.origin,
					message: group.message,
					count: group.count,
					firstTime: group.firstTime,
					lastTime: group.lastTime,
					date: group.date,
					programa: group.programa,
					classe: group.classe,
					otherDayCount: other.groups.get(group.key)?.count ?? 0,
				}),
			)
			.sort(
				(a, b) =>
					b.count - a.count || b.lastTime.localeCompare(a.lastTime),
			),
	});

	let yesterdayUntilNow = 0;
	for (const log of logs) {
		if (log.date === yesterdayIso && log.time <= nowTime && isCriticalLog(log)) {
			yesterdayUntilNow += 1;
		}
	}

	return {
		today: build(todayIso, todayDay, yesterdayDay),
		yesterday: build(yesterdayIso, yesterdayDay, todayDay),
		yesterdayUntilNow,
	};
}

/** Como ordenar os grupos de erro (mesmas opções da lista de issues do Sentry). */
export type GroupSort = "count" | "recent" | "new";

/**
 * Reordena os grupos (não altera o array original).
 *  - "count":  mais frequentes primeiro (desempate: mais recente);
 *  - "recent": ocorreu por último primeiro (desempate: mais frequente);
 *  - "new":    os que não apareceram no outro dia primeiro, depois por frequência.
 *    `newFirst=false` (coluna de ontem, onde "novo" não tem sentido) cai em "count".
 */
export function sortErrorGroups(
	groups: ErrorGroup[],
	sort: GroupSort,
	newFirst: boolean,
): ErrorGroup[] {
	const byCount = (a: ErrorGroup, b: ErrorGroup) =>
		b.count - a.count || b.lastTime.localeCompare(a.lastTime);
	const copy = [...groups];
	if (sort === "recent")
		return copy.sort(
			(a, b) => b.lastTime.localeCompare(a.lastTime) || b.count - a.count,
		);
	if (sort === "new" && newFirst)
		return copy.sort((a, b) => {
			const aNew = a.otherDayCount === 0 ? 1 : 0;
			const bNew = b.otherDayCount === 0 ? 1 : 0;
			return bNew - aNew || byCount(a, b);
		});
	return copy.sort(byCount);
}
