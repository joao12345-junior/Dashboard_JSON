// src/components/Toast.tsx

import { useEffect } from "react";

export type ToastType = "message" | "error";

interface ToastProps {
	message: string | null;
	type?: ToastType;
	onDismiss: () => void;
}

export function Toast({ message, type = "message", onDismiss }: ToastProps) {
	useEffect(() => {
		if (!message) return;

		const timer = setTimeout(onDismiss, 4000);

		return () => clearTimeout(timer);
	}, [message, onDismiss]);

	const icons = {
		message: "✓",
		error: "✕",
		promise: "⏳",
	};

	// A região viva (role=status/alert) precisa existir ANTES do texto aparecer,
	// senão leitores de tela não anunciam; por isso ela é sempre renderizada.
	return (
		<div
			role={type === "error" ? "alert" : "status"}
			aria-live={type === "error" ? "assertive" : "polite"}
			aria-atomic="true"
		>
			{message && (
			<div
				onClick={onDismiss}
				style={{
					position: "fixed",
					bottom: 80,
					left: 16,
					zIndex: 200,

					backgroundColor: "var(--foreground)",
					color: "var(--background)",

					padding: "10px 16px",
					borderRadius: 8,

					fontSize: 13,
					fontWeight: 500,

					cursor: "pointer",
					maxWidth: 360,

					boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
					animation: "fadeIn 0.2s ease",

					display: "flex",
					alignItems: "center",
					gap: 8,
				}}
			>
				<span>{icons[type]}</span>
				<span>{message}</span>
			</div>
			)}
		</div>
	);
}
