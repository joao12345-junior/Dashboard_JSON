// src/components/NewDataBanner.tsx

interface NewDataBannerProps {
	onRefresh: () => void;
	onDismiss: () => void;
}

/**
 * Banner não-bloqueante que convida o usuário a recarregar
 * quando novos dados estão disponíveis no servidor.
 *
 * Responsabilidade única: ação futura (diferente do Toast,
 * que notifica sobre eventos passados).
 */
export function NewDataBanner({ onRefresh, onDismiss }: NewDataBannerProps) {
	return (
		<div
			style={{
				position: "fixed",
				bottom: 80,
				right: 16,
				zIndex: 200,
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderLeft: "3px solid var(--primary)",
				padding: "12px 16px",
				borderRadius: 8,
				fontSize: 13,
				maxWidth: 320,
				boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div style={{ fontWeight: 600, color: "var(--foreground)" }}>
				Novos dados disponíveis
			</div>
			<div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
				Registros foram adicionados desde a última atualização.
			</div>
			<div style={{ display: "flex", gap: 8 }}>
				<button
					onClick={onRefresh}
					style={{
						flex: 1,
						padding: "6px 12px",
						borderRadius: 6,
						border: "none",
						backgroundColor: "var(--primary)",
						color: "var(--primary-foreground)",
						fontSize: 12,
						fontWeight: 600,
						cursor: "pointer",
						fontFamily: "inherit",
					}}
				>
					Atualizar
				</button>
				<button
					onClick={onDismiss}
					style={{
						padding: "6px 12px",
						borderRadius: 6,
						border: "1px solid var(--border)",
						backgroundColor: "transparent",
						color: "var(--muted-foreground)",
						fontSize: 12,
						cursor: "pointer",
						fontFamily: "inherit",
					}}
				>
					Ignorar
				</button>
			</div>
		</div>
	);
}
