// src/hooks/useAuth.tsx
import {
	createContext,
	useCallback,
	useState,
	useEffect,
	useContext,
	type ReactNode,
} from "react";
import { loadApiConfig } from "../lib/storage/logPaths";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AuthCredentials = {
	username: string;
	password: string;
};

type AuthContextValue = {
	isAuthenticated: boolean;
	isInitializing: boolean;
	login: (credentials: AuthCredentials) => Promise<boolean>;
	logout: () => Promise<void>;
};

// ── Estado de módulo ──────────────────────────────────────────────────────────

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

/**
 * Deduplicação de refresh concorrente.
 *
 * Sem isso, N chamadas simultâneas que tomam 401 (comum: useProgressiveLogs
 * dispara 3 fetches em paralelo, useSiteData mais 3) cada uma tenta seu
 * próprio /api/auth/refresh. Como o refresh token é rotacionado a cada uso
 * (o antigo é revogado assim que um novo é emitido), a segunda chamada em
 * diante bate num token já revogado pelo primeiro — corrida real, não
 * hipotética, foi o que aconteceu no F5 que você testou.
 *
 * Com isFlightRefresh: a primeira chamada inicia o refresh de verdade;
 * todas as outras que chegam enquanto ele está em andamento recebem a
 * MESMA Promise, em vez de disparar uma chamada de rede própria.
 */
let inFlightRefresh: Promise<string | null> | null = null;

export function getAuthToken(): string | null {
	return accessToken;
}

async function requestAccessToken(
	credentials?: AuthCredentials,
): Promise<string | null> {
	const { api } = loadApiConfig();
	const url = credentials ? `${api}/api/auth/login` : `${api}/api/auth/refresh`;

	try {
		const response = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: credentials ? { "Content-Type": "application/json" } : undefined,
			body: credentials ? JSON.stringify(credentials) : undefined,
		});

		if (!response.ok) {
			accessToken = null;
			return null;
		}

		const data = (await response.json()) as { token: string };
		accessToken = data.token;
		return accessToken;
	} catch {
		accessToken = null;
		return null;
	}
}

/**
 * Ponto único de refresh — usado tanto pela reidratação inicial quanto
 * pelo retry automático do authorizedFetch. Garante uma chamada de rede
 * por vez, não uma por chamador.
 */
function refreshAccessToken(): Promise<string | null> {
	if (inFlightRefresh) return inFlightRefresh;

	inFlightRefresh = requestAccessToken().finally(() => {
		inFlightRefresh = null;
	});

	return inFlightRefresh;
}

export async function authorizedFetch(
	input: string,
	init: RequestInit = {},
): Promise<Response> {
	const doFetch = (token: string | null) =>
		fetch(input, {
			...init,
			headers: {
				...(init.headers ?? {}),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		});

	let response = await doFetch(accessToken);

	if (response.status === 401) {
		const newToken = await refreshAccessToken();
		if (newToken) {
			response = await doFetch(newToken);
		} else {
			onSessionExpired?.();
		}
	}

	return response;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isInitializing, setIsInitializing] = useState(true);

	useEffect(() => {
		onSessionExpired = () => setIsAuthenticated(false);
		return () => {
			onSessionExpired = null;
		};
	}, []);

	useEffect(() => {
		refreshAccessToken()
			.then((token) => setIsAuthenticated(token !== null))
			.finally(() => setIsInitializing(false));
	}, []);

	const login = useCallback(
		async (credentials: AuthCredentials): Promise<boolean> => {
			const token = await requestAccessToken(credentials);
			setIsAuthenticated(token !== null);
			return token !== null;
		},
		[],
	);

	const logout = useCallback(async () => {
		const { api } = loadApiConfig();
		accessToken = null;
		setIsAuthenticated(false);
		try {
			await fetch(`${api}/api/auth/logout`, {
				method: "POST",
				credentials: "include",
			});
		} catch {
			// idem: falha de rede no logout não deveria travar o usuário logado
		}
	}, []);

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, isInitializing, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
	return ctx;
}
