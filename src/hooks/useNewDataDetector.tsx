// src/hooks/useNewDataDetector.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { loadApiConfig } from "../lib/storage/logPaths";
import { authorizedFetch, useAuth } from "./useAuth";

interface LastActivity {
	backup: string | null;
	windows: string | null;
	site: string | null;
	app: string | null;
}

const POLL_INTERVAL_MS = 60 * 1000;

export function useNewDataDetector() {
	const [hasNewData, setHasNewData] = useState(false);
	const baseline = useRef<LastActivity | null>(null);
	const { isAuthenticated } = useAuth();

	const fetchActivity = useCallback(async (): Promise<LastActivity | null> => {
		const { api } = loadApiConfig();

		try {
			const res = await authorizedFetch(`${api}/api/logs/last-activity`);
			if (!res.ok) return null;
			return await res.json();
		} catch {
			return null;
		}
	}, []);

	const dismiss = useCallback(() => setHasNewData(false), []);

	useEffect(() => {
		if (!isAuthenticated) return;

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
	}, [isAuthenticated, fetchActivity]);

	const acknowledge = useCallback(async () => {
		const current = await fetchActivity();
		if (current) baseline.current = current;
		setHasNewData(false);
	}, [fetchActivity]);

	return { hasNewData, dismiss, acknowledge };
}
