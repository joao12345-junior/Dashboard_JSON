// src/lib/repository/LogRepository.ts

import { Log } from "../types/Log";
import { detectLogType, getMapper } from "../data/LogMapperRegistry";
import type { LogSource } from "../storage/logPaths";

// ── Tipos públicos ────────────────────────────────────────────────────────────

/** Metadados de um arquivo individual, vindos do index.json */
export interface FileIndexEntry {
	name: string;
	size_bytes: number;
	size_mb: number;
}

/** Estrutura completa do index.json gerado pelo Python */
export interface LogIndex {
	generated_at: string;
	total_files: number;
	files: FileIndexEntry[];
}

/**
 * Resultado do carregamento de um arquivo individual.
 *
 * União discriminada — o campo `status` identifica qual forma está ativa.
 * TypeScript sabe exatamente quais campos existem em cada branch:
 *   if (result.status === "error")   → result.error está disponível
 *   if (result.status === "success") → result.recordCount está disponível
 */
export type FileLoadResult =
	| {
			status: "success";
			fileName: string;
			recordCount: number;
			size_mb: number;
			duration_ms: number;
			sourceAlias: string;
	  }
	| {
			status: "error";
			fileName: string;
			error: string;
			size_mb: number;
			duration_ms: number;
			sourceAlias: string;
	  }
	| {
			status: "skipped";
			fileName: string;
			reason: string;
			size_mb: number;
			sourceAlias: string;
	  };

/** Callback chamado a cada lote carregado — alimenta o hook de progresso */
export type BatchCallback = (params: {
	logs: Log[];
	results: FileLoadResult[];
	loadedFiles: number;
	totalFiles: number;
}) => void;

// ── Funções internas ──────────────────────────────────────────────────────────

/**
 * Converte um item bruto do JSON em Log usando o mapper correto.
 *
 * Hierarquia de detecção (do mais confiável ao menos confiável):
 * 1. logTypeHint — vem da LogSource configurada pelo usuário (mais confiável)
 * 2. detectLogType — heurística pelo conteúdo do JSON (fallback)
 *
 * Por que a dica tem prioridade?
 * detectLogType() infere pelo conteúdo. Se amanhã chegar um formato novo
 * que por acaso tenha um campo "Start", ele seria mapeado errado.
 * A dica elimina essa ambiguidade.
 */
function mapRawToLog(raw: Record<string, unknown>, logTypeHint?: string): Log {
	const logType = logTypeHint ?? detectLogType(raw);
	const mapper = getMapper(logType);
	return mapper.toLog(raw);
}

/**
 * Carrega e processa um único arquivo JSON via fetch.
 *
 * Retorna FileLoadResult em vez de lançar exceção — padrão
 * "Railway Oriented Programming": o fluxo sempre continua,
 * seja no trilho de sucesso ou no trilho de erro.
 * Um arquivo corrompido não derruba os outros.
 */
async function fetchSingleFile(
	entry: FileIndexEntry,
	sourceUrl: string,
	sourceAlias: string,
	logTypeHint?: string,
): Promise<{ logs: Log[]; result: FileLoadResult }> {
	const start = performance.now();

	try {
		const response = await fetch(`${sourceUrl}/${entry.name}`);

		if (!response.ok) {
			return {
				logs: [],
				result: {
					status: "error",
					fileName: entry.name,
					error: `HTTP ${response.status}: ${response.statusText}`,
					size_mb: entry.size_mb,
					duration_ms: Math.round(performance.now() - start),
					sourceAlias,
				},
			};
		}

		const parsed = await response.json();

		if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
			return {
				logs: [],
				result: {
					status: "skipped",
					fileName: entry.name,
					reason: "Arquivo vazio",
					size_mb: entry.size_mb,
					sourceAlias,
				},
			};
		}

		const raws: Record<string, unknown>[] = Array.isArray(parsed)
			? parsed
			: parsed.logs
				? parsed.logs
				: [parsed];

		const logs = raws.map((raw) => mapRawToLog(raw, logTypeHint));
		const duration_ms = Math.round(performance.now() - start);

		return {
			logs,
			result: {
				status: "success",
				fileName: entry.name,
				recordCount: logs.length,
				size_mb: entry.size_mb,
				duration_ms,
				sourceAlias,
			},
		};
	} catch (err) {
		return {
			logs: [],
			result: {
				status: "error",
				fileName: entry.name,
				error: err instanceof Error ? err.message : "Erro desconhecido",
				size_mb: entry.size_mb,
				duration_ms: Math.round(performance.now() - start),
				sourceAlias,
			},
		};
	}
}

/**
 * Lê um File local via FileReader.
 * Separado do repositório porque é I/O diferente (disco local vs rede),
 * mas produz o mesmo tipo de resultado.
 */
async function readLocalFile(
	file: File,
): Promise<{ logs: Log[]; result: FileLoadResult }> {
	const start = performance.now();
	const size_mb = Math.round((file.size / (1024 * 1024)) * 100) / 100;

	return new Promise((resolve) => {
		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const parsed = JSON.parse(e.target?.result as string);
				const raws: Record<string, unknown>[] = Array.isArray(parsed)
					? parsed
					: parsed.logs
						? parsed.logs
						: [parsed];

				const logs = raws.map((raw) => mapRawToLog(raw));

				resolve({
					logs,
					result: {
						status: "success",
						fileName: file.name,
						recordCount: logs.length,
						size_mb,
						duration_ms: Math.round(performance.now() - start),
						sourceAlias: "manual",
					},
				});
			} catch (err) {
				resolve({
					logs: [],
					result: {
						status: "error",
						fileName: file.name,
						error: err instanceof Error ? err.message : "JSON inválido",
						size_mb,
						duration_ms: Math.round(performance.now() - start),
						sourceAlias: "manual",
					},
				});
			}
		};

		reader.onerror = () => {
			resolve({
				logs: [],
				result: {
					status: "error",
					fileName: file.name,
					error: "Erro ao ler arquivo",
					size_mb,
					duration_ms: Math.round(performance.now() - start),
					sourceAlias: "manual",
				},
			});
		};

		reader.readAsText(file, "utf-8");
	});
}

// ── API pública do repositório ────────────────────────────────────────────────

export const LogRepository = {
	/**
	 * Busca o índice de arquivos disponíveis em uma fonte.
	 * Lançar exceção aqui é intencional — sem índice, não há nada a fazer
	 * para esta fonte específica.
	 */
	async fetchIndex(sourceUrl: string): Promise<LogIndex> {
		const response = await fetch(`${sourceUrl}/index.json`);
		if (!response.ok) {
			throw new Error(
				`Índice não encontrado em ${sourceUrl}/index.json. ` +
					"Verifique se o servidor está rodando e a URL está correta.",
			);
		}
		return response.json();
	},

	/**
	 * Carrega todos os arquivos de uma LogSource em lotes.
	 *
	 * Recebe LogSource em vez de basePath string:
	 * - A URL vem da source configurada (não hardcoded)
	 * - O logTypeHint elimina a ambiguidade do detectLogType
	 *
	 * Por que lotes e não um arquivo por vez?
	 * Um arquivo por vez seria lento (centenas de requisições sequenciais).
	 * Todos de uma vez esgota memória.
	 * Lotes de 10 equilibra velocidade e consumo.
	 */
	async fetchProgressively(
		onBatch: BatchCallback,
		source: LogSource,
		batchSize = 10,
	): Promise<void> {
		const index = await this.fetchIndex(source.url);
		const { files } = index;
		let loadedFiles = 0;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			const batchResults = await Promise.all(
				batch.map((entry) =>
					fetchSingleFile(entry, source.url, source.alias, source.logType),
				),
			);

			const batchLogs = batchResults.flatMap((r) => r.logs);
			const batchFileResults = batchResults.map((r) => r.result);
			loadedFiles += batch.length;

			onBatch({
				logs: batchLogs,
				results: batchFileResults,
				loadedFiles,
				totalFiles: files.length,
			});
		}
	},

	/**
	 * Carrega arquivos passados manualmente (botão "Carregar Logs").
	 * Usa FileReader — sem fetch, sem índice.
	 */
	async fromFiles(
		files: File[],
		onBatch: BatchCallback,
		batchSize = 5,
	): Promise<void> {
		let loadedFiles = 0;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			const batchResults = await Promise.all(batch.map(readLocalFile));

			const batchLogs = batchResults.flatMap((r) => r.logs);
			const batchFileResults = batchResults.map((r) => r.result);
			loadedFiles += batch.length;

			onBatch({
				logs: batchLogs,
				results: batchFileResults,
				loadedFiles,
				totalFiles: files.length,
			});
		}
	},
	async fetchFromAPI(logType: string, apiUrl: string): Promise<Log[]> {
		const start = performance.now();

		try {
			const response = await fetch(`${apiUrl}/api/logs?type=${logType}`);

			if (!response.ok) {
				throw new Error("[LogRepository] Erro ao ter uma resposta da API");
			}

			const parsed = await response.json();
			if (!parsed)
				throw new Error(
					"[LogRepository] Erro ao fazer o parse da resposta da API",
				);

			const raws = parsed as Record<string, unknown>[];
			return raws.map((raw) => mapRawToLog(raw, logType));
		} catch (err) {
			console.error("[LogRepository] Erro API: ", err);
			return [];
		}
	},
};
