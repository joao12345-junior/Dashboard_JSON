export const LogRepository = {
	async fetchAll() {
		const files = import.meta.glob("../data/Log/*.json");
		console.log(files);
		const rawLogs = await Promise.all(
			Object.values(files).map(async (importFile) => {
				const module = await importFile();
				const log = module.default;

				return {
					message: log.message ?? "",
					Data: log.Data ?? "",
					Hora: String(log.Hora ?? "").trim(),
					Start: Number(log.Start ?? 0),
				};
			}),
		);

		return rawLogs;
	},

	async fromFile(file: File) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (e: any) => {
				try {
					const parsed = JSON.parse(e.target.result);

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
