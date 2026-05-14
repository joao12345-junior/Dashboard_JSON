interface StatCardProps {
	label: string;
	value: number;
	accentColor: string;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, accentColor }: StatCardProps) {
	return (
		<div
			style={{
				padding: "16px 20px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				borderLeft: `3px solid ${accentColor}`,
			}}
		>
			<div
				style={{
					fontSize: 10,
					fontWeight: 700,
					color: "var(--muted-foreground)",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
					marginBottom: 6,
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontSize: 30,
					fontWeight: 800,
					color: accentColor,
					fontVariantNumeric: "tabular-nums",
					letterSpacing: "-0.04em",
					lineHeight: 1,
				}}
			>
				{value}
			</div>
		</div>
	);
}
