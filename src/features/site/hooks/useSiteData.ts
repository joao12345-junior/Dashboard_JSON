// src/features/site/useSiteData.ts
import { useState, useEffect, useCallback } from "react";
import { loadApiConfig } from "../../../lib/storage/logPaths";
import { getAuthToken } from "../../../hooks/useAuth";

export interface AvailabilityRecord {
	id: number;
	url: string;
	status_code: number | null;
	response_time_ms: number;
	is_up: boolean;
	checked_at: string;
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

export interface SiteData {
	availability: AvailabilityRecord[];
	sentryEvents: SentryEvent[];
	loading: boolean;
	error: string | null;
	lastRefresh: Date | null;
	refresh: () => void;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export function useSiteData(): SiteData {
	const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
	const [sentryEvents, setSentryEvents] = useState<SentryEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

	const fetch = useCallback(async () => {
		const { url } = loadApiConfig();
		const token = getAuthToken();
		if (!token) return;

		setLoading(true);
		setError(null);

		try {
			const [availRes, sentryRes] = await Promise.all([
				window.fetch(`${url}/api/site/availability`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
				window.fetch(`${url}/api/site/sentry-events`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
			]);

			if (!availRes.ok || !sentryRes.ok)
				throw new Error("Erro ao buscar dados do site");

			const [availData, sentryData] = await Promise.all([
				availRes.json(),
				sentryRes.json(),
			]);

			setAvailability(availData);
			setSentryEvents(sentryData);
			setLastRefresh(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro desconhecido");
		} finally {
			setLoading(false);
		}
	}, []);

	// Fetch inicial + intervalo de 5 minutos
	useEffect(() => {
		fetch();
		const interval = setInterval(fetch, REFRESH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [fetch]);

	return {
		availability,
		sentryEvents,
		loading,
		error,
		lastRefresh,
		refresh: fetch,
	};
}
