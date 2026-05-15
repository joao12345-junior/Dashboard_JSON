// src/hooks/useLogs.ts
import { useState, useEffect } from "react";
import { LogRepository } from "../lib/repository/LogRepository";
import { LogMapper } from "../lib/data/LogMapper";
import { Log } from "../lib/types/Log";
import { RawLog } from "../lib/types/RawLog";

export function useLogs(files: File[] = []) {
	const [logs, setLogs] = useState<Log[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	// ✅ string | null — aceita tanto null quanto mensagem de erro
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				setIsLoading(true);
				setError(null);

				let raw: RawLog[] = [];

				if (!files || files.length === 0) {
					raw = await LogRepository.fetchAll();
				} else {
					const results = await Promise.all(
						files.map((file) => LogRepository.fromFile(file)),
					);
					raw = results.flat();
				}

				if (!cancelled) {
					setLogs(LogMapper.toLogList(raw));
				}
			} catch (err) {
				if (!cancelled) {
					const message =
						err instanceof Error ? err.message : "Erro desconhecido";
					setError(message); // ✅ agora aceita string
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
