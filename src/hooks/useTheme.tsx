import React, {
	createContext,
	useState,
	useContext,
	useEffect,
	useCallback,
} from "react";

interface ThemeContextValue {
	isDark: boolean;
	toggle: () => void;
}

// ─── useTheme ────────────────────────────────────────────────────────────────
// Gerencia o dark mode via classe CSS no elemento raiz do componente.
// A variável `isDark` controla a classe `.dark` que ativa as CSS variables
// do dark mode definidas no style.css (ex: --background muda de creme para escuro).
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): boolean {
	const saved = localStorage.getItem("theme");
	if (saved === "dark") return true;
	if (saved === "light") return false;

	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
	const [isDark, setIsDark] = useState<boolean>(resolveInitialTheme);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDark);
		localStorage.setItem("theme", isDark ? "dark" : "light");
	}, [isDark]);

	const toggle = useCallback(() => {
		setIsDark((prev) => !prev);
	}, []);

	return (
		<ThemeContext.Provider value={{ isDark, toggle }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
	return ctx;
}
