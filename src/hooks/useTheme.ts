import React, { createContext, useState, useCallback, useContext } from "react";

// ─── useTheme ────────────────────────────────────────────────────────────────
// Gerencia o dark mode via classe CSS no elemento raiz do componente.
// A variável `isDark` controla a classe `.dark` que ativa as CSS variables
// do dark mode definidas no style.css (ex: --background muda de creme para escuro).
const ThemeContext = createContext(null);

export function ThemeProvider( children: React.PropsWithChildren ) {
	const [isDark, setIsDark] = useState(false);

	const toggle = useCallback(() => {
		setIsDark((prev) => {
			const next = !prev;
			// Em Vite: document.documentElement.classList.toggle("dark", next)
			// aplica o dark mode globalmente. Aqui, usamos um wrapper div.
			// TODO: localStorage.setItem("theme", next ? "dark" : "light");
			return next;
		});
	}, []);

	return (
		<ThemeContext.Provider value={{ isDark, toggle }}>
			{/* A classe "dark" aqui ativa as variáveis CSS do dark mode */}
			<div className={isDark ? "dark" : ""} style={{ minHeight: "100vh" }}>
				{children}
			</div>
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
	return ctx;
}
