// src/lib/repository/LogRepository.ts
import { RawLog } from "../types/RawLog";

// Cria uma função que valida E converte o tipo
function parseStartStatus(value: unknown): 0 | 1 | 2 {
	const num = Number(value ?? 0);
	// Verifica se o valor está dentro do conjunto esperado
	if (num === 0 || num === 1 || num === 2) {
		return num; // TypeScript agora sabe que é 0 | 1 | 2
	}
	return 0; // fallback seguro
}

export const LogRepository = {
	async fetchAll(): Promise<RawLog[]> {
		const files = import.meta.glob("../data/Log/*.json");

		const entries = Object.values(files);

		// Falha explícita: sem arquivos de exemplo, não há nada para exibir.
		// O ErrorState no Dashboard vai capturar e mostrar esta mensagem.
		if (entries.length === 0) {
			throw new Error(
				"Nenhum arquivo de log encontrado em src/lib/data/Log/. Carregue um arquivo JSON ou adicione logs de exemplo.",
			);
		}

		const rawLogs = await Promise.all(
			entries.map(async (importFile) => {
				const module = (await importFile()) as { default: RawLog };
				const log = module.default;
				return {
					message: log.message ?? "",
					Data: log.Data ?? "",
					Hora: String(log.Hora ?? "").trim(),
					Start: parseStartStatus(Number(log.Start ?? 0)),
				} satisfies RawLog;
			}),
		);
		return rawLogs;
	},

	async fromFile(file: File): Promise<RawLog[]> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (e: ProgressEvent<FileReader>) => {
				try {
					// e.target.result é string | ArrayBuffer — verificamos antes de usar
					const result = e.target?.result;
					if (typeof result !== "string") {
						reject(new Error("Formato de arquivo inválido."));
						return;
					}
					const parsed = JSON.parse(result);

					resolve(
						Array.isArray(parsed)
							? parsed
							: parsed.logs
								? parsed.logs
								: [parsed],
					);
				} catch {
					reject(new Error("JSON inválido. Verifique a estrutura do arquivo."));
				}
			};

			reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
			reader.readAsText(file);
		});
	},
};
