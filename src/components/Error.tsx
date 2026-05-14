export function ErrorState(message: string) {
	return (
		<div
			style={{
				padding: 24,
				borderRadius: 8,
				backgroundColor: `color-mix(in oklch, var(--status-error) 8%, transparent)`,
				border: `1px solid color-mix(in oklch, var(--status-error) 25%, transparent)`,
				color: "var(--status-error)",
				fontSize: 13,
			}}
		>
			<strong>Erro ao carregar logs:</strong> {message}
		</div>
	);
}
