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
// O access token vive só em memória — nunca em localStorage/sessionStorage.
// Isso é intencional: reduz a superfície de roubo via XSS (nada de token
// sentado num storage que qualquer script na página consegue ler).
// O preço é que ele não sobrevive a um F5 sozinho — por isso a reidratação
// silenciosa no useEffect do AuthProvider, usando o cookie httpOnly.

let accessToken: string | null = null;

// Callback registrado pelo AuthProvider — authorizedFetch usa isso pra
// notificar a UI quando o refresh falha de vez (sessão realmente expirada),
// já que uma função de módulo não tem acesso direto ao setState do React.
let onSessionExpired: (() => void) | null = null;

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
			credentials: "include", // obrigatório — é o que faz o cookie ir/voltar
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
 * fetch autenticado com retry automático em 401.
 *
 * Fluxo: tenta com o access token atual. Se voltar 401 (expirado),
 * tenta UMA renovação via /api/auth/refresh e repete a chamada original
 * com o token novo. Se o refresh também falhar, a sessão morreu de
 * verdade — notifica o AuthProvider pra derrubar pra tela de login.
 *
 * Por que só uma tentativa de retry, não um loop?
 * Se o refresh renovado também voltar 401, insistir não vai ajudar —
 * o problema não é token velho, é outra coisa (revogado, banco fora do ar).
 * Loop aqui só esconderia o erro real atrás de tentativas inúteis.
 */
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
		const newToken = await requestAccessToken();
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

	// Reidratação silenciosa: na primeira carga da página, tenta trocar o
	// cookie httpOnly (se existir e for válido) por um access token novo.
	// Isso é o que substitui "ler token do localStorage" — sem isso, todo
	// F5 jogaria o usuário pra tela de login mesmo com sessão válida.
	useEffect(() => {
		requestAccessToken()
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
			// Falha de rede no logout não deveria travar o usuário na sessão —
			// o estado local já foi limpo acima, o que importa pro frontend.
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
