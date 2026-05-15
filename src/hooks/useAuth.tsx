import { createContext, useCallback, useState, useContext } from "react";

type AuthCredentials = {
	username: string;
	password: string;
};

type AuthContextValue = {
	isAuthenticated: boolean;
	login: (credentials: AuthCredentials) => boolean;
	logout: () => void;
};

const AUTH_SESSION_KEY = "log_dashboard_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
		() => sessionStorage.getItem(AUTH_SESSION_KEY) === "true",
	);

	const login = useCallback(({ username, password }: AuthCredentials) => {
		const valid =
			username === import.meta.env.VITE_ADMIN_CREDENTIALS_USER &&
			password === import.meta.env.VITE_ADMIN_CREDENTIALS_PASSWORD;

		if (valid) {
			sessionStorage.setItem(AUTH_SESSION_KEY, "true");
			setIsAuthenticated(true);
		}
		return valid;
	}, []);

	const logout = useCallback(() => {
		sessionStorage.removeItem(AUTH_SESSION_KEY);
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
