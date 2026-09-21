// src/hooks/useNewDataDetector.ts
import { useState, useEffect, useCallback } from "react";
import { loadApiConfig } from "../lib/storage/logPaths";
import { useAuth } from "./useAuth";
import {
	StreamDataText,
	subscribeToEventsStream,
} from "../lib/subscribeToEventsStream";

export function useNewDataDetector() {
	const [counts, setCounts] = useState<StreamDataText | null>(null);
	const hasNewData =
		counts !== null && Object.values(counts).some((n) => n > 0);
	const { isAuthenticated } = useAuth();

	const dismiss = useCallback(() => setCounts(null), []);

	useEffect(() => {
		if (!isAuthenticated) return;

		const controller = new AbortController();

		async function connect() {
			const { api } = loadApiConfig();
			while (!controller.signal.aborted) {
				try {
					await subscribeToEventsStream(
						`${api}/api/logs/stream`,
						(data) => {
							setCounts((prev) => ({
								app: (prev?.app ?? 0) + data.app,
								process: (prev?.process ?? 0) + data.process,
								"windows-event":
									(prev?.["windows-event"] ?? 0) + data["windows-event"],
							}));
						},
						controller.signal,
					);
				} catch (err: unknown) {
					if (err instanceof Error && err.name === "AbortError") return;
				}

				if (controller.signal.aborted) return;
				await new Promise((resolve) => setTimeout(resolve, 3 * 1000));
			}
		}

		connect();

		return () => {
			controller.abort();
		};
	}, [isAuthenticated]);

	const acknowledge = useCallback(async () => {
		setCounts(null);
	}, []);

	return { hasNewData, dismiss, acknowledge, counts };
}
