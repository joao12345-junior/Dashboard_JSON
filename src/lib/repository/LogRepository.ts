// src/lib/repository/LogRepository.ts

import { Log } from "../types/Log";
import { detectLogType, getMapper } from "../data/LogMapperRegistry";

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
 * Usado pelo painel de debug e pelo hook de progresso.
 *
 * O campo `status` usa união discriminada — o mesmo padrão do Log.ts.
 * Isso permite ao TypeScript saber exatamente quais campos estão
 * disponíveis em cada branch:
 *   if (result.status === "error") → result.error existe com certeza
 *   if (result.status === "success") → result.recordCount existe com certeza
 */
export type FileLoadResult =
	| {
			status: "success";
			fileName: string;
			recordCount: number;
			size_mb: number;
			duration_ms: number;
	  }
	| {
			status: "error";
			fileName: string;
			error: string;
			size_mb: number;
			duration_ms: number;
	  }
	| {
			status: "skipped";
			fileName: string;
			reason: string;
			size_mb: number;
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
 * Idêntico ao original — não muda porque a lógica de detecção é sólida.
 */
function mapRawToLog(raw: Record<string, unknown>): Log {
	const logType = detectLogType(raw);
	const mapper = getMapper(logType);
	return mapper.toLog(raw);
}

/**
 * Carrega e processa um único arquivo JSON via fetch.
 *
 * Por que retornar FileLoadResult em vez de lançar exceção?
 * Porque queremos que um arquivo corrompido não derrube os outros.
 * O caller (fetchProgressively) decide o que fazer com o resultado.
 * Este é o padrão "Railway Oriented Programming" — o fluxo sempre
 * continua, seja no trilho de sucesso ou no trilho de erro.
 */
async function fetchSingleFile(
	entry: FileIndexEntry,
	basePath: string,
): Promise<{ logs: Log[]; result: FileLoadResult }> {
	const start = performance.now();

	try {
		const response = await fetch(`${basePath}/${entry.name}`);

		if (!response.ok) {
			return {
				logs: [],
				result: {
					status: "error",
					fileName: entry.name,
					error: `HTTP ${response.status}: ${response.statusText}`,
					size_mb: entry.size_mb,
					duration_ms: Math.round(performance.now() - start),
				},
			};
		}

		const parsed = await response.json();

		// Arquivo vazio — não é erro, mas também não tem dados
		if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
			return {
				logs: [],
				result: {
					status: "skipped",
					fileName: entry.name,
					reason: "Arquivo vazio",
					size_mb: entry.size_mb,
				},
			};
		}

		const raws: Record<string, unknown>[] = Array.isArray(parsed)
			? parsed
			: parsed.logs
				? parsed.logs
				: [parsed];

		const logs = raws.map(mapRawToLog);
		const duration_ms = Math.round(performance.now() - start);

		return {
			logs,
			result: {
				status: "success",
				fileName: entry.name,
				recordCount: logs.length,
				size_mb: entry.size_mb,
				duration_ms,
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
			},
		};
	}
}

// ── API pública do repositório ────────────────────────────────────────────────

export const LogRepository = {
	/**
	 * Busca o índice de arquivos disponíveis.
	 * Lançar exceção aqui é intencional — sem índice, não há nada a fazer.
	 */
	async fetchIndex(basePath = "/data"): Promise<LogIndex> {
		const response = await fetch(`${basePath}/index.json`);
		if (!response.ok) {
			throw new Error(
				`Índice não encontrado em ${basePath}/index.json. ` +
					"Execute o script Python para gerar os arquivos.",
			);
		}
		return response.json();
	},

	/**
	 * Carrega todos os arquivos do índice em lotes, chamando onBatch
	 * a cada lote concluído.
	 *
	 * Por que lotes e não um arquivo por vez?
	 * Um arquivo por vez seria lento (600 requisições sequenciais).
	 * Todos de uma vez esgota memória (o que causou o Out of Memory).
	 * Lotes de 10 equilibra velocidade e consumo de memória.
	 *
	 * BATCH_SIZE = 10 significa:
	 * - 10 fetches em paralelo por rodada (Promise.all)
	 * - UI atualiza a cada 10 arquivos — progresso visível
	 * - Memória nunca acumula mais de ~10 arquivos simultaneamente
	 */
	async fetchProgressively(
		onBatch: BatchCallback,
		basePath = "/data",
		batchSize = 10,
	): Promise<void> {
		const index = await this.fetchIndex(basePath);
		const { files } = index;
		let loadedFiles = 0;

		// Divide o array de arquivos em grupos de batchSize
		// Exemplo com batchSize=3 e 7 arquivos:
		// [[a,b,c], [d,e,f], [g]]
		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			// Promise.all processa o lote em paralelo
			// Se um falhar, fetchSingleFile já trata o erro internamente
			const batchResults = await Promise.all(
				batch.map((entry) => fetchSingleFile(entry, basePath)),
			);

			const batchLogs = batchResults.flatMap((r) => r.logs);
			const batchFileResults = batchResults.map((r) => r.result);
			loadedFiles += batch.length;

			// Notifica a UI com os logs deste lote
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
	 * Mantém o mesmo padrão de callback para consistência com fetchProgressively.
	 */
	async fromFiles(
		files: File[],
		onBatch: BatchCallback,
		batchSize = 5,
	): Promise<void> {
		let loadedFiles = 0;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			const batchResults = await Promise.all(
				batch.map((file) => readLocalFile(file)),
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
};

/**
 * Lê um File local via FileReader e retorna logs + resultado de debug.
 * Separado do repositório porque é uma operação de I/O diferente (disco local
 * vs rede), mas produz o mesmo tipo de resultado — FileLoadResult.
 */
async function readLocalFile(
	file: File,
): Promise<{ logs: Log[]; result: FileLoadResult }> {
	const start = performance.now();

	return new Promise((resolve) => {
		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const text = e.target?.result;
				if (typeof text !== "string") {
					resolve({
						logs: [],
						result: {
							status: "error",
							fileName: file.name,
							error: "Conteúdo não é texto",
							size_mb: file.size / (1024 * 1024),
							duration_ms: Math.round(performance.now() - start),
						},
					});
					return;
				}

				const parsed = JSON.parse(text);
				const raws: Record<string, unknown>[] = Array.isArray(parsed)
					? parsed
					: parsed.logs
						? parsed.logs
						: [parsed];

				const logs = raws.map(mapRawToLog);

				resolve({
					logs,
					result: {
						status: "success",
						fileName: file.name,
						recordCount: logs.length,
						size_mb: round(file.size / (1024 * 1024), 2),
						duration_ms: Math.round(performance.now() - start),
					},
				});
			} catch (err) {
				resolve({
					logs: [],
					result: {
						status: "error",
						fileName: file.name,
						error: err instanceof Error ? err.message : "JSON inválido",
						size_mb: round(file.size / (1024 * 1024), 2),
						duration_ms: Math.round(performance.now() - start),
					},
				});
			}
		};

		reader.onerror = () =>
			resolve({
				logs: [],
				result: {
					status: "error",
					fileName: file.name,
					error: "Erro ao ler arquivo",
					size_mb: round(file.size / (1024 * 1024), 2),
					duration_ms: Math.round(performance.now() - start),
				},
			});

		reader.readAsText(file);
	});
}

function round(value: number, decimals: number): number {
	return Math.round(value * 10 ** decimals) / 10 ** decimals;
}
