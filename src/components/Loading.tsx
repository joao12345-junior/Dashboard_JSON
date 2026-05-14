// ─── LoadingState / ErrorState ────────────────────────────────────────────────
export function LoadingState() {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: 300,
				gap: 14,
			}}
		>
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "3px solid var(--border)",
					borderTopColor: "var(--primary)",
					animation: "spin 0.8s linear infinite",
				}}
			/>
			<span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
				Carregando logs...
			</span>
		</div>
	);
}
