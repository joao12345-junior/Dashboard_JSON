// src/lib/repository/LogRepository.ts

import { Log } from "../types/Log";
import { detectLogType, getMapper } from "../data/LogMapperRegistry";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface FileIndexEntry {
	name: string;
	size_bytes: number;
	size_mb: number;
}

export interface LogIndex {
	generated_at: string;
	total_files: number;
	files: FileIndexEntry[];
}

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

export type BatchCallback = (params: {
	logs: Log[];
	results: FileLoadResult[];
	loadedFiles: number;
	totalFiles: number;
}) => void;

// ── Funções internas ──────────────────────────────────────────────────────────

function mapRawToLog(raw: Record<string, unknown>): Log {
	const logType = detectLogType(raw);
	const mapper = getMapper(logType);
	return mapper.toLog(raw);
}

/**
 * Verifica se uma resposta HTTP realmente contém JSON.
 *
 * Por que isso é necessário?
 * O Vite (e qualquer SPA com historyApiFallback) devolve o index.html
 * para rotas não encontradas, em vez de um 404 limpo.
 * Esse HTML tem status 200 e começa com "<!doctype", o que quebra
 * o JSON.parse com o erro "Unexpected token '<'".
 *
 * A verificação do Content-Type detecta isso antes do parse,
 * permitindo uma mensagem de erro útil para o operador.
 */
function assertJsonResponse(response: Response, url: string): void {
	const contentType = response.headers.get("Content-Type") ?? "";
	const isJson =
		contentType.includes("application/json") ||
		contentType.includes("text/plain"); // alguns servidores servem JSON como text/plain

	if (!isJson) {
		// Se o Content-Type não é JSON, o servidor provavelmente devolveu HTML.
		// Isso acontece quando o arquivo não existe e o servidor usa fallback.
		throw new Error(
			`Servidor devolveu "${contentType}" em vez de JSON para: ${url}\n` +
				`Verifique se o arquivo existe em public/data/ e se o generate_index.py foi executado.`,
		);
	}
}

async function fetchSingleFile(
	entry: FileIndexEntry,
	basePath: string,
): Promise<{ logs: Log[]; result: FileLoadResult }> {
	const start = performance.now();
	const url = `${basePath}/${entry.name}`;

	try {
		const response = await fetch(url);

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

		// Valida Content-Type antes de tentar o parse —
		// evita o "Unexpected token '<'" quando o servidor devolve HTML
		assertJsonResponse(response, url);

		const parsed = await response.json();

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
	 *
	 * Ordem de verificações:
	 * 1. response.ok — garante que o HTTP não deu erro (404, 500, etc.)
	 * 2. assertJsonResponse — garante que o corpo é JSON, não HTML de fallback
	 * 3. response.json() — só chega aqui se as duas condições anteriores passaram
	 */
	async fetchIndex(basePath = "/data"): Promise<LogIndex> {
		const url = `${basePath}/index.json`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(
				`index.json não encontrado (HTTP ${response.status}).\n` +
					`Execute: python generate_index.py\n` +
					`Caminho esperado: public/data/index.json`,
			);
		}

		// Segunda linha de defesa: o arquivo pode existir mas o servidor
		// ainda pode devolver HTML por questões de configuração/cache
		assertJsonResponse(response, url);

		return response.json();
	},

	async fetchProgressively(
		onBatch: BatchCallback,
		basePath = "/data",
		batchSize = 10,
	): Promise<void> {
		const index = await this.fetchIndex(basePath);
		const { files } = index;
		let loadedFiles = 0;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);

			const batchResults = await Promise.all(
				batch.map((entry) => fetchSingleFile(entry, basePath)),
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

// ── Leitura de arquivos locais (upload manual) ────────────────────────────────

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
