// src/context/BannerPreferenceContext.tsx

import { createContext, useContext, type ReactNode } from "react";
import { useBannerPreference } from "../hooks/useBannerPreference";

interface BannerPreferenceContextValue {
	enabled: boolean;
	toggle: () => void;
}

const BannerPreferenceContext = createContext<
	BannerPreferenceContextValue | undefined
>(undefined);

export function BannerPreferenceProvider({
	children,
}: {
	children: ReactNode;
}) {
	const preference = useBannerPreference();
	return (
		<BannerPreferenceContext.Provider value={preference}>
			{children}
		</BannerPreferenceContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- mesmo padrão de useAuth.tsx/useTheme.tsx: Provider + hook num arquivo só
export function useBannerPreferenceContext(): BannerPreferenceContextValue {
	const context = useContext(BannerPreferenceContext);
	if (context === undefined) throw new Error("contexto usado fora do provider");
	return context;
}
