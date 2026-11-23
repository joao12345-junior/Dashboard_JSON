// src/features/network/hooks/useNetworkEvents.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { loadApiConfig } from "../../../lib/storage/logPaths";
import { authorizedFetch, useAuth } from "../../../hooks/useAuth";

/** Evento de rede (UniFi) como a API devolve — ver `GET /api/network/events`. */
export interface NetworkEvent {
	id: number;
	/** Quando o coletor gravou. */
	created_at: string;
	/** Quando o evento aconteceu, se o UniFi informou (`null` em linhas antigas). */
	event_time: string | null;
	source_ip: string | null;
	device_product: string | null;
	signature_id: string | null;
	name: string | null;
	/** Gravidade CEF 0–10. */
	severity: number | null;
	/** Campos extras do CEF (`msg`, `UNIFIdeviceName`, ...). */
	extension: Record<string, string>;
}

export interface NetworkEventFilters {
	/** Texto buscado no nome e na mensagem. Vazio = sem filtro. */
	q: string;
	/** Gravidade mínima CEF. `null` = todas. */
	minSeverity: number | null;
	/** Dia inteiro (AAAA-MM-DD, horário de Brasília). Vazio = todos os dias. */
	date: string;
}

interface NetworkEventsResponse {
	events: NetworkEvent[];
	has_more: boolean;
}

export interface NetworkEventsState {
	events: NetworkEvent[];
	hasMore: boolean;
	/** Carregando a primeira página (ou recarregando). */
	loading: boolean;
	/** Carregando mais uma página ("Carregar mais"). */
	loadingMore: boolean;
	error: string | null;
	lastRefresh: Date | null;
	reload: () => void;
	loadMore: () => void;
}

const PAGE_SIZE = 200;

/// <summary>
/// Carrega os eventos de rede por cursor (`before_id`): a primeira página ao
/// abrir/trocar filtro, e "carregar mais" acrescenta as mais antigas. Uma
/// resposta de uma busca antiga (filtro trocado no meio do caminho) é descartada
/// pelo contador de requisições, para não sobrescrever a lista atual.
/// </summary>
export function useNetworkEvents(
	filters: NetworkEventFilters,
): NetworkEventsState {
	const { isAuthenticated } = useAuth();
	const [events, setEvents] = useState<NetworkEvent[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
	const requestRef = useRef(0);

	const { q, minSeverity, date } = filters;

	const fetchPage = useCallback(
		async (beforeId: number | null): Promise<NetworkEventsResponse> => {
			const { api } = loadApiConfig();
			const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
			if (beforeId !== null) params.set("before_id", String(beforeId));
			if (minSeverity !== null) params.set("min_severity", String(minSeverity));
			if (q) params.set("q", q);
			if (date) params.set("date", date);
			const res = await authorizedFetch(
				`${api}/api/network/events?${params.toString()}`,
			);
			if (!res.ok) throw new Error("Erro ao buscar eventos de rede");
			return (await res.json()) as NetworkEventsResponse;
		},
		[q, minSeverity, date],
	);

	const reload = useCallback(async () => {
		const request = ++requestRef.current;
		setLoading(true);
		setError(null);
		try {
			const page = await fetchPage(null);
			if (request !== requestRef.current) return;
			setEvents(page.events);
			setHasMore(page.has_more);
			setLastRefresh(new Date());
		} catch (err) {
			if (request !== requestRef.current) return;
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		} finally {
			if (request === requestRef.current) setLoading(false);
		}
	}, [fetchPage]);

	const loadMore = useCallback(async () => {
		const last = events[events.length - 1];
		if (!last) return;
		const request = ++requestRef.current;
		setLoadingMore(true);
		setError(null);
		try {
			const page = await fetchPage(last.id);
			if (request !== requestRef.current) return;
			setEvents((prev) => [...prev, ...page.events]);
			setHasMore(page.has_more);
		} catch (err) {
			if (request !== requestRef.current) return;
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		} finally {
			if (request === requestRef.current) setLoadingMore(false);
		}
	}, [events, fetchPage]);

	useEffect(() => {
		if (!isAuthenticated) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de dados e sincronizacao com sistema externo (API), o proprio React docs trata isso como uso correto de efeito
		void reload();
	}, [isAuthenticated, reload]);

	return {
		events,
		hasMore,
		loading,
		loadingMore,
		error,
		lastRefresh,
		reload: () => void reload(),
		loadMore: () => void loadMore(),
	};
}
