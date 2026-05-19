// src/components/ProgressBar.tsx
interface ProgressBarProps {
	percent: number;
	marginBottom?: number;
}

export function ProgressBar({ percent, marginBottom = 24 }: ProgressBarProps) {
	return (
		<div
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
