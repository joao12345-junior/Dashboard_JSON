// src/features/home/useDailyErrors.ts
import { useEffect, useMemo, useState } from "react";
import type { Log } from "../../lib/types/Log";
import { toLocalIsoDate } from "../../lib/dayLabel";
import {
	summarizeTodayAndYesterday,
	type TodayAndYesterdayErrors,
} from "../../lib/errorGroups";
import { summarizeDayOverview, type DayOverview } from "../../lib/dayOverview";

/** A cada minuto o "agora" é reavaliado: a página aberta de um dia para o outro troca "hoje"/"ontem" sozinha. */
const TICK_MS = 60_000;

function currentTime(now: Date): string {
	return now.toTimeString().slice(0, 8); // "HH:MM:SS" no fuso local
}

/**
 * Tudo que a Home mostra "do dia": principais erros de hoje e ontem (todos os
 * tipos de log) e o resumo (erros/avisos de hoje, média da semana, último
 * registro de cada fonte). Recalcula quando os logs mudam e quando o relógio
 * vira de minuto.
 */
export function useDailyErrors(logs: Log[]): TodayAndYesterdayErrors & {
	nowTime: string;
	todayIso: string;
	overview: DayOverview;
} {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), TICK_MS);
		return () => clearInterval(id);
	}, []);

	const todayIso = toLocalIsoDate(now);
	const yesterdayDate = new Date(now);
	yesterdayDate.setDate(now.getDate() - 1);
	const yesterdayIso = toLocalIsoDate(yesterdayDate);
	const nowTime = currentTime(now);
	// Só o minuto importa para o resultado (evita recomputar por diferenças de segundos).
	const nowMinute = nowTime.slice(0, 5);

	const summary = useMemo(
		() =>
			summarizeTodayAndYesterday(
				logs,
				todayIso,
				yesterdayIso,
				`${nowMinute}:59`,
			),
		[logs, todayIso, yesterdayIso, nowMinute],
	);

	const overview = useMemo(
		() => summarizeDayOverview(logs, todayIso, `${nowMinute}:59`),
		[logs, todayIso, nowMinute],
	);

	return { ...summary, nowTime: nowMinute, todayIso, overview };
}
