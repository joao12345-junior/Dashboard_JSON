// ─── LoadingState / AppPreloader ──────────────────────────────────────────────

interface LoadingProps {
	/** Texto lido por leitores de tela e mostrado na tela. */
	label?: string;
}

/** Spinner genérico para áreas pequenas. */
export function LoadingState({ label = "Carregando…" }: LoadingProps) {
	return (
		<div
			role="status"
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
				aria-hidden="true"
				className="ld-spinner"
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "3px solid var(--border)",
					borderTopColor: "var(--primary)",
				}}
			/>
			<span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
				{label}
			</span>
		</div>
	);
}

/**
 * Tela cheia mostrada enquanto o app confirma a sessão (antes de saber se vai
 * para o login ou para a Home).
 *
 * Aparece com atraso de 150 ms (CSS, `.ld-preloader`) para não piscar quando a
 * sessão restaura rápido, e respeita `prefers-reduced-motion`.
 */
export function AppPreloader({ label = "Carregando…" }: LoadingProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				height: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "var(--background)",
			}}
		>
			<div
				className="ld-preloader"
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 18,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<svg
						aria-hidden="true"
						width="36"
						height="36"
						viewBox="0 0 36 36"
						style={{ flexShrink: 0 }}
					>
						<rect width="36" height="36" rx="9" fill="var(--primary)" />
						<rect x="8" y="19" width="4.5" height="9" rx="1.5" fill="var(--primary-foreground)" />
						<rect x="15.75" y="12" width="4.5" height="16" rx="1.5" fill="var(--primary-foreground)" />
						<rect x="23.5" y="8" width="4.5" height="20" rx="1.5" fill="var(--primary-foreground)" />
					</svg>
					<span
						style={{
							fontSize: 22,
							fontWeight: 800,
							letterSpacing: "-0.02em",
							color: "var(--foreground)",
						}}
					>
						LogDash
					</span>
				</div>
				<div aria-hidden="true" className="ld-indeterminate">
					<span />
				</div>
				<span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
					{label}
				</span>
			</div>
		</div>
	);
}
