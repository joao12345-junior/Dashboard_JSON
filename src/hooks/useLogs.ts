import { useState, useEffect } from "react";
import { LogRepository } from "../lib/repository/LogRepository";
import { LogMapper } from "../lib/data/LogMapper";
import { Log } from "../lib/types/Log";

// Aceita múltiplos arquivos
export function useLogs(files = []) {
	const [logs, setLogs] = useState<Log[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				setIsLoading(true);
				setError(null);

				let raw = [];

				// Sem arquivos → mock/API
				if (!files || files.length === 0) {
					raw = await LogRepository.fetchAll();
				} else {
					// Lê todos os JSONs da pasta
					const results = await Promise.all(
						files.map((file) => LogRepository.fromFile(file)),
					);

					// Junta tudo em um array único
					raw = results.flat();
				}

				if (!cancelled) {
					setLogs(LogMapper.toLogList(raw));
				}
			} catch (err) {
				if (!cancelled) {
					const message =
						err instanceof Error ? err.message : "Erro desconhecido";
					setError(message);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		load();

		return () => {
			cancelled = true;
		};
	}, [files]);

	return { logs, isLoading, error };
}
