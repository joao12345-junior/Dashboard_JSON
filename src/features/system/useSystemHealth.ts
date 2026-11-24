// src/features/system/useSystemHealth.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadApiConfig } from "../../lib/storage/logPaths";
import { authorizedFetch } from "../../hooks/useAuth";
import { evaluateHealth, type HealthItem, type HealthSnapshot } from "./healthStatus";

/** O poller roda a cada 1 min; consultar a cada 1 min basta para enxergar atraso. */
const REFRESH_MS = 60 * 1000;
/** Reavalia a idade sem nova consulta, para a tela envelhecer sozinha. */
const CLOCK_TICK_MS = 30 * 1000;

export interface SystemHealthState {
	items: HealthItem[];
	/** true só até a primeira resposta (ou erro). */
	loading: boolean;
	error: string | null;
}

/// <summary>
/// Consulta `GET /api/system/health` e avalia cada componente com `evaluateHealth`.
/// Chamado uma vez em App.tsx: Home (aviso) e Ajustes (lista) veem o mesmo resultado.
/// </summary>
export function useSystemHealth(enabled: boolean): SystemHealthState {
	const [data, setData] = useState<{ snapshot: HealthSnapshot; receivedAtMs: number } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

	const load = useCallback(async () => {
		try {
			const { api } = loadApiConfig();
			const res = await authorizedFetch(`${api}/api/system/health`);
			if (!res.ok) throw new Error("Erro ao buscar a saúde do sistema");
			const snapshot = (await res.json()) as HealthSnapshot;
			setData({ snapshot, receivedAtMs: Date.now() });
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		}
	}, []);

	useEffect(() => {
		if (!enabled) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial na API (sistema externo); o setState só roda depois do await
		void load();
		const refresh = setInterval(() => void load(), REFRESH_MS);
		const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
		return () => {
			clearInterval(refresh);
			clearInterval(clock);
		};
	}, [enabled, load]);

	const items = useMemo(
		() => (data ? evaluateHealth(data.snapshot, data.receivedAtMs, now) : []),
		[data, now],
	);

	return { items, loading: data === null && error === null, error };
}
