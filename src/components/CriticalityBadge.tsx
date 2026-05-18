// src/components/CriticalityBadge.tsx
import { WindowsEventLog } from "../lib/types/Log";

interface CriticalityBadgeProps {
	criticality: WindowsEventLog["criticality"];
	levelLabel: WindowsEventLog["levelLabel"];
}

// Configuração visual por nível de criticidade.
// Separar dados de apresentação da lógica de renderização é
// o Single Responsibility Principle aplicado a componentes.
const CRITICALITY_CONFIG: Record<
	WindowsEventLog["criticality"],
	{ color: string; icon: string; label: string }
> = {
	High: { color: "var(--destructive)", icon: "▲", label: "Alto" },
	Medium: { color: "var(--chart-5)", icon: "●", label: "Médio" },
	Low: { color: "var(--chart-4)", icon: "▼", label: "Baixo" },
	Unknown: { color: "var(--muted-foreground)", icon: "?", label: "?" },
};

export function CriticalityBadge({
	criticality,
	levelLabel,
}: CriticalityBadgeProps) {
	const config = CRITICALITY_CONFIG[criticality];

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			{/* Badge de criticidade — vem da classificação da Microsoft */}
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 5,
					padding: "3px 10px",
					borderRadius: 9999,
					fontSize: 11,
					fontWeight: 700,
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					backgroundColor: `color-mix(in oklch, ${config.color} 12%, transparent)`,
					color: config.color,
					border: `1px solid color-mix(in oklch, ${config.color} 28%, transparent)`,
					width: "fit-content",
				}}
			>
				<span style={{ fontSize: 9 }}>{config.icon}</span>
				{config.label}
			</span>

			{/* Label do level técnico do Windows — contexto adicional */}
			<span
				style={{
					fontSize: 10,
					color: "var(--muted-foreground)",
					paddingLeft: 2,
					letterSpacing: "0.03em",
				}}
			>
				{levelLabel}
			</span>
		</div>
	);
}
