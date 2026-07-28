// src/features/site/SiteList.tsx
import { useState, useMemo } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { useWindowSize } from "../../hooks/useWindowSize";
import type { SharedPageProps } from "../../App";
import type { AvailabilityRecord, SentryEvent } from "./hooks/useSiteData";

const OPTARE_RED = "oklch(0.3800 0.1523 18.6219)";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString("pt-BR", {
		timeZone: "America/Sao_Paulo",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// ── Componente de input de filtro ─────────────────────────────────────────────
function FilterInput({
	label,
	value,
	onChange,
	placeholder,
	type = "text",
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	type?: string;
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<label
				style={{
					fontSize: 10,
					fontWeight: 700,
					color: "var(--muted-foreground)",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
				}}
			>
				{label}
			</label>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				style={{
					padding: "7px 10px",
					borderRadius: 6,
					border: "1px solid var(--border)",
					backgroundColor: "var(--background)",
					color: "var(--foreground)",
					fontSize: 13,
					outline: "none",
					fontFamily: "inherit",
				}}
			/>
		</div>
	);
}

// ── Botão de filtro toggle ────────────────────────────────────────────────────
function FilterButton({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				padding: "6px 14px",
				borderRadius: 20,
				border: active ? "none" : "1px solid var(--border)",
				backgroundColor: active ? OPTARE_RED : "transparent",
				color: active ? "oklch(1 0 0)" : "var(--muted-foreground)",
				fontSize: 12,
				fontWeight: active ? 700 : 400,
				cursor: "pointer",
				fontFamily: "inherit",
				transition: "all 0.15s",
			}}
		>
			{label}
		</button>
	);
}

// ── Tabela de disponibilidade ─────────────────────────────────────────────────
function AvailabilityTable({ records }: { records: AvailabilityRecord[] }) {
	const [statusFilter, setStatusFilter] = useState<"all" | "up" | "down">(
		"all",
	);
	const [dateFilter, setDateFilter] = useState("");

	const filtered = useMemo(() => {
		return records.filter((r) => {
			if (statusFilter === "up" && !r.is_up) return false;
			if (statusFilter === "down" && r.is_up) return false;
			if (dateFilter) {
				const recordDate = new Date(r.checked_at).toLocaleDateString("pt-BR", {
					timeZone: "America/Sao_Paulo",
				});
				const filterDate = new Date(dateFilter).toLocaleDateString("pt-BR", {
					timeZone: "America/Sao_Paulo",
				});
				if (recordDate !== filterDate) return false;
			}
			return true;
		});
	}, [records, statusFilter, dateFilter]);

	const ROW_HEIGHT = 48;

	const tdBaseStyle: React.CSSProperties = {
		padding: "0 16px",
		height: ROW_HEIGHT,
		verticalAlign: "middle",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	};

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				maxHeight: "50vh",
				minHeight: "30vh",
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border)",
					flexShrink: 0,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 12,
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
					<div
						style={{
							fontSize: 14,
							fontWeight: 700,
							color: "var(--foreground)",
						}}
					>
						Histórico de Disponibilidade
					</div>
				</div>
				{/* Filtros */}
				<div
					style={{
						display: "flex",
						gap: 16,
						flexWrap: "wrap",
						alignItems: "flex-end",
					}}
				>
					<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
							}}
						>
							Status
						</span>
						<FilterButton
							label="Todos"
							active={statusFilter === "all"}
							onClick={() => setStatusFilter("all")}
						/>
						<FilterButton
							label="Online"
							active={statusFilter === "up"}
							onClick={() => setStatusFilter("up")}
						/>
						<FilterButton
							label="Offline"
							active={statusFilter === "down"}
							onClick={() => setStatusFilter("down")}
						/>
					</div>
					<FilterInput
						label="Data"
						type="date"
						value={dateFilter}
						onChange={setDateFilter}
					/>
					{(statusFilter !== "all" || dateFilter) && (
						<button
							onClick={() => {
								setStatusFilter("all");
								setDateFilter("");
							}}
							style={{
								padding: "7px 12px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "transparent",
								color: "var(--muted-foreground)",
								fontSize: 12,
								cursor: "pointer",
								fontFamily: "inherit",
								alignSelf: "flex-end",
							}}
						>
							Limpar
						</button>
					)}
				</div>
			</div>

			{/* Tabela */}
			<div
				style={{
					flex: 1,
					minHeight: 0,
					overflow: "auto",
				}}
			>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						tableLayout: "fixed",
					}}
				>
					<thead
						style={{
							position: "sticky",
							top: 0,
							zIndex: 2,
							backgroundColor: "var(--muted)",
						}}
					>
						<tr style={{ borderBottom: "1px solid var(--border)" }}>
							{[
								"Data / Hora",
								"Status",
								"Código HTTP",
								"Tempo de Resposta",
								"URL",
							].map((h) => (
								<th
									key={h}
									style={{
										padding: "10px 16px",
										textAlign: "left",
										fontSize: 10,
										fontWeight: 700,
										color: "var(--muted-foreground)",
										textTransform: "uppercase",
										letterSpacing: "0.1em",
										backgroundColor: "var(--muted)",
										borderBottom: "1px solid var(--border)",
										whiteSpace: "nowrap",
									}}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 ? (
							<tr>
								<td
									colSpan={5}
									style={{
										padding: 32,
										textAlign: "center",
										color: "var(--muted-foreground)",
										fontSize: 13,
									}}
								>
									Nenhum registro encontrado
								</td>
							</tr>
						) : (
							filtered.map((r, index) => (
								<tr
									key={r.id}
									style={{
										height: ROW_HEIGHT,
										borderBottom: "1px solid var(--border)",
										backgroundColor:
											index % 2 === 0
												? "var(--card)"
												: "color-mix(in oklch, var(--muted) 40%, var(--card))",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = "var(--accent)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor =
											index % 2 === 0
												? "var(--card)"
												: "color-mix(in oklch, var(--muted) 40%, var(--card))";
									}}
								>
									<td
										style={{
											...tdBaseStyle,
										}}
									>
										{formatDate(r.checked_at)}
									</td>
									<td
										style={{
											...tdBaseStyle,
										}}
									>
										<span
											style={{
												fontSize: 11,
												fontWeight: 700,
												padding: "3px 10px",
												borderRadius: 20,
												backgroundColor: r.is_up
													? "color-mix(in oklch, oklch(0.65 0.15 145) 15%, transparent)"
													: "color-mix(in oklch, var(--destructive) 12%, transparent)",
												color: r.is_up
													? "oklch(0.5 0.15 145)"
													: "var(--destructive)",
											}}
										>
											{r.is_up ? "● Online" : "● Offline"}
										</span>
									</td>
									<td
										style={{
											...tdBaseStyle,
											overflow: "visible",
										}}
									>
										{r.status_code ?? "—"}
									</td>
									<td
										style={{
											...tdBaseStyle,
										}}
									>
										<span
											style={{
												fontWeight: r.response_time_ms > 2000 ? 700 : 400,
												color:
													r.response_time_ms > 2000
														? "var(--destructive)"
														: "var(--foreground)",
											}}
										>
											{r.response_time_ms}ms
										</span>
									</td>
									<td
										style={{
											...tdBaseStyle,
										}}
									>
										{r.url}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div
				style={{
					padding: "8px 16px",
					borderTop: "1px solid var(--border)",
					backgroundColor: "var(--muted)",
					fontSize: 11,
					color: "var(--muted-foreground)",
					textAlign: "right",
					flexShrink: 0,
				}}
			>
				{filtered.length.toLocaleString("pt-BR")} de{" "}
				{records.length.toLocaleString("pt-BR")} registros
			</div>
		</div>
	);
}

// ── Tabela de eventos Sentry ──────────────────────────────────────────────────
function SentryTable({ events }: { events: SentryEvent[] }) {
	const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warning">(
		"all",
	);
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		return events.filter((e) => {
			if (levelFilter !== "all" && e.level !== levelFilter) return false;
			if (
				search &&
				!e.title.toLowerCase().includes(search.toLowerCase()) &&
				!e.culprit.toLowerCase().includes(search.toLowerCase())
			)
				return false;
			return true;
		});
	}, [events, levelFilter, search]);

	return (
		<div
			style={{
				borderRadius: 10,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				overflow: "hidden",
				boxShadow: "var(--shadow-sm)",
				maxHeight: "50vh", // ← adiciona isso
				display: "flex", // ← adiciona isso
				flexDirection: "column", // ← adiciona isso
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 12,
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
					<div
						style={{
							fontSize: 14,
							fontWeight: 700,
							color: "var(--foreground)",
						}}
					>
						Eventos do Sentry
					</div>
				</div>
				{/* Filtros */}
				<div
					style={{
						display: "flex",
						gap: 16,
						flexWrap: "wrap",
						alignItems: "flex-end",
					}}
				>
					<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
							}}
						>
							Nível
						</span>
						<FilterButton
							label="Todos"
							active={levelFilter === "all"}
							onClick={() => setLevelFilter("all")}
						/>
						<FilterButton
							label="Error"
							active={levelFilter === "error"}
							onClick={() => setLevelFilter("error")}
						/>
						<FilterButton
							label="Warning"
							active={levelFilter === "warning"}
							onClick={() => setLevelFilter("warning")}
						/>
					</div>
					<FilterInput
						label="Pesquisa"
						value={search}
						onChange={setSearch}
						placeholder="título ou origem..."
					/>
					{(levelFilter !== "all" || search) && (
						<button
							onClick={() => {
								setLevelFilter("all");
								setSearch("");
							}}
							style={{
								padding: "7px 12px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "transparent",
								color: "var(--muted-foreground)",
								fontSize: 12,
								cursor: "pointer",
								fontFamily: "inherit",
								alignSelf: "flex-end",
							}}
						>
							Limpar
						</button>
					)}
				</div>
			</div>

			{/* Tabela */}
			<div
				style={{
					flex: 1, // ← adiciona
					minHeight: 0, // ← adiciona
					overflow: "auto", // ← era overflowX: "auto"
				}}
			>
				<table
					style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
				>
					<thead>
						<tr style={{ borderBottom: "1px solid var(--border)" }}>
							{[
								"Título",
								"Nível",
								"Origem",
								"URL",
								"Ocorrências",
								"Primeira vez",
								"Última vez",
							].map((h) => (
								<th
									key={h}
									style={{
										padding: "10px 20px",
										textAlign: "left",
										fontSize: 10,
										fontWeight: 700,
										color: "var(--muted-foreground)",
										textTransform: "uppercase",
										letterSpacing: "0.08em",
										whiteSpace: "nowrap",
									}}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 ? (
							<tr>
								<td
									colSpan={7}
									style={{
										padding: 32,
										textAlign: "center",
										color: "var(--muted-foreground)",
										fontSize: 13,
									}}
								>
									{events.length === 0
										? "Nenhum evento registrado"
										: "Nenhum resultado para os filtros aplicados"}
								</td>
							</tr>
						) : (
							filtered.map((e) => (
								<tr
									key={e.id}
									style={{ borderBottom: "1px solid var(--border)" }}
								>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--foreground)",
											maxWidth: 280,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
										title={e.title}
									>
										{e.title}
									</td>
									<td style={{ padding: "10px 20px" }}>
										<span
											style={{
												fontSize: 10,
												fontWeight: 700,
												padding: "3px 8px",
												borderRadius: 4,
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
									</td>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--muted-foreground)",
											fontSize: 12,
											whiteSpace: "nowrap",
										}}
									>
										{e.culprit}
									</td>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--muted-foreground)",
											fontSize: 12,
											whiteSpace: "nowrap",
										}}
									>
										{e.permalink ? (
											<a
												href={e.permalink}
												target="_blank"
												rel="noopener noreferrer"
												style={{
													color: OPTARE_RED,
													textDecoration: "none",
													fontWeight: 600,
												}}
											>
												{e.permalink}
											</a>
										) : (
											<span
												style={{
													color: "var(--muted-foreground)",
													opacity: 0.5,
												}}
											>
												—
											</span>
										)}
									</td>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--foreground)",
											fontWeight: 700,
											textAlign: "center",
										}}
									>
										{e.count}
									</td>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--muted-foreground)",
											whiteSpace: "nowrap",
										}}
									>
										{formatDate(e.first_seen)}
									</td>
									<td
										style={{
											padding: "10px 20px",
											color: "var(--muted-foreground)",
											whiteSpace: "nowrap",
										}}
									>
										{formatDate(e.last_seen)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div
				style={{
					padding: "10px 20px",
					borderTop: "1px solid var(--border)",
					fontSize: 11,
					color: "var(--muted-foreground)",
				}}
			>
				{filtered.length} de {events.length} eventos
			</div>
		</div>
	);
}

// ── Componente principal ──────────────────────────────────────────────────────
export function SiteList({ onNavigate, siteData }: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const {
		availability,
		sentryEvents,
		monitoredUrls,
		selectedUrlId,
		setSelectedUrlId,
		loading,
		error,
		lastRefresh,
		refresh,
	} = siteData;

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
				currentPage="site-list"
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
								Registros do Site
							</h1>
						</div>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "0 0 0 14px",
							}}
						>
							Histórico detalhado de disponibilidade e erros
						</p>
					</div>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<select
							value={selectedUrlId ?? "all"}
							onChange={(e) => setSelectedUrlId(Number(e.target.value))}
							style={{
								padding: "8px 12px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "var(--card)",
								color: "var(--foreground)",
								fontSize: 13,
								cursor: "pointer",
								fontFamily: "inherit",
							}}
						>
							{monitoredUrls.map((mu) => (
								<option key={mu.id} value={mu.id}>
									{mu.label}
								</option>
							))}
						</select>
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
						<AvailabilityTable records={availability} />
						<SentryTable events={sentryEvents} />
					</>
				)}
			</main>
		</div>
	);
}
