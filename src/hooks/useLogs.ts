import { useState, useEffect } from "react";
import { LogRepository } from "../lib/repository/LogRepository";
import { LogMapper } from "../lib/data/LogMapper";

// Aceita múltiplos arquivos
export function useLogs(files = []) {
	const [logs, setLogs] = useState([]);
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
					setError(err.message ?? "Erro desconhecido.");
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
