// src/features/app-logs/components/AppTopOrigens.tsx
import { AppStats } from "../useAppStats";

interface AppTopOrigensProps {
	origens: AppStats["topOrigens"];
	total: number;
}

export function AppTopOrigens({ origens, total }: AppTopOrigensProps) {
	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				overflow: "hidden",
			}}
		>
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				<div
					style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}
				>
					Top Origens
				</div>
				<div
					style={{
						fontSize: 11,
						color: "var(--muted-foreground)",
						marginTop: 2,
					}}
				>
					Módulos com mais logs registrados
				</div>
			</div>

			<div
				style={{
					padding: "12px 20px",
					display: "flex",
					flexDirection: "column",
					gap: 14,
				}}
			>
				{origens.length === 0 && (
					<div
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							textAlign: "center",
							padding: "16px 0",
						}}
					>
						Nenhum dado disponível
					</div>
				)}
				{origens.map((origem) => {
					const pct = total > 0 ? Math.round((origem.count / total) * 100) : 0;

					return (
						<div key={origem.name}>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									marginBottom: 5,
								}}
							>
								<span
									style={{
										fontSize: 12,
										color: "var(--foreground)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										maxWidth: "65%",
									}}
								>
									{origem.name}
								</span>
								<span
									style={{
										fontSize: 12,
										color: "var(--muted-foreground)",
										fontVariantNumeric: "tabular-nums",
										flexShrink: 0,
									}}
								>
									{origem.count} ({pct}%)
								</span>
							</div>

							<div
								style={{
									height: 5,
									backgroundColor: "var(--muted)",
									borderRadius: 9999,
								}}
							>
								<div
									style={{
										height: "100%",
										width: `${pct}%`,
										backgroundColor: "var(--primary)",
										borderRadius: 9999,
										transition: "width 0.4s ease",
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
