interface ErrorStateProps {
	message: string;
	/** Se passado, mostra o botão "Tentar de novo". */
	onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
	return (
		<div
			role="alert"
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
			{onRetry && (
				<div style={{ marginTop: 12 }}>
					<button
						type="button"
						className="ld-chip"
						onClick={onRetry}
						style={{
							padding: "6px 14px",
							borderRadius: 6,
							border: "1px solid currentColor",
							backgroundColor: "transparent",
							color: "inherit",
							fontSize: 12,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						Tentar de novo
					</button>
				</div>
			)}
		</div>
	);
}
