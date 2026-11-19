// src/components/ProgressBar.tsx
interface ProgressBarProps {
	percent: number;
	marginBottom?: number;
	/** Nome lido por leitores de tela. */
	label?: string;
}

export function ProgressBar({
	percent,
	marginBottom = 24,
	label = "Carregando registros",
}: ProgressBarProps) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(percent)}
			style={{
				height: 3,
				backgroundColor: "var(--muted)",
				borderRadius: 9999,
				marginBottom,
				overflow: "hidden",
			}}
		>
			<div
				style={{
					height: "100%",
					width: `${percent}%`,
					backgroundColor: "var(--primary)",
					transition: "width 0.3s ease",
					borderRadius: 9999,
				}}
			/>
		</div>
	);
}
