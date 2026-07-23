// src/features/site/hooks/useSiteData.ts
import { useState, useEffect, useCallback } from "react";
import { loadApiConfig } from "../../../lib/storage/logPaths";
import { authorizedFetch, useAuth } from "../../../hooks/useAuth";

export interface AvailabilityRecord {
	id: number;
	url: string;
	status_code: number | null;
	response_time_ms: number;
	is_up: boolean;
	checked_at: string;
	monitored_url_id: number | null;
}

export interface SentryEvent {
	id: string;
	title: string;
	level: string;
	culprit: string;
	permalink: string | null;
	first_seen: string;
	last_seen: string;
	count: number;
	synced_at: string;
}

export interface MonitoredUrl {
	id: number;
	label: string;
	url: string;
	active: boolean;
}

export interface SiteData {
	availability: AvailabilityRecord[];
	sentryEvents: SentryEvent[];
	monitoredUrls: MonitoredUrl[];
	selectedUrlId: number | null;
	setSelectedUrlId: (id: number | null) => void;
	loading: boolean;
	error: string | null;
	lastRefresh: Date | null;
	refresh: () => void;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useSiteData(): SiteData {
	const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
	const [sentryEvents, setSentryEvents] = useState<SentryEvent[]>([]);
	const [monitoredUrls, setMonitoredUrls] = useState<MonitoredUrl[]>([]);
	const [selectedUrlId, setSelectedUrlId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
	const { isAuthenticated } = useAuth();

	// selectedUrlId como dependência: toda troca de filtro dispara um novo fetch,
	// já buscando o histórico já filtrado no servidor — não filtra no cliente.
	const fetchData = useCallback(async () => {
		const { api } = loadApiConfig();
		setLoading(true);
		setError(null);

		const availUrl = selectedUrlId
			? `${api}/api/site/availability?monitored_url_id=${selectedUrlId}`
			: `${api}/api/site/availability`;

		try {
			const [availRes, sentryRes, urlsRes] = await Promise.all([
				authorizedFetch(availUrl),
				authorizedFetch(`${api}/api/site/sentry-events`),
				authorizedFetch(`${api}/api/site/monitored-urls`),
			]);

			if (!availRes.ok || !sentryRes.ok || !urlsRes.ok)
				throw new Error("Erro ao buscar dados do site");

			const [availData, sentryData, urlsData] = await Promise.all([
				availRes.json(),
				sentryRes.json(),
				urlsRes.json(),
			]);

			setAvailability(availData);
			setSentryEvents(sentryData);
			setMonitoredUrls(urlsData);
			setLastRefresh(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		} finally {
			setLoading(false);
		}
	}, [selectedUrlId]);

	useEffect(() => {
		if (!isAuthenticated) return;

		fetchData();
		const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [isAuthenticated, fetchData]);

	return {
		availability,
		sentryEvents,
		monitoredUrls,
		selectedUrlId,
		setSelectedUrlId,
		loading,
		error,
		lastRefresh,
		refresh: fetchData,
	};
}
