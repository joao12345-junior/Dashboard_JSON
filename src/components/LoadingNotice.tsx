// src/components/LoadingNotice.tsx

interface LoadingNoticeProps {
	/** 0–100. Só aparece escrito; leitores de tela recebem a frase fixa (sem spam). */
	percent: number;
}

/**
 * Aviso de "os números ainda estão chegando", mostrado acima do conteúdo.
 * A frase para leitores de tela não muda com o percentual (evita anunciar a
 * cada lote); o percentual é só visual.
 */
export function LoadingNotice({ percent }: LoadingNoticeProps) {
	return (
		<div
			role="status"
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "10px 14px",
				borderRadius: 8,
				backgroundColor: "color-mix(in oklch, var(--primary) 8%, transparent)",
				border: "1px solid color-mix(in oklch, var(--primary) 25%, transparent)",
				color: "var(--foreground)",
				fontSize: 12,
			}}
		>
			<span
				aria-hidden="true"
				className="ld-spinner"
				style={{
					width: 14,
					height: 14,
					flexShrink: 0,
					borderRadius: "50%",
					border: "2px solid var(--border)",
					borderTopColor: "var(--primary)",
				}}
			/>
			<span>Carregando registros. Os totais abaixo ainda estão incompletos.</span>
			<span
				aria-hidden="true"
				style={{
					marginLeft: "auto",
					fontVariantNumeric: "tabular-nums",
					color: "var(--muted-foreground)",
					fontWeight: 700,
				}}
			>
				{percent}%
			</span>
		</div>
	);
}
