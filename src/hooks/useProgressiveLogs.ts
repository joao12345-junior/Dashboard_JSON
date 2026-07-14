// src/hooks/useProgressiveLogs.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Log } from "../lib/types/Log";
import { LogRepository, FileLoadResult } from "../lib/repository/LogRepository";
import { loadApiConfig, loadEnabledSources } from "../lib/storage/logPaths";

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
	staticLogs: Log[];
	manualLogs: Log[];
	apiLogs: Log[];
	logs: Log[];
	progress: LoadProgress;
	debug: DebugInfo;
	reload: () => void;
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
	isAuthenticated: boolean = false,
): UseProgressiveLogsReturn {
	const [staticLogs, setStaticLogs] = useState<Log[]>([]);
	const [manualLogs, setManualLogs] = useState<Log[]>([]);
	const [progress, setProgress] = useState<LoadProgress>(EMPTY_PROGRESS);
	const [debug, setDebug] = useState<DebugInfo>(EMPTY_DEBUG);

	// API
	const [apiLogs, setApiLogs] = useState<Log[]>([]);

	const reloadTick = useRef(0);
	const [tick, setTick] = useState(0);

	const reload = useCallback(() => {
		reloadTick.current += 1;
		setTick((t) => t + 1);
		setStaticLogs([]);
		setManualLogs([]);
		setApiLogs([]);
	}, []);

	const clearManual = useCallback(() => {
		setManualLogs([]);
	}, []);

	// ── Carregamento estático ─────────────────────────────────────────────────
	// Itera sobre TODAS as fontes habilitadas configuradas pelo usuário.
	// Antes: sempre carregava de /data (hardcoded).
	// Agora: carrega de cada LogSource ativa — a lista vem do localStorage.
	useEffect(() => {
		if (localFiles.length > 0) return;

		const sources = loadEnabledSources();

		// Sem fontes habilitadas: informa o usuário, não deixa em loading infinito
		if (sources.length === 0) {
			setProgress({ ...EMPTY_PROGRESS, isDone: true, error: null });
			return;
		}

		let cancelled = false;
		const startedAt = new Date();
		const allResults: FileLoadResult[] = [];

		setProgress({ ...EMPTY_PROGRESS, isLoading: true });
		setDebug({ ...EMPTY_DEBUG, startedAt });
		setStaticLogs([]);

		async function loadAllSources() {
			try {
				// Cada fonte é carregada em sequência para não saturar a rede.
				// O progresso é acumulado entre fontes — o usuário vê um único
				// indicador de progresso global, não um por fonte.
				let globalLoadedFiles = 0;

				// Primeira passagem: conta o total de arquivos em todas as fontes
				// para calcular o percentual corretamente desde o início.
				// Se fetchIndex falhar em uma fonte, ela é ignorada (não quebra as outras).
				const indexResults = await Promise.allSettled(
					sources.map((s) => LogRepository.fetchIndex(s.url)),
				);

				const totalFiles = indexResults.reduce((sum, result) => {
					if (result.status === "fulfilled")
						return sum + result.value.total_files;
					return sum;
				}, 0);

				// Atualiza o total antes de começar a carregar
				setProgress((prev) => ({ ...prev, totalFiles }));

				// Segunda passagem: carrega cada fonte
				for (const source of sources) {
					if (cancelled) break;

					try {
						await LogRepository.fetchProgressively((params) => {
							if (cancelled) return;

							globalLoadedFiles += params.logs.length > 0 ? 0 : 0;
							// Incrementa pelo número de arquivos do lote, não de logs
							globalLoadedFiles = Math.min(
								globalLoadedFiles + params.results.length,
								totalFiles,
							);

							allResults.push(...params.results);
							setStaticLogs((prev) => [...prev, ...params.logs]);
							setProgress({
								loadedFiles: globalLoadedFiles,
								totalFiles,
								percentComplete:
									totalFiles > 0
										? Math.round((globalLoadedFiles / totalFiles) * 100)
										: 0,
								isLoading: true,
								isDone: false,
								error: null,
							});
							setDebug(buildDebugInfo(allResults, startedAt, null));
						}, source);
					} catch (sourceErr) {
						// Fonte inacessível: registra como erro mas continua com as outras
						allResults.push({
							status: "error",
							fileName: "index.json",
							error:
								sourceErr instanceof Error
									? sourceErr.message
									: "Fonte inacessível",
							size_mb: 0,
							duration_ms: 0,
							sourceAlias: source.alias,
						});
					}
				}

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

		loadAllSources();
		return () => {
			cancelled = true;
		};
		// tick força re-execução quando reload() ou quando sources mudam
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tick]);

	// ── Carregamento manual ───────────────────────────────────────────────────
	useEffect(() => {
		if (localFiles.length === 0) return;

		let cancelled = false;
		const startedAt = new Date();
		const allResults: FileLoadResult[] = [];

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

	// Carregamento da API
	useEffect(() => {
		let cancelled = false;
		const config = loadApiConfig();
		if (!config.enabled) return;
		if (!isAuthenticated) return; // não tenta antes do login

		async function loadFromApi() {
			const [process_logs, windows_logs] = await Promise.all([
				LogRepository.fetchFromAPI("process", config.api),
				LogRepository.fetchFromAPI("windows-event", config.api),
			]);
			if (!cancelled) setApiLogs([...process_logs, ...windows_logs]);
		}

		loadFromApi();
		return () => {
			cancelled = true;
		};
	}, [tick, isAuthenticated]); // isAuthenticated como dependência

	const logs = useMemo(
		() => [...staticLogs, ...manualLogs, ...apiLogs],
		[staticLogs, manualLogs, apiLogs],
	);

	return {
		staticLogs,
		apiLogs,
		manualLogs,
		logs,
		progress,
		debug,
		reload,
		clearManual,
	};
}

// ── Função auxiliar ───────────────────────────────────────────────────────────
// Extraída do hook: funções puras são mais fáceis de testar
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
