import { useState, useEffect } from "react";

// ─── useWindowSize ────────────────────────────────────────────────────────────
// Detecta o tamanho da janela para decisões de layout responsivo.
// useEffect com cleanup remove o listener quando o componente desmonta.
export function useWindowSize() {
	const [width, setWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1200,
	);
	useEffect(() => {
		const handler = () => setWidth(window.innerWidth);
		window.addEventListener("resize", handler);
		return () => window.removeEventListener("resize", handler);
	}, []);
	return width;
}
