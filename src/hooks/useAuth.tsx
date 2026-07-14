// src/hooks/useAuth.tsx
import {
	createContext,
	useCallback,
	useState,
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
	login: (credentials: AuthCredentials) => Promise<boolean>;
	logout: () => void;
};

// ── Constantes ────────────────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = "logdash:auth:token:v1";

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Retorna o token JWT armazenado, ou null se não existir. */
export function getAuthToken(): string | null {
	return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
		() => sessionStorage.getItem(AUTH_TOKEN_KEY) !== null,
	);

	const login = useCallback(
		async ({ username, password }: AuthCredentials): Promise<boolean> => {
			const { api } = loadApiConfig();

			try {
				const response = await fetch(`${api}/api/auth/login`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ username, password }),
				});

				if (!response.ok) return false;

				const { token } = (await response.json()) as { token: string };
				sessionStorage.setItem(AUTH_TOKEN_KEY, token);
				setIsAuthenticated(true);

				return true;
			} catch {
				return false;
			}
		},
		[],
	);

	const logout = useCallback(() => {
		sessionStorage.removeItem(AUTH_TOKEN_KEY);
		setIsAuthenticated(false);
	}, []);

	return (
		<AuthContext.Provider value={{ isAuthenticated, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
	return ctx;
}
