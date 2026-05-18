// src/features/windows-event/components/TopProviders.tsx
import { WindowsStats } from "../useWindowsStats";

interface TopProvidersProps {
	providers: WindowsStats["topProviders"];
	total: number;
}

export function TopProviders({ providers, total }: TopProvidersProps) {
	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				overflow: "hidden",
			}}
		>
			{/* Cabeçalho */}
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				<div
					style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}
				>
					Top Providers
				</div>
				<div
					style={{
						fontSize: 11,
						color: "var(--muted-foreground)",
						marginTop: 2,
					}}
				>
					Fontes com mais eventos registrados
				</div>
			</div>

			{/* Lista */}
			<div
				style={{
					padding: "12px 20px",
					display: "flex",
					flexDirection: "column",
					gap: 14,
				}}
			>
				{providers.length === 0 && (
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
				{providers.map((provider) => {
					const pct =
						total > 0 ? Math.round((provider.count / total) * 100) : 0;

					return (
						<div key={provider.name}>
							{/* Nome + contagem */}
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
									{/* Remove o prefixo "Microsoft-Windows-" para economizar espaço */}
									{provider.name.replace("Microsoft-Windows-", "") || "—"}
								</span>
								<span
									style={{
										fontSize: 12,
										color: "var(--muted-foreground)",
										fontVariantNumeric: "tabular-nums",
										flexShrink: 0,
									}}
								>
									{provider.count} ({pct}%)
								</span>
							</div>

							{/* Barra de progresso */}
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
										backgroundColor: "var(--destructive)",
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
