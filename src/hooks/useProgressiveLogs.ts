// src/hooks/useProgressiveLogs.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Log } from "../lib/types/Log";
import { LogRepository, FileLoadResult } from "../lib/repository/LogRepository";

export interface LoadProgress {
	loadedFiles: number;
	totalFiles: number;
	percentComplete: number;
	isLoading: boolean;
	isDone: boolean;
	error: string | null;
}

export interface DebugInfo {
	results: FileLoadResult[];
	successCount: number;
	errorCount: number;
	skippedCount: number;
	totalRecords: number;
	totalSizeMb: number;
	startedAt: Date | null;
	finishedAt: Date | null;
	elapsedSeconds: number;
}

interface UseProgressiveLogsReturn {
	// Fontes separadas — Opção C
	staticLogs: Log[];
	manualLogs: Log[];
	// Combinado para conveniência
	logs: Log[];
	progress: LoadProgress;
	debug: DebugInfo;
	reload: () => void;
	// Limpa só os logs manuais — sem recarregar os estáticos
	clearManual: () => void;
}

const EMPTY_PROGRESS: LoadProgress = {
	loadedFiles: 0,
	totalFiles: 0,
	percentComplete: 0,
	isLoading: false,
	isDone: false,
	error: null,
};

const EMPTY_DEBUG: DebugInfo = {
	results: [],
	successCount: 0,
	errorCount: 0,
	skippedCount: 0,
	totalRecords: 0,
	totalSizeMb: 0,
	startedAt: null,
	finishedAt: null,
	elapsedSeconds: 0,
};

export function useProgressiveLogs(
	localFiles: File[] = [],
): UseProgressiveLogsReturn {
	// Fontes separadas — cada uma tem seu próprio estado
	const [staticLogs, setStaticLogs] = useState<Log[]>([]);
	const [manualLogs, setManualLogs] = useState<Log[]>([]);

	const [progress, setProgress] = useState<LoadProgress>(EMPTY_PROGRESS);
	const [debug, setDebug] = useState<DebugInfo>(EMPTY_DEBUG);

	// tick força o useEffect a re-executar quando reload() é chamado
	const reloadTick = useRef(0);
	const [tick, setTick] = useState(0);

	const reload = useCallback(() => {
		reloadTick.current += 1;
		setTick((t) => t + 1);
		// Limpa os dois arrays — reload é um recomeço total
		setStaticLogs([]);
		setManualLogs([]);
	}, []);

	// Limpa só os logs manuais sem tocar nos estáticos
	const clearManual = useCallback(() => {
		setManualLogs([]);
	}, []);

	// Carregamento dos arquivos estáticos (public/data/)
	// Roda uma vez na montagem e quando reload() é chamado
	useEffect(() => {
		// Só carrega estáticos se não houver arquivos manuais
		// Se o usuário carregou manualmente, os estáticos ficam
		// disponíveis mas não são recarregados desnecessariamente
		if (localFiles.length > 0) return;

		let cancelled = false;
		const startedAt = new Date();
		const allResults: FileLoadResult[] = [];

		setProgress({ ...EMPTY_PROGRESS, isLoading: true });
		setDebug({ ...EMPTY_DEBUG, startedAt });
		setStaticLogs([]);

		async function loadStatic() {
			try {
				await LogRepository.fetchProgressively((params) => {
					if (cancelled) return;

					allResults.push(...params.results);
					setStaticLogs((prev) => [...prev, ...params.logs]);
					setProgress({
						loadedFiles: params.loadedFiles,
						totalFiles: params.totalFiles,
						percentComplete: Math.round(
							(params.loadedFiles / params.totalFiles) * 100,
						),
						isLoading: true,
						isDone: false,
						error: null,
					});
					setDebug(buildDebugInfo(allResults, startedAt, null));
				});

				if (!cancelled) {
					const finishedAt = new Date();
					setProgress((prev) => ({
						...prev,
						isLoading: false,
						isDone: true,
						percentComplete: 100,
					}));
					setDebug(buildDebugInfo(allResults, startedAt, finishedAt));
				}
			} catch (err) {
				if (!cancelled) {
					setProgress({
						...EMPTY_PROGRESS,
						error: err instanceof Error ? err.message : "Erro ao carregar logs",
					});
				}
			}
		}

		loadStatic();
		return () => {
			cancelled = true;
		};
	}, [tick]); // localFiles intencionalmente fora — ver comentário acima

	// Carregamento dos arquivos manuais
	// Roda sempre que localFiles mudar
	useEffect(() => {
		if (localFiles.length === 0) return;

		let cancelled = false;
		const startedAt = new Date();
		const allResults: FileLoadResult[] = [];

		// Progresso separado para carregamento manual
		// Não sobrescreve o progresso dos estáticos
		setManualLogs([]);

		async function loadManual() {
			try {
				await LogRepository.fromFiles(localFiles, (params) => {
					if (cancelled) return;
					allResults.push(...params.results);
					setManualLogs((prev) => [...prev, ...params.logs]);
				});

				if (!cancelled) {
					const finishedAt = new Date();
					// Adiciona os resultados manuais ao debug existente
					setDebug((prev) => ({
						...prev,
						results: [...prev.results, ...allResults],
						successCount:
							prev.successCount +
							allResults.filter((r) => r.status === "success").length,
						errorCount:
							prev.errorCount +
							allResults.filter((r) => r.status === "error").length,
						finishedAt,
						elapsedSeconds:
							Math.round((finishedAt.getTime() - startedAt.getTime()) / 100) /
							10,
					}));
				}
			} catch (err) {
				if (!cancelled) {
					setProgress((prev) => ({
						...prev,
						error: err instanceof Error ? err.message : "Erro ao ler arquivo",
					}));
				}
			}
		}

		loadManual();
		return () => {
			cancelled = true;
		};
	}, [localFiles]);

	// logs combinado — useMemo evita recriar o array a cada render
	// sem mudança real nos dados
	const logs = useMemo(
		() => [...staticLogs, ...manualLogs],
		[staticLogs, manualLogs],
	);

	return { staticLogs, manualLogs, logs, progress, debug, reload, clearManual };
}

// ── Função auxiliar — extrai o cálculo de debug para fora do hook ─────────────
// Funções puras são mais fáceis de testar e de ler dentro do hook
function buildDebugInfo(
	results: FileLoadResult[],
	startedAt: Date,
	finishedAt: Date | null,
): DebugInfo {
	const successCount = results.filter((r) => r.status === "success").length;
	const errorCount = results.filter((r) => r.status === "error").length;
	const skippedCount = results.filter((r) => r.status === "skipped").length;
	const totalRecords = results
		.filter((r) => r.status === "success")
		.reduce((sum, r) => sum + (r.status === "success" ? r.recordCount : 0), 0);
	const totalSizeMb =
		Math.round(results.reduce((sum, r) => sum + (r.size_mb ?? 0), 0) * 100) /
		100;
	const elapsedSeconds =
		Math.round(
			((finishedAt ?? new Date()).getTime() - startedAt.getTime()) / 100,
		) / 10;

	return {
		results: [...results],
		successCount,
		errorCount,
		skippedCount,
		totalRecords,
		totalSizeMb,
		startedAt,
		finishedAt,
		elapsedSeconds,
	};
}
