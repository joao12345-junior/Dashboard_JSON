// src/hooks/useBannerPreference.tsx

import { useCallback, useState } from "react";

const BANNER_KEY_LOCALSTORAGE = "logdash:newDataBanner:enabled";

function readInitial(): boolean {
	return localStorage.getItem(BANNER_KEY_LOCALSTORAGE) !== null;
}

export function useBannerPreference() {
	const [enabled, setEnabled] = useState<boolean>(readInitial);

	const toggle = useCallback(() => {
		if (enabled) {
			localStorage.setItem(BANNER_KEY_LOCALSTORAGE, "false");
			setEnabled(false);
			return;
		}
		setEnabled(true);
	}, [enabled]);

	return { enabled, toggle };
}
