// ─── StatusBadge ─────────────────────────────────────────────────────────────
export function StatusBadge(status: number) {
	const color =
		status === 1
			? "var(--primary)"
			: status === 2
				? "var(--destructive)"
				: "var(--chart-4)";
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "3px 10px",
				borderRadius: 9999,
				fontSize: 11,
				fontWeight: 700,
				letterSpacing: "0.06em",
				textTransform: "uppercase",
				backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
				color,
				border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
			}}
		>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: "50%",
					backgroundColor: color,
					animation: status ? "pulse 2.5s ease-in-out infinite" : "none",
				}}
			/>
			{status === 1 ? "Iniciado" : status === 2 ? "Erro" : "Finalizado"}
		</span>
	);
}
