// src/hooks/useNewDataDetector.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { loadApiConfig } from "../lib/storage/logPaths";
import { getAuthToken } from "./useAuth";

interface LastActivity {
	backup: string | null;
	windows: string | null;
	site: string | null;
	app: string | null;
}

const POLL_INTERVAL_MS = 60 * 1000; // 1 minuto

/**
 * Detecta novos dados no servidor comparando timestamps
 * da última atividade com o que foi carregado na sessão atual.
 *
 * Responsabilidade única: detectar mudança — não recarregar dados.
 * Quem decide recarregar é o componente consumidor.
 */
export function useNewDataDetector() {
	const [hasNewData, setHasNewData] = useState(false);
	const baseline = useRef<LastActivity | null>(null);

	const fetchActivity = useCallback(async (): Promise<LastActivity | null> => {
		const { api } = loadApiConfig();
		const token = getAuthToken();
		if (!token) return null;

		try {
			const res = await window.fetch(`${api}/api/logs/last-activity`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) return null;
			return await res.json();
		} catch {
			return null;
		}
	}, []);

	const dismiss = useCallback(() => setHasNewData(false), []);

	useEffect(() => {
		// Primeira chamada: estabelece o baseline (o que o usuário já vê)
		fetchActivity().then((data) => {
			if (data) baseline.current = data;
		});

		const interval = setInterval(async () => {
			const current = await fetchActivity();
			if (!current || !baseline.current) return;

			const changed =
				current.backup !== baseline.current.backup ||
				current.windows !== baseline.current.windows ||
				current.site !== baseline.current.site ||
				current.app !== baseline.current.app;

			if (changed) setHasNewData(true);
		}, POLL_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [fetchActivity]);

	const acknowledge = useCallback(async () => {
		// Atualiza o baseline para o estado atual após o usuário recarregar
		const current = await fetchActivity();
		if (current) baseline.current = current;
		setHasNewData(false);
	}, [fetchActivity]);

	return { hasNewData, dismiss, acknowledge };
}
