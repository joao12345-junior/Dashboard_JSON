// src/features/network/hooks/useNetworkPolling.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { loadApiConfig } from "../../../lib/storage/logPaths";
import { authorizedFetch, useAuth } from "../../../hooks/useAuth";

export interface NetworkPollingState<T> {
	data: T | null;
	/** Primeira carga (ou troca de filtro): ainda sem dados para esta consulta. */
	loading: boolean;
	error: string | null;
	lastRefresh: Date | null;
	reload: () => void;
}

/** O poller grava a cada 60 s; olhar a cada 30 s basta para a tela não ficar velha. */
const REFRESH_MS = 30_000;

/// <summary>
/// Busca `path` (já com a query) na API e repete em segundo plano a cada 30 s
/// enquanto a aba está visível. A repetição é "silenciosa": não pisca o
/// carregando e, se falhar, mantém os dados anteriores (só mostra o erro). Uma
/// resposta de consulta antiga (filtro trocado no meio do caminho) é descartada
/// pelo contador de requisições.
/// </summary>
export function useNetworkPolling<T>(
	path: string,
	errorMessage: string,
): NetworkPollingState<T> {
	const { isAuthenticated } = useAuth();
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
	const requestRef = useRef(0);

	const load = useCallback(
		async (silent: boolean) => {
			const request = ++requestRef.current;
			if (!silent) setLoading(true);
			try {
				const { api } = loadApiConfig();
				const res = await authorizedFetch(`${api}${path}`);
				if (!res.ok) throw new Error(errorMessage);
				const body = (await res.json()) as T;
				if (request !== requestRef.current) return;
				setData(body);
				setError(null);
				setLastRefresh(new Date());
			} catch (err) {
				if (request !== requestRef.current) return;
				setError(err instanceof Error ? err.message : "Erro desconhecido");
			} finally {
				if (request === requestRef.current && !silent) setLoading(false);
			}
		},
		[path, errorMessage],
	);

	useEffect(() => {
		if (!isAuthenticated) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de dados e sincronizacao com sistema externo (API), o proprio React docs trata isso como uso correto de efeito
		void load(false);
		const timer = setInterval(() => {
			if (document.visibilityState === "visible") void load(true);
		}, REFRESH_MS);
		return () => clearInterval(timer);
	}, [isAuthenticated, load]);

	return { data, loading, error, lastRefresh, reload: () => void load(false) };
}
