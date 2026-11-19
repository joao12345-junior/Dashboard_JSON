// src/lib/dayOverview.ts
import type { Log } from "./types/Log";
import { toLocalIsoDate } from "./dayLabel";
import { formatElapsed, minutesBetween } from "./formatElapsed";
import { isCriticalLog, isWarningLog } from "./logSeverity";

/** Contagem de um indicador (erros ou avisos) no dia de hoje, com contexto. */
export interface DayKpi {
	today: number;
	/** Ontem, só até a hora atual: comparação justa com um dia em andamento. */
	yesterdayUntilNow: number;
	/**
	 * Média diária dos 7 dias anteriores a hoje, considerando só os dias em que
	 * o sistema registrou algo (um dia sem nenhum log não é "dia sem erro").
	 * null = nenhum dia com registro nessa janela.
	 */
	weekAverage: number | null;
}

/** Data e hora (como gravadas no log) do registro mais recente. */
export interface Stamp {
	date: string;
	time: string;
}

export interface LastSeen {
	process: Stamp | null;
	windows: Stamp | null;
	app: Stamp | null;
	/** O mais recente entre todos os tipos. */
	any: Stamp | null;
}

export interface DayOverview {
	errors: DayKpi;
	warnings: DayKpi;
	lastSeen: LastSeen;
}

/** Soma `days` (pode ser negativo) a uma data "AAAA-MM-DD", em calendário local. */
export function shiftIsoDate(iso: string, days: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	return toLocalIsoDate(new Date(y, m - 1, d + days));
}

const WEEK_DAYS = 7;

function newer(a: Stamp | null, b: Stamp): Stamp {
	if (!a) return b;
	return `${b.date}T${b.time}` > `${a.date}T${a.time}` ? b : a;
}

/**
 * Resumo do dia em UMA passada pelos logs: erros e avisos de hoje (vs ontem até
 * agora e vs média da semana) e quando cada fonte registrou algo pela última vez.
 *
 * `nowTime` é "HH:MM" ou "HH:MM:SS" (só compara texto: os horários já vêm
 * padronizados "HH:MM:SS" dos mappers, então a ordem alfabética é a cronológica).
 */
export function summarizeDayOverview(
	logs: Log[],
	todayIso: string,
	nowTime: string,
): DayOverview {
	const yesterdayIso = shiftIsoDate(todayIso, -1);
	const weekDates = new Set<string>();
	for (let i = 1; i <= WEEK_DAYS; i++) weekDates.add(shiftIsoDate(todayIso, -i));

	const activeDays = new Set<string>();
	const acc = {
		errors: { today: 0, yesterdayUntilNow: 0, week: 0 },
		warnings: { today: 0, yesterdayUntilNow: 0, week: 0 },
	};
	const lastSeen: LastSeen = { process: null, windows: null, app: null, any: null };

	for (const log of logs) {
		const stamp: Stamp = { date: log.date, time: log.time };
		lastSeen.any = newer(lastSeen.any, stamp);
		if (log.logType === "process") lastSeen.process = newer(lastSeen.process, stamp);
		else if (log.logType === "windows-event")
			lastSeen.windows = newer(lastSeen.windows, stamp);
		else lastSeen.app = newer(lastSeen.app, stamp);

		const inWeek = weekDates.has(log.date);
		if (inWeek) activeDays.add(log.date);

		const kinds: Array<["errors" | "warnings", boolean]> = [
			["errors", isCriticalLog(log)],
			["warnings", isWarningLog(log)],
		];
		for (const [kind, matches] of kinds) {
			if (!matches) continue;
			if (log.date === todayIso) acc[kind].today += 1;
			else if (log.date === yesterdayIso && log.time <= nowTime)
				acc[kind].yesterdayUntilNow += 1;
			if (inWeek) acc[kind].week += 1;
		}
	}

	const average = (week: number): number | null =>
		activeDays.size === 0 ? null : Math.round((week / activeDays.size) * 10) / 10;

	return {
		errors: {
			today: acc.errors.today,
			yesterdayUntilNow: acc.errors.yesterdayUntilNow,
			weekAverage: average(acc.errors.week),
		},
		warnings: {
			today: acc.warnings.today,
			yesterdayUntilNow: acc.warnings.yesterdayUntilNow,
			weekAverage: average(acc.warnings.week),
		},
		lastSeen,
	};
}

/**
 * "último registro há 12 min" / "…ontem às 16:18" / "…em 12/11 às 03:00".
 * Sem registro nenhum: "sem registros".
 */
export function describeLastSeen(
	stamp: Stamp | null,
	todayIso: string,
	nowTime: string,
): string {
	if (!stamp) return "sem registros";
	const hhmm = stamp.time.slice(0, 5);
	if (stamp.date === todayIso)
		return `último registro ${formatElapsed(minutesBetween(stamp.time, nowTime))}`;
	if (stamp.date === shiftIsoDate(todayIso, -1))
		return `último registro ontem às ${hhmm}`;
	const [, m, d] = stamp.date.split("-");
	return `último registro em ${d}/${m} às ${hhmm}`;
}

/** Média diária para exibição: "31" (>= 10), "4,5" (< 10). */
export function formatAverage(value: number): string {
	return value.toLocaleString("pt-BR", {
		maximumFractionDigits: value >= 10 ? 0 : 1,
	});
}

/**
 * Quando algo aconteceu, curto e relativo ao dia: "Hoje 13:46", "Ontem 16:18",
 * "12/11 03:00" (com o ano só quando não é o ano de hoje).
 */
export function formatWhen(date: string, time: string, todayIso: string): string {
	const hhmm = time.slice(0, 5);
	if (date === todayIso) return `Hoje ${hhmm}`;
	if (date === shiftIsoDate(todayIso, -1)) return `Ontem ${hhmm}`;
	const [y, m, d] = date.split("-");
	const sameYear = y === todayIso.slice(0, 4);
	return `${d}/${m}${sameYear ? "" : `/${y}`} ${hhmm}`;
}
