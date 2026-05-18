// src/features/home/components/GlobalKpiRow.tsx
import { Page } from "../../../App";
import { HomeStats } from "../usehomeStats";

interface GlobalKpiRowProps {
	totalErrors: number;
	totalWarnings: number;
	totalLogs: number; // ← adiciona aqui
	byType: HomeStats["byType"];
	onNavigate: (page: Page) => void;
}

export function GlobalKpiRow({
	totalErrors,
	totalWarnings,
	byType,
	totalLogs,
	onNavigate,
}: GlobalKpiRowProps) {
	const cards = [
		{
			label: "Total de Logs",
			value: totalLogs,
			accentColor: "var(--foreground)",
			detail: "Todos os tipos carregados",
			navigate: null as Page | null,
		},
		{
			label: "Erros Críticos",
			value: totalErrors,
			accentColor: "var(--destructive)",
			detail: `${byType.process.errors} processo · ${byType.windowsEvent.high} Windows`,
			navigate: null as Page | null,
		},
		{
			label: "Avisos",
			value: totalWarnings,
			accentColor: "var(--chart-5)",
			detail: `${byType.process.warnings} processo · ${byType.windowsEvent.medium} Windows`,
			navigate: null as Page | null,
		},
		{
			label: "Logs de Processo",
			value: byType.process.total,
			accentColor: "var(--primary)",
			detail: "Ver registros →",
			navigate: "process-list" as Page,
		},
		{
			label: "Windows Event Logs",
			value: byType.windowsEvent.total,
			accentColor: "var(--chart-4)",
			detail: "Ver registros →",
			navigate: "windows-list" as Page,
		},
	];

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
				gap: 16,
			}}
		>
			{cards.map((card) => (
				<div
					key={card.label}
					onClick={() => card.navigate && onNavigate(card.navigate)}
					style={{
						backgroundColor: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 10,
						padding: "20px 24px",
						cursor: card.navigate ? "pointer" : "default",
						borderLeft: `3px solid ${card.accentColor}`,
						transition: "background-color 0.15s",
					}}
					onMouseEnter={(e) => {
						if (card.navigate)
							e.currentTarget.style.backgroundColor = "var(--accent)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "var(--card)";
					}}
				>
					<div
						style={{
							fontSize: 11,
							fontWeight: 700,
							color: "var(--muted-foreground)",
							textTransform: "uppercase",
							letterSpacing: "0.1em",
							marginBottom: 8,
						}}
					>
						{card.label}
					</div>
					<div
						style={{
							fontSize: 32,
							fontWeight: 800,
							color: card.accentColor,
							lineHeight: 1,
							fontVariantNumeric: "tabular-nums",
						}}
					>
						{card.value.toLocaleString("pt-BR")}
					</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							marginTop: 8,
						}}
					>
						{card.detail}
					</div>
				</div>
			))}
		</div>
	);
}
