// src/features/site/SiteDashboard.tsx
import { useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { useWindowSize } from "../../hooks/useWindowSize";
import type { SharedPageProps } from "../../App";
import type { AvailabilityRecord } from "./hooks/useSiteData";

// ── Cor de acento do site Optare ──────────────────────────────────────────────
const OPTARE_RED = "oklch(0.3800 0.1523 18.6219)";
const OPTARE_RED_MUTED =
	"color-mix(in oklch, oklch(0.3800 0.1523 18.6219) 12%, transparent)";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// ── Mini gráfico de barras de disponibilidade ─────────────────────────────────
function AvailabilityBarChart({ records }: { records: AvailabilityRecord[] }) {
	// Agrupa por dia, calcula % uptime por dia
	const byDay = new Map<
		string,
		{ up: number; total: number; date: Date; label: string }
	>();

	records.forEach((r) => {
		const date = new Date(r.checked_at);

		const key = date.toISOString().slice(0, 10);

		const label = date.toLocaleDateString("pt-BR", {
			timeZone: "America/Sao_Paulo",
			day: "2-digit",
			month: "2-digit",
			year: "2-digit",
		});

		const existing = byDay.get(key) ?? {
			up: 0,
			total: 0,
			date,
			label,
		};

		byDay.set(key, {
			up: existing.up + (r.is_up ? 1 : 0),
			total: existing.total + 1,
			date: existing.date,
			label: existing.label,
		});
	});

	const days = Array.from(byDay.entries())
		.sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
		.slice(-15)
		.map(([, { label, up, total }]) => ({
			day: label,
			percent: Math.round((up / total) * 100),
		}));

	if (days.length === 0) {
		return (
			<div
				style={{
					padding: 32,
					textAlign: "center",
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Sem dados suficientes para o gráfico
			</div>
		);
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-end",
				gap: 6,
				height: 80,
				padding: "0 4px",
			}}
		>
			{days.map(({ day, percent }) => {
				const color =
					percent === 100
						? "oklch(0.65 0.15 145)" // verde
						: percent >= 80
							? "oklch(0.75 0.15 80)" // amarelo
							: "var(--destructive)"; // vermelho

				return (
					<div
						key={day}
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 4,
						}}
						title={`${day}: ${percent}% uptime`}
					>
						<div
							style={{
								width: "100%",
								height: `${Math.max(percent * 0.7, 4)}px`,
								backgroundColor: color,
								borderRadius: 3,
								transition: "height 0.3s ease",
								opacity: 0.85,
							}}
						/>
						<span
							style={{
								fontSize: 9,
								color: "var(--muted-foreground)",
								whiteSpace: "nowrap",
							}}
						>
							{day}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
	label,
	value,
	sub,
	accent = false,
	online,
}: {
	label: string;
	value: string;
	sub?: string;
	accent?: boolean;
	online?: boolean;
}) {
	const valueColor =
		online !== undefined
			? online
				? "oklch(0.65 0.15 145)"
				: "var(--destructive)"
			: accent
				? OPTARE_RED
				: "var(--foreground)";

	return (
		<div
			style={{
				padding: "20px 24px",
				borderRadius: 10,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				display: "flex",
				flexDirection: "column",
				gap: 6,
				boxShadow: "var(--shadow-sm)",
			}}
		>
			<div
				style={{
					fontSize: 10,
					fontWeight: 700,
					color: "var(--muted-foreground)",
					textTransform: "uppercase",
					letterSpacing: "0.12em",
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontSize: 28,
					fontWeight: 800,
					color: valueColor,
					letterSpacing: "-0.02em",
				}}
			>
				{value}
			</div>
			{sub && (
				<div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
					{sub}
				</div>
			)}
		</div>
	);
}

// ── Componente principal ──────────────────────────────────────────────────────
export function SiteDashboard({ onNavigate, siteData }: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const { availability, sentryEvents, loading, error, lastRefresh, refresh } =
		siteData;

	const lastCheck = availability[0];
	const upCount = availability.filter((r) => r.is_up).length;
	const uptimePercent =
		availability.length > 0
			? Math.round((upCount / availability.length) * 100)
			: null;
	const avgResponse =
		availability.length > 0
			? Math.round(
					availability.reduce((s, r) => s + r.response_time_ms, 0) /
						availability.length,
				)
			: null;

	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
				currentPage="site-dashboard"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "24px 32px",
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: 24,
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						flexShrink: 0,
					}}
				>
					<div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								marginBottom: 4,
							}}
						>
							{/* Faixa de acento Optare */}
							<div
								style={{
									width: 4,
									height: 28,
									borderRadius: 2,
									backgroundColor: OPTARE_RED,
								}}
							/>
							<h1
								style={{
									fontSize: 22,
									fontWeight: 800,
									color: "var(--foreground)",
									margin: 0,
								}}
							>
								Site Optare
							</h1>
						</div>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "0 0 0 14px",
							}}
						>
							{lastRefresh
								? `Atualizado às ${formatTime(lastRefresh.toISOString())}`
								: "Carregando..."}
						</p>
					</div>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<ThemeToggleButton />
						<button
							onClick={refresh}
							style={{
								padding: "8px 16px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "transparent",
								color: "var(--foreground)",
								fontSize: 13,
								cursor: "pointer",
								fontFamily: "inherit",
							}}
						>
							↺ Recarregar
						</button>
					</div>
				</div>

				{loading && (
					<p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
						Carregando dados...
					</p>
				)}
				{error && (
					<p style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</p>
				)}

				{!loading && !error && (
					<>
						{/* KPIs */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
								gap: 16,
							}}
						>
							<KpiCard
								label="Status Atual"
								value={
									lastCheck ? (lastCheck.is_up ? "● Online" : "● Offline") : "—"
								}
								sub={lastCheck ? `HTTP ${lastCheck.status_code}` : undefined}
								online={lastCheck?.is_up}
							/>
							<KpiCard
								label="Uptime"
								value={uptimePercent !== null ? `${uptimePercent}%` : "—"}
								sub={`${availability.length} verificações`}
								accent={uptimePercent !== null && uptimePercent < 100}
							/>
							<KpiCard
								label="Resposta Média"
								value={avgResponse !== null ? `${avgResponse}ms` : "—"}
								sub="tempo de resposta HTTP"
							/>
							<KpiCard
								label="Erros no Sentry"
								value={String(sentryEvents.length)}
								sub={
									sentryEvents.length === 0
										? "nenhum issue ativo"
										: "issues não resolvidos"
								}
								accent={sentryEvents.length > 0}
							/>
						</div>

						{/* Gráfico de disponibilidade */}
						<div
							style={{
								borderRadius: 10,
								border: "1px solid var(--border)",
								backgroundColor: "var(--card)",
								overflow: "hidden",
								boxShadow: "var(--shadow-sm)",
							}}
						>
							<div
								style={{
									padding: "16px 20px",
									borderBottom: "1px solid var(--border)",
									display: "flex",
									alignItems: "center",
									gap: 8,
								}}
							>
								<div
									style={{
										width: 3,
										height: 16,
										borderRadius: 2,
										backgroundColor: OPTARE_RED,
									}}
								/>
								<div>
									<div
										style={{
											fontSize: 14,
											fontWeight: 700,
											color: "var(--foreground)",
										}}
									>
										Disponibilidade por Dia
									</div>
									<div
										style={{
											fontSize: 11,
											color: "var(--muted-foreground)",
											marginTop: 2,
										}}
									>
										% de uptime nos últimos 14 dias
									</div>
								</div>
							</div>
							<div style={{ padding: "20px 24px 16px" }}>
								<AvailabilityBarChart records={availability} />
								{/* Legenda */}
								<div
									style={{
										display: "flex",
										gap: 16,
										marginTop: 12,
										fontSize: 11,
										color: "var(--muted-foreground)",
									}}
								>
									<span
										style={{ display: "flex", alignItems: "center", gap: 4 }}
									>
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: 2,
												backgroundColor: "oklch(0.65 0.15 145)",
												display: "inline-block",
											}}
										/>
										100%
									</span>
									<span
										style={{ display: "flex", alignItems: "center", gap: 4 }}
									>
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: 2,
												backgroundColor: "oklch(0.75 0.15 80)",
												display: "inline-block",
											}}
										/>
										80–99%
									</span>
									<span
										style={{ display: "flex", alignItems: "center", gap: 4 }}
									>
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: 2,
												backgroundColor: "var(--destructive)",
												display: "inline-block",
											}}
										/>
										{"<80%"}
									</span>
								</div>
							</div>
						</div>

						{/* Feed de erros do Sentry */}
						<div
							style={{
								borderRadius: 10,
								border: "1px solid var(--border)",
								backgroundColor: "var(--card)",
								overflow: "hidden",
								boxShadow: "var(--shadow-sm)",
							}}
						>
							<div
								style={{
									padding: "16px 20px",
									borderBottom: "1px solid var(--border)",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<div
										style={{
											width: 3,
											height: 16,
											borderRadius: 2,
											backgroundColor: OPTARE_RED,
										}}
									/>
									<div>
										<div
											style={{
												fontSize: 14,
												fontWeight: 700,
												color: "var(--foreground)",
											}}
										>
											Erros Recentes
										</div>
										<div
											style={{
												fontSize: 11,
												color: "var(--muted-foreground)",
												marginTop: 2,
											}}
										>
											Issues não resolvidos no Sentry
										</div>
									</div>
								</div>
								{sentryEvents.length > 0 && (
									<span
										style={{
											fontSize: 11,
											fontWeight: 700,
											padding: "3px 10px",
											borderRadius: 20,
											backgroundColor: OPTARE_RED_MUTED,
											color: OPTARE_RED,
										}}
									>
										{sentryEvents.length} ativo
										{sentryEvents.length > 1 ? "s" : ""}
									</span>
								)}
							</div>

							{sentryEvents.length === 0 ? (
								<div style={{ padding: 32, textAlign: "center" }}>
									<div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
									<div
										style={{ fontSize: 13, color: "var(--muted-foreground)" }}
									>
										Nenhum erro ativo no momento
									</div>
								</div>
							) : (
								<div style={{ display: "flex", flexDirection: "column" }}>
									{sentryEvents.slice(0, 5).map((e, i) => (
										<div
											key={e.id}
											style={{
												padding: "14px 20px",
												borderBottom:
													i < Math.min(sentryEvents.length, 5) - 1
														? "1px solid var(--border)"
														: "none",
												display: "flex",
												alignItems: "flex-start",
												gap: 12,
											}}
										>
											<span
												style={{
													fontSize: 10,
													fontWeight: 700,
													padding: "3px 8px",
													borderRadius: 4,
													flexShrink: 0,
													marginTop: 1,
													backgroundColor:
														e.level === "error"
															? "color-mix(in oklch, var(--destructive) 12%, transparent)"
															: "color-mix(in oklch, oklch(0.75 0.15 80) 20%, transparent)",
													color:
														e.level === "error"
															? "var(--destructive)"
															: "oklch(0.55 0.12 80)",
												}}
											>
												{e.level}
											</span>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 8,
													minWidth: 0,
												}}
											>
												<div
													style={{
														fontSize: 13,
														fontWeight: 600,
														color: "var(--foreground)",
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
														flex: 1,
													}}
												>
													{e.title}
												</div>
												<div
													style={{
														fontSize: 11,
														color: "var(--muted-foreground)",
														marginTop: 2,
													}}
												>
													{e.culprit} · {e.count}× · {formatDate(e.last_seen)}
												</div>
												{e.permalink && (
													<a
														href={e.permalink}
														target="_blank"
														rel="noopener noreferrer"
														style={{
															fontSize: 11,
															color: OPTARE_RED,
															textDecoration: "none",
															fontWeight: 600,
															flexShrink: 0,
														}}
													>
														Ver →
													</a>
												)}
											</div>
										</div>
									))}
									{sentryEvents.length > 5 && (
										<div
											onClick={() => onNavigate("site-list")}
											style={{
												padding: "12px 20px",
												fontSize: 12,
												color: OPTARE_RED,
												fontWeight: 600,
												cursor: "pointer",
												textAlign: "center",
												borderTop: "1px solid var(--border)",
											}}
										>
											Ver todos os {sentryEvents.length} erros →
										</div>
									)}
								</div>
							)}
						</div>
					</>
				)}
			</main>
		</div>
	);
}
