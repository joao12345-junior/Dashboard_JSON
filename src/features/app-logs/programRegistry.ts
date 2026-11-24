// src/features/app-logs/programRegistry.ts
import type { Log } from "../../lib/types/Log";

/// <summary>
/// Regras de visibilidade dos programas dos Logs Gerais. Tudo aqui é função
/// pura (sem React, sem rede): recebe dados e devolve dados, então dá para
/// testar sem montar tela. O acesso à API fica em `useAppPrograms.ts`.
/// </summary>

/** Dias sem log a partir dos quais um programa "automático" some das telas. */
export const INACTIVE_AFTER_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Escolha manual: auto = regra dos dias; shown = sempre visível; hidden = oculto. */
export type ProgramVisibility = "auto" | "shown" | "hidden";

/** Como o programa é tratado nas telas (dashboard, registros, Home). */
export type ProgramStatus = "active" | "inactive" | "hidden";

/** Linha devolvida por `GET /api/app-programs`. */
export interface ProgramRecord {
	programa: string;
	visibility: ProgramVisibility;
	visibility_changed_at: string | null;
	last_log_at: string | null;
	/** Logs do programa que existem agora no banco. */
	log_count: number;
	logs_24h: number;
}

export interface ClassifiedProgram extends ProgramRecord {
	status: ProgramStatus;
	/** Último log conhecido (servidor ou logs já carregados no navegador). */
	lastLogAtMs: number | null;
	daysSilent: number | null;
}

/// <summary>
/// Decide o status de cada programa. `latestInLogs` traz o log mais recente
/// já carregado no navegador: o registro do servidor só atualiza a cada
/// alguns minutos, e sem isso um programa inativo que voltou a logar
/// continuaria escondido até a próxima consulta.
/// </summary>
export function classifyPrograms(
	records: readonly ProgramRecord[],
	latestInLogs: ReadonlyMap<string, number>,
	nowMs: number,
	thresholdDays: number = INACTIVE_AFTER_DAYS,
): ClassifiedProgram[] {
	return records.map((record) => {
		const serverMs = record.last_log_at ? Date.parse(record.last_log_at) : NaN;
		const candidates = [serverMs, latestInLogs.get(record.programa) ?? NaN].filter(
			(ms) => Number.isFinite(ms),
		);
		const lastLogAtMs = candidates.length > 0 ? Math.max(...candidates) : null;
		const daysSilent =
			lastLogAtMs === null ? null : Math.max(0, (nowMs - lastLogAtMs) / DAY_MS);

		let status: ProgramStatus;
		if (record.visibility === "hidden") status = "hidden";
		else if (record.visibility === "shown") status = "active";
		else status = daysSilent === null || daysSilent > thresholdDays ? "inactive" : "active";

		return { ...record, status, lastLogAtMs, daysSilent };
	});
}

/// <summary>
/// Log mais recente de cada programa entre os logs carregados. Usa o mesmo
/// texto de `date`/`time` que as telas mostram (ver parseTimestamp).
/// </summary>
export function latestLogByProgram(logs: readonly Log[]): Map<string, number> {
	const latest = new Map<string, number>();
	for (const log of logs) {
		if (log.logType !== "app" || !log.programa) continue;
		const ms = Date.parse(`${log.date}T${log.time}`);
		if (!Number.isFinite(ms)) continue;
		const current = latest.get(log.programa);
		if (current === undefined || ms > current) latest.set(log.programa, ms);
	}
	return latest;
}

/** Nomes dos programas que devem sumir das telas (ocultos ou inativos). */
export function hiddenProgramNames(
	programs: readonly ClassifiedProgram[],
): Set<string> {
	const names = new Set<string>();
	for (const program of programs) {
		if (program.status !== "active") names.add(program.programa);
	}
	return names;
}

/// <summary>
/// Tira dos logs os registros de programas escondidos. Logs sem programa e
/// programas que o registro ainda não conhece continuam visíveis. Devolve a
/// MESMA lista quando não há nada a esconder, para não invalidar os useMemo
/// das telas à toa.
/// </summary>
export function filterHiddenPrograms(
	logs: Log[],
	hidden: ReadonlySet<string>,
): Log[] {
	if (hidden.size === 0) return logs;
	return logs.filter(
		(log) => !(log.logType === "app" && log.programa !== null && hidden.has(log.programa)),
	);
}

/** Programas ocultos à mão que continuam recebendo logs (aviso na Home). */
export function hiddenButLogging(
	programs: readonly ClassifiedProgram[],
): ClassifiedProgram[] {
	return programs.filter((p) => p.visibility === "hidden" && p.logs_24h > 0);
}
