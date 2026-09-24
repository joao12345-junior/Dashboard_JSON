// src/context/NotificationPreferenceContext.tsx

import { createContext, useContext, type ReactNode } from "react";
import { useNotificationPreference } from "../hooks/useNotificationPreference";

interface NotificationPreferenceContextValue {
	enabled: boolean;
	toggle: () => Promise<void>;
}

const NotificationPreferenceContext = createContext<
	NotificationPreferenceContextValue | undefined
>(undefined);

export function NotificationPreferenceProvider({
	children,
}: {
	children: ReactNode;
}) {
	const preference = useNotificationPreference();
	return (
		<NotificationPreferenceContext.Provider value={preference}>
			{children}
		</NotificationPreferenceContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- mesmo padrão de useAuth.tsx/useTheme.tsx: Provider + hook num arquivo só
export function useNotificationPreferenceContext(): NotificationPreferenceContextValue {
	const context = useContext(NotificationPreferenceContext);
	if (context === undefined) throw new Error("contexto usado fora do Provider");
	return context;
}
