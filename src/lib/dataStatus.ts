// src/lib/dataStatus.ts
import type { ApiLoadProgress, LoadProgress } from "../hooks/useProgressiveLogs";
import {
	loadingPercent,
	resolveDataState,
	type DataState,
} from "./loadStatus";
import { loadApiConfig } from "./storage/logPaths";

export interface DataStatus {
	dataState: DataState;
	/** 0–100, para o subtítulo ("Carregando… 42%"). */
	percent: number;
	/** Erro de qualquer fonte (estática ou API), ou null. */
	error: string | null;
}

/**
 * Junta o que toda página precisa saber sobre o carregamento num lugar só
 * (antes cada página decidia "carregando / vazio / erro" por conta própria, e a
 * maioria dizia "nenhum registro" enquanto os dados ainda chegavam).
 *
 * Fica separada de `loadStatus.ts` porque lê o localStorage (API habilitada?);
 * a lógica pura e testável continua lá.
 */
export function getDataStatus(
	progress: LoadProgress,
	apiProgress: ApiLoadProgress,
	logCount: number,
): DataStatus {
	return {
		dataState: resolveDataState(
			progress,
			apiProgress,
			logCount,
			loadApiConfig().enabled,
		),
		percent: loadingPercent(progress, apiProgress),
		error: progress.error ?? apiProgress.error,
	};
}
