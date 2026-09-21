// src/hooks/useNotificationPreference.ts

import { useCallback, useState } from "react";

const NOTIFICATION_KEY_LOCALSTORAGE = "logdash.notificationsEnabled";

function readInitial(): boolean {
	return localStorage.getItem(NOTIFICATION_KEY_LOCALSTORAGE) === "true";
}

export function useNotificationPreference() {
	const [enabled, setEnabled] = useState<boolean>(readInitial);

	const toggle = useCallback(async () => {
		if (enabled) {
			localStorage.setItem(NOTIFICATION_KEY_LOCALSTORAGE, "false");
			setEnabled(false);
			return;
		}

		if (!("Notification" in window)) {
			localStorage.setItem(NOTIFICATION_KEY_LOCALSTORAGE, "true");
			setEnabled(true);
			return;
		}

		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			localStorage.setItem(NOTIFICATION_KEY_LOCALSTORAGE, "true");
			setEnabled(true);
		}
	}, [enabled]);

	return { enabled, toggle };
}
