import { Log } from "../types/Log";
import { detectLogType, getMapper } from "../data/LogMapperRegistry";

/**
 * Converte um item bruto do JSON em Log usando o mapper correto.
 * A detecção do tipo acontece aqui, item por item.
 */
function mapRawToLog(raw: Record<string, unknown>): Log {
	const logType = detectLogType(raw);
	const mapper = getMapper(logType);
	return mapper.toLog(raw);
}

export const LogRepository = {
	async fetchAll(): Promise<Log[]> {
		const files = import.meta.glob("../data/Log/*.json");
		const entries = Object.values(files);

		if (entries.length === 0) {
			throw new Error(
				"Nenhum arquivo de log encontrado em src/lib/data/Log/. " +
					"Carregue um arquivo JSON ou adicione logs de exemplo.",
			);
		}

		const results = await Promise.all(
			entries.map(async (importFile) => {
				const module = (await importFile()) as { default: unknown };
				const content = module.default;

				// JSON pode ser um único objeto ou um array de objetos
				const raws: Record<string, unknown>[] = Array.isArray(content)
					? content
					: [content as Record<string, unknown>];

				return raws.map(mapRawToLog);
			}),
		);

		return results.flat();
	},

	async fromFile(file: File): Promise<Log[]> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (e) => {
				try {
					const result = e.target?.result;
					if (typeof result !== "string") {
						reject(new Error("Formato de arquivo inválido."));
						return;
					}

					const parsed = JSON.parse(result);

					// Normaliza para array independente do formato do arquivo
					const raws: Record<string, unknown>[] = Array.isArray(parsed)
						? parsed
						: parsed.logs
							? parsed.logs
							: [parsed];

					resolve(raws.map(mapRawToLog));
				} catch {
					reject(new Error("JSON inválido. Verifique a estrutura do arquivo."));
				}
			};

			reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
			reader.readAsText(file);
		});
	},
};
