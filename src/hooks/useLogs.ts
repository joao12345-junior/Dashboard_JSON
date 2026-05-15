import { useState, useEffect } from "react";
import { LogRepository } from "../lib/repository/LogRepository";
import { Log } from "../lib/types/Log";

export function useLogs(files: File[] = []) {
	const [logs, setLogs] = useState<Log[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				setIsLoading(true);
				setError(null);

				// O repositório agora retorna Log[] diretamente
				// O mapeamento acontece dentro do repositório via registry
				const result: Log[] =
					files.length === 0
						? await LogRepository.fetchAll()
						: (await Promise.all(files.map(LogRepository.fromFile))).flat();

				if (!cancelled) setLogs(result);
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Erro desconhecido");
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [files]);

	return { logs, isLoading, error };
}
