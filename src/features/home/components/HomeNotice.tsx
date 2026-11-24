// src/features/home/components/HomeNotice.tsx
import type { ReactNode } from "react";

interface HomeNoticeProps {
	/** warn = laranja (atenção); danger = vermelho (algo parado). */
	tone: "warn" | "danger";
	actionLabel: string;
	onAction: () => void;
	children: ReactNode;
}

/// <summary>
/// Faixa de aviso da Home (texto + um botão de ação). Compartilhada pelos avisos de
/// programas ocultos e de saúde do sistema, para os dois terem o mesmo visual.
/// </summary>
export function HomeNotice({ tone, actionLabel, onAction, children }: HomeNoticeProps) {
	return (
		<div
			role="status"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				flexWrap: "wrap",
				padding: "10px 14px",
				marginBottom: 16,
				border: "1px solid var(--border)",
				borderLeft: `3px solid ${tone === "danger" ? "var(--destructive)" : "var(--chart-4)"}`,
				borderRadius: 8,
				backgroundColor: "var(--card)",
				fontSize: 13,
				color: "var(--foreground)",
			}}
		>
			<span>{children}</span>
			<button type="button" className="ld-link-btn" onClick={onAction}>
				{actionLabel}
			</button>
		</div>
	);
}
