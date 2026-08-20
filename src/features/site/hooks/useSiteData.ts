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
	timeout_seconds: number;
	has_sentry: boolean;
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
	refreshMonitoredUrls: () => void;
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

	const fetchMonitoredUrls = useCallback(async () => {
		const { api } = loadApiConfig();
		try {
			const res = await authorizedFetch(`${api}/api/site/monitored-urls`);
			if (!res.ok) throw new Error("Erro ao buscar sites monitorados");
			const urls: MonitoredUrl[] = await res.json();
			setMonitoredUrls(urls);
			setSelectedUrlId((current) => current ?? urls[0]?.id ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro ao buscar sites");
		}
	}, []);

	useEffect(() => {
		if (!isAuthenticated) return;
		fetchMonitoredUrls();
	}, [isAuthenticated, fetchMonitoredUrls]);

	const selectedSite =
		monitoredUrls.find((mu) => mu.id === selectedUrlId) ?? null;

	const fetchData = useCallback(async () => {
		if (!selectedUrlId) return;

		const { api } = loadApiConfig();
		setLoading(true);
		setError(null);

		try {
			const availPromise = authorizedFetch(
				`${api}/api/site/availability?monitored_url_id=${selectedUrlId}`,
			);
			const sentryPromise = selectedSite?.has_sentry
				? authorizedFetch(`${api}/api/site/sentry-events`)
				: Promise.resolve(null);

			const [availRes, sentryRes] = await Promise.all([
				availPromise,
				sentryPromise,
			]);

			if (!availRes.ok || (sentryRes && !sentryRes.ok))
				throw new Error("Erro ao buscar dados do site");

			const availData = await availRes.json();
			const sentryData = sentryRes ? await sentryRes.json() : [];

			setAvailability(availData);
			setSentryEvents(sentryData);
			setLastRefresh(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		} finally {
			setLoading(false);
		}
	}, [selectedUrlId, selectedSite?.has_sentry]);

	useEffect(() => {
		if (!isAuthenticated || !selectedUrlId) return;
		fetchData();
		const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [isAuthenticated, selectedUrlId, fetchData]);

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
		refreshMonitoredUrls: fetchMonitoredUrls,
	};
}
