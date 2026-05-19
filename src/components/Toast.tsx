// src/components/Toast.tsx

import { useEffect, useState } from "react";

interface ToastProps {
	message: string | null;
	onDismiss: () => void;
}

/**
 * Toast não-bloqueante — aparece no canto inferior esquerdo,
 * some automaticamente após 4 segundos ou ao clicar.
 *
 * Por que não usar uma biblioteca externa?
 * O projeto minimiza dependências por design. Este componente
 * cobre 100% do caso de uso sem adicionar peso ao bundle.
 */
export function Toast({ message, onDismiss }: ToastProps) {
	useEffect(() => {
		if (!message) return;
		const timer = setTimeout(onDismiss, 4000);
		return () => clearTimeout(timer);
	}, [message, onDismiss]);

	if (!message) return null;

	return (
		<div
			onClick={onDismiss}
			style={{
				position: "fixed",
				bottom: 80, // acima do DebugPanel
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
			}}
		>
			✓ {message}
		</div>
	);
}
