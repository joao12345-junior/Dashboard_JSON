// src/components/CriticalityBadge.tsx
import { WindowsEventLog } from "../lib/types/Log";

interface CriticalityBadgeProps {
	criticality: WindowsEventLog["criticality"];
	levelLabel: string;
}

/**
 * Badge de criticidade para Windows Event Logs.
 *
 * Exibe dois elementos em coluna:
 * - O nível de criticidade com cor semântica (ALTO / MÉDIO / BAIXO)
 * - O label técnico do Windows (Crítico / Erro / Aviso)
 *
 * Por que flexDirection: column e não row?
 * A coluna de status tem largura limitada (140px).
 * Em coluna, os dois elementos sempre cabem sem truncar.
 */
export function CriticalityBadge({
	criticality,
	levelLabel,
}: CriticalityBadgeProps) {
	const color =
		criticality === "High"
			? "var(--destructive)"
			: criticality === "Medium"
				? "var(--chart-5)"
				: "var(--chart-4)";

	const label =
		criticality === "High"
			? "ALTO"
			: criticality === "Medium"
				? "MÉDIO"
				: "BAIXO";

	return (
		<div
			style={{
				display: "inline-flex",
				flexDirection: "column",
				alignItems: "flex-start",
				gap: 2,
			}}
		>
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					padding: "2px 8px",
					borderRadius: 4,
					backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
					color,
					fontSize: 10,
					fontWeight: 700,
					whiteSpace: "nowrap",
				}}
			>
				▲ {label}
			</span>
			<span
				style={{
					fontSize: 10,
					color: "var(--muted-foreground)",
					paddingLeft: 2,
				}}
			>
				{levelLabel}
			</span>
		</div>
	);
}
