// src/components/charts/KpiCard.tsx
interface KpiCardProps {
	label: string;
	value: number | string;
	accentColor: string;
	subtitle?: string;
}

export function KpiCard({ label, value, accentColor, subtitle }: KpiCardProps) {
	return (
		<div
			style={{
				padding: "20px 24px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				borderLeft: `3px solid ${accentColor}`,
				display: "flex",
				flexDirection: "column",
				gap: 6,
			}}
		>
			<span
				style={{
					fontSize: 10,
					fontWeight: 700,
					color: "var(--muted-foreground)",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
				}}
			>
				{label}
			</span>
			<span
				style={{
					fontSize: 36,
					fontWeight: 800,
					color: accentColor,
					letterSpacing: "-0.04em",
					lineHeight: 1,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{value}
			</span>
			{subtitle && (
				<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
					{subtitle}
				</span>
			)}
		</div>
	);
}
