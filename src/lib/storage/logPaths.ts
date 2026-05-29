// src/lib/storage/logPaths.ts
export const LOG_PATHS_KEY = "logPaths";

export function loadLogPaths(): string[] {
	try {
		const raw = localStorage.getItem(LOG_PATHS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
	} catch {
		return [];
	}
}

export function saveLogPaths(paths: string[]) {
	try {
		localStorage.setItem(LOG_PATHS_KEY, JSON.stringify(paths));
	} catch {
		// ignore write errors (quota, private mode)
	}
}
