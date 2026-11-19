// src/lib/loadStatus.ts

/** Estado dos dados mostrados numa página: ainda chegando, prontos ou com falha. */
export type DataState = "loading" | "ready" | "error";

/** Só o que o cálculo precisa dos dois progressos (estático e API) do hook. */
export interface SourceProgress {
	isLoading: boolean;
	isDone: boolean;
	error: string | null;
	percentComplete: number;
}

/**
 * Decide se o que está na tela já é confiável.
 *
 * Por que isso importa: sem este estado, a Home mostrava "Nenhum erro hoje" e
 * zeros enquanto os registros ainda estavam chegando (e também quando a API
 * falhava) — um "tudo certo" falso num painel de monitoramento.
 *
 *  - "loading": alguma fonte está carregando, ou a API está habilitada e ainda
 *    nem começou (a fonte estática vazia termina na hora, antes do login, e sem
 *    isso a primeira renderização da Home parecia "pronta" por um instante), ou
 *    nada foi carregado e nenhuma fonte terminou;
 *  - "error": nada está carregando e alguma fonte falhou;
 *  - "ready": caso contrário.
 */
export function resolveDataState(
	staticProgress: SourceProgress,
	apiProgress: SourceProgress,
	logCount: number,
	apiEnabled: boolean,
): DataState {
	if (staticProgress.isLoading || apiProgress.isLoading) return "loading";
	const apiNotStarted =
		apiEnabled && !apiProgress.isDone && apiProgress.error === null;
	if (apiNotStarted) return "loading";
	if (staticProgress.error || apiProgress.error) return "error";
	if (!staticProgress.isDone && !apiProgress.isDone && logCount === 0)
		return "loading";
	return "ready";
}

/** Percentual a exibir: a API tem prioridade (mesma regra do PageHeader). */
export function loadingPercent(
	staticProgress: SourceProgress,
	apiProgress: SourceProgress,
): number {
	// Nenhuma fonte carregando = a API ainda não começou (a fonte estática já
	// terminou com 100%): mostrar 100% aí seria mentira, então volta a 0.
	if (!apiProgress.isLoading && !staticProgress.isLoading) return 0;
	const active = apiProgress.isLoading ? apiProgress : staticProgress;
	return Math.max(0, Math.min(100, Math.round(active.percentComplete)));
}

/** "12.345 registros carregados em 6,2 s" (com concordância no singular). */
export function formatLoadedToast(records: number, seconds: number): string {
	const noun = records === 1 ? "registro carregado" : "registros carregados";
	const time = seconds.toLocaleString("pt-BR", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	return `${records.toLocaleString("pt-BR")} ${noun} em ${time} s`;
}
