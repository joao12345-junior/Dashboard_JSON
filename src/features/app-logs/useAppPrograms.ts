// src/features/app-logs/useAppPrograms.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadApiConfig } from "../../lib/storage/logPaths";
import { authorizedFetch } from "../../hooks/useAuth";
import type { Log } from "../../lib/types/Log";
import {
	classifyPrograms,
	filterHiddenPrograms,
	hiddenProgramNames,
	latestLogByProgram,
	type ClassifiedProgram,
	type ProgramRecord,
	type ProgramVisibility,
} from "./programRegistry";

/** Frequência da consulta ao registro; os logs novos chegam por stream. */
const REFRESH_MS = 2 * 60 * 1000;
/** Reavalia "dias sem log" mesmo sem dado novo (aba aberta a noite toda). */
const CLOCK_TICK_MS = 60 * 1000;

export interface AppProgramsState {
	/** Todos os programas conhecidos, já classificados. */
	programs: ClassifiedProgram[];
	/** `logs` sem os registros dos programas escondidos — é isto que as telas usam. */
	visibleLogs: Log[];
	/** true só até a primeira resposta (ou erro). */
	loading: boolean;
	error: string | null;
	setVisibility: (programa: string, visibility: ProgramVisibility) => Promise<void>;
	/** Apaga os logs do programa; devolve quantos foram apagados. */
	deleteLogs: (programa: string) => Promise<number>;
}

async function readError(res: Response, fallback: string): Promise<string> {
	try {
		const body = (await res.json()) as { error?: string };
		return body.error ?? fallback;
	} catch {
		return fallback;
	}
}

/// <summary>
/// Junta o registro de programas (API) com os logs carregados e devolve os
/// logs filtrados. Chamado uma vez em App.tsx: assim Home, Logs Gerais e
/// Ajustes enxergam exatamente o mesmo conjunto. `onLogsDeleted` recarrega os
/// logs depois de apagar um programa (os apagados ainda estão em memória).
/// </summary>
export function useAppPrograms(
	enabled: boolean,
	logs: Log[],
	onLogsDeleted: () => void,
): AppProgramsState {
	const [records, setRecords] = useState<ProgramRecord[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

	const load = useCallback(async () => {
		try {
			const { api } = loadApiConfig();
			const res = await authorizedFetch(`${api}/api/app-programs`);
			if (!res.ok) throw new Error(await readError(res, "Erro ao buscar os programas"));
			const body = (await res.json()) as { programs: ProgramRecord[] };
			setRecords(body.programs);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		}
	}, []);

	useEffect(() => {
		if (!enabled) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial na API (sistema externo); o setState só roda depois do await
		void load();
		const refresh = setInterval(() => void load(), REFRESH_MS);
		const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
		return () => {
			clearInterval(refresh);
			clearInterval(clock);
		};
	}, [enabled, load]);

	const programs = useMemo(
		() => classifyPrograms(records ?? [], latestLogByProgram(logs), now),
		[records, logs, now],
	);

	const visibleLogs = useMemo(
		() => filterHiddenPrograms(logs, hiddenProgramNames(programs)),
		[logs, programs],
	);

	const setVisibility = useCallback(
		async (programa: string, visibility: ProgramVisibility) => {
			const { api } = loadApiConfig();
			const res = await authorizedFetch(`${api}/api/app-programs/visibility`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ programa, visibility }),
			});
			if (!res.ok) throw new Error(await readError(res, "Erro ao salvar a visibilidade"));
			await load();
		},
		[load],
	);

	const deleteLogs = useCallback(
		async (programa: string) => {
			const { api } = loadApiConfig();
			const res = await authorizedFetch(`${api}/api/app-programs/logs/delete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ programa }),
			});
			if (!res.ok) throw new Error(await readError(res, "Erro ao apagar os logs"));
			const body = (await res.json()) as { deleted: number };
			await load();
			onLogsDeleted();
			return body.deleted;
		},
		[load, onLogsDeleted],
	);

	return {
		programs,
		visibleLogs,
		loading: records === null && error === null,
		error,
		setVisibility,
		deleteLogs,
	};
}
