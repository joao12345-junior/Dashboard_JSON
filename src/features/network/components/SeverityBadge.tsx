// src/features/network/components/SeverityBadge.tsx
import { severityLabel, severityTone, type SeverityTone } from "../severity";

/** Cores por faixa (tokens do tema; texto legível em claro e escuro). */
const TONE_COLOR: Record<SeverityTone, string> = {
	high: "var(--destructive-text)",
	medium: "var(--warning-text)",
	low: "var(--muted-foreground)",
	unknown: "var(--muted-foreground)",
};

/// <summary>
/// Selo de gravidade de um evento de rede. A cor não é a única pista: o texto
/// ("Alta", "Média", "Baixa") e o número CEF ficam sempre visíveis.
/// </summary>
export function SeverityBadge({ severity }: { severity: number | null }) {
	const tone = severityTone(severity);
	const color = TONE_COLOR[tone];
	return (
		<span
			style={{
				display: "inline-block",
				fontSize: 11,
				fontWeight: 700,
				padding: "3px 10px",
				borderRadius: 20,
				color,
				backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
				whiteSpace: "nowrap",
			}}
		>
			{severityLabel(severity)}
			{severity !== null ? ` · ${severity}` : ""}
		</span>
	);
}
