import {
	useState,
	useMemo,
	useEffect,
	createContext,
	useContext,
	useCallback,
	useRef,
} from "react";
// Em Vite: descomente a linha abaixo e remova a tag <style> do App()
// import "./style.css";

// ══════════════════════════════════════════════════════════════════════════════
// MAPA DA ARQUITETURA
//  Domain       → constantes puras (START_STATUS, ADMIN_CREDENTIALS…)
//  Data         → LogMapper (Adapter) + LogRepository (Repository)
//  Application  → hooks (useTheme, useAuth, useLogs, useLogFilters, useWindowSize)
//  UI           → componentes React
// ══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════
// DOMAIN LAYER
// ═══════════════════════════════════════

const START_STATUS = Object.freeze({
	ALL: "all",
	ACTIVE: "active",
	INACTIVE: "inactive",
});
const INITIAL_FILTERS = Object.freeze({
	message: "",
	date: "",
	start: START_STATUS.ALL,
});
const ADMIN_CREDENTIALS = Object.freeze({
	username: "ADM",
	password: "admin123",
});

// ═══════════════════════════════════════
// DATA LAYER — LogMapper (Adapter)
// ═══════════════════════════════════════
// Único lugar que conhece o schema externo (RawLog) e o interno (Log).

const LogMapper = {
	/** @param {{ message:string, Data:string, Hora:string, Start:0|1 }} raw */
	toLog: (raw) => ({
		message: raw.message,
		date: raw.Data,
		time: raw.Hora,
		isStarted: raw.Start === 1,
	}),
	toLogList: (rawLogs) => rawLogs.map(LogMapper.toLog),
};

// ═══════════════════════════════════════
// DATA LAYER — LogRepository (Repository)
// ═══════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │  ONDE APONTAR A FONTE DOS LOGS                                      │
// │                                                                     │
// │  OPÇÃO A — API REST (recomendado para produção com Node.js):        │
// │    async fetchAll() {                                               │
// │      const res = await fetch("http://localhost:3000/api/logs");     │
// │      if (!res.ok) throw new Error(`HTTP ${res.status}`);            │
// │      return res.json();   // deve retornar RawLog[]                 │
// │    }                                                                │
// │                                                                     │
// │  OPÇÃO B — JSON estático na pasta /public do Vite:                  │
// │    Coloque o arquivo em: public/data/logs.json                      │
// │    async fetchAll() {                                               │
// │      const res = await fetch("/data/logs.json");                    │
// │      return res.json();                                             │
// │    }                                                                │
// │                                                                     │
// │  OPÇÃO C — Upload pelo usuário (já implementado em fromFile abaixo) │
// └─────────────────────────────────────────────────────────────────────┘

const RAW_LOGS_MOCK = [
	{
		message: "Service started successfully",
		Data: "2026-05-14",
		Hora: "09:42:17",
		Start: 1,
	},
	{
		message: "Database connection established",
		Data: "2026-05-14",
		Hora: "09:41:03",
		Start: 1,
	},
	{
		message: "Worker process terminated",
		Data: "2026-05-14",
		Hora: "08:15:44",
		Start: 0,
	},
	{
		message: "Cache invalidation triggered",
		Data: "2026-05-13",
		Hora: "23:59:01",
		Start: 1,
	},
	{
		message: "Authentication service offline",
		Data: "2026-05-13",
		Hora: "18:30:22",
		Start: 0,
	},
	{
		message: "Scheduler job completed",
		Data: "2026-05-13",
		Hora: "12:00:00",
		Start: 1,
	},
	{
		message: "API gateway restarted",
		Data: "2026-05-12",
		Hora: "17:45:09",
		Start: 1,
	},
	{
		message: "Memory threshold exceeded: 92%",
		Data: "2026-05-12",
		Hora: "14:22:33",
		Start: 0,
	},
	{
		message: "Backup completed successfully",
		Data: "2026-05-11",
		Hora: "03:00:00",
		Start: 1,
	},
	{
		message: "TLS certificate renewal initiated",
		Data: "2026-05-10",
		Hora: "10:11:55",
		Start: 1,
	},
	{
		message: "Email queue flushed",
		Data: "2026-05-10",
		Hora: "08:05:12",
		Start: 1,
	},
	{
		message: "Cronjob failed: report generation",
		Data: "2026-05-09",
		Hora: "22:00:01",
		Start: 0,
	},
	{
		message: "Load balancer health check failed",
		Data: "2026-05-09",
		Hora: "15:44:02",
		Start: 0,
	},
	{
		message: "User session cleanup complete",
		Data: "2026-05-08",
		Hora: "01:30:00",
		Start: 1,
	},
	{
		message: "Config reload triggered",
		Data: "2026-05-07",
		Hora: "11:00:00",
		Start: 1,
	},
	{
		message: "Disk usage warning: 85%",
		Data: "2026-05-06",
		Hora: "19:20:44",
		Start: 0,
	},
	{
		message: "New deployment: v2.4.1",
		Data: "2026-05-05",
		Hora: "14:00:00",
		Start: 1,
	},
	{
		message: "Webhook delivery failed (3/3)",
		Data: "2026-05-04",
		Hora: "09:10:33",
		Start: 0,
	},
];

const LogRepository = {
	// Fonte padrão: mock (substitua pelo fetch() real — veja comentário acima)
	async fetchAll() {
		await new Promise((r) => setTimeout(r, 700));
		return RAW_LOGS_MOCK;
	},

	// Lê um arquivo JSON selecionado via <input type="file">
	// Aceita: RawLog[] direto OU { logs: RawLog[] }
	async fromFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const parsed = JSON.parse(e.target.result);
					resolve(Array.isArray(parsed) ? parsed : (parsed.logs ?? []));
				} catch {
					reject(new Error("JSON inválido. Verifique a estrutura do arquivo."));
				}
			};
			reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
			reader.readAsText(file);
		});
	},
};

// ═══════════════════════════════════════
// APPLICATION LAYER — Hooks
// ═══════════════════════════════════════

// ─── useWindowSize ────────────────────────────────────────────────────────────
// Detecta o tamanho da janela para decisões de layout responsivo.
// useEffect com cleanup remove o listener quando o componente desmonta.
function useWindowSize() {
	const [width, setWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1200,
	);
	useEffect(() => {
		const handler = () => setWidth(window.innerWidth);
		window.addEventListener("resize", handler);
		return () => window.removeEventListener("resize", handler);
	}, []);
	return width;
}

// ─── useTheme ────────────────────────────────────────────────────────────────
// Gerencia o dark mode via classe CSS no elemento raiz do componente.
// A variável `isDark` controla a classe `.dark` que ativa as CSS variables
// do dark mode definidas no style.css (ex: --background muda de creme para escuro).
const ThemeContext = createContext(null);

function ThemeProvider({ children }) {
	const [isDark, setIsDark] = useState(false);

	const toggle = useCallback(() => {
		setIsDark((prev) => {
			const next = !prev;
			// Em Vite: document.documentElement.classList.toggle("dark", next)
			// aplica o dark mode globalmente. Aqui, usamos um wrapper div.
			// TODO: localStorage.setItem("theme", next ? "dark" : "light");
			return next;
		});
	}, []);

	return (
		<ThemeContext.Provider value={{ isDark, toggle }}>
			{/* A classe "dark" aqui ativa as variáveis CSS do dark mode */}
			<div className={isDark ? "dark" : ""} style={{ minHeight: "100vh" }}>
				{children}
			</div>
		</ThemeContext.Provider>
	);
}

function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
	return ctx;
}

// ─── useAuth ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	// TODO: Persist with localStorage
	// useState(() => localStorage.getItem("auth") === "true")

	const login = useCallback(({ username, password }) => {
		const valid =
			username === ADMIN_CREDENTIALS.username &&
			password === ADMIN_CREDENTIALS.password;
		if (valid) setIsAuthenticated(true);
		// TODO: if (valid) localStorage.setItem("auth", "true");
		return valid;
	}, []);

	const logout = useCallback(() => {
		setIsAuthenticated(false);
		// TODO: localStorage.removeItem("auth");
	}, []);

	return (
		<AuthContext.Provider value={{ isAuthenticated, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
	return ctx;
}

// ─── useLogs ──────────────────────────────────────────────────────────────────
// Aceita um `file` opcional (File do input). Sem file → usa fetchAll() (mock/API).
// Com file → lê o arquivo JSON via LogRepository.fromFile().
function useLogs(file = null) {
	const [logs, setLogs] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				setIsLoading(true);
				setError(null);
				const raw = file
					? await LogRepository.fromFile(file)
					: await LogRepository.fetchAll();
				if (!cancelled) setLogs(LogMapper.toLogList(raw));
			} catch (err) {
				if (!cancelled) setError(err.message ?? "Erro desconhecido.");
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [file]); // re-executa se o arquivo mudar

	return { logs, isLoading, error };
}

// ─── useLogFilters ────────────────────────────────────────────────────────────
function useLogFilters(logs) {
	const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

	const filteredLogs = useMemo(() => {
		const sorted = [...logs].sort((a, b) =>
			`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
		);
		return sorted.filter((log) => {
			const matchMessage = log.message
				.toLowerCase()
				.includes(filters.message.toLowerCase());
			const matchDate = filters.date ? log.date === filters.date : true;
			const matchStart =
				filters.start === START_STATUS.ALL
					? true
					: filters.start === START_STATUS.ACTIVE
						? log.isStarted === true
						: log.isStarted === false;
			return matchMessage && matchDate && matchStart;
		});
	}, [logs, filters]);

	const stats = useMemo(
		() => ({
			total: logs.length,
			active: logs.filter((l) => l.isStarted).length,
			inactive: logs.filter((l) => !l.isStarted).length,
		}),
		[logs],
	);

	const updateFilter = useCallback(
		(key, value) => setFilters((prev) => ({ ...prev, [key]: value })),
		[],
	);
	const resetFilters = useCallback(
		() => setFilters({ ...INITIAL_FILTERS }),
		[],
	);

	return { filters, filteredLogs, stats, updateFilter, resetFilters };
}

// ═══════════════════════════════════════
// UI LAYER
// ═══════════════════════════════════════

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ isStarted }) {
	const color = isStarted ? "var(--primary)" : "var(--status-error)";
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "3px 10px",
				borderRadius: 9999,
				fontSize: 11,
				fontWeight: 700,
				letterSpacing: "0.06em",
				textTransform: "uppercase",
				backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
				color,
				border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
			}}
		>
			<span
				style={{
					width: 6,
					height: 6,
					borderRadius: "50%",
					backgroundColor: color,
					animation: isStarted ? "pulse 2.5s ease-in-out infinite" : "none",
				}}
			/>
			{isStarted ? "Ativo" : "Inativo"}
		</span>
	);
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accentColor }) {
	return (
		<div
			style={{
				padding: "16px 20px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				borderLeft: `3px solid ${accentColor}`,
			}}
		>
			<div
				style={{
					fontSize: 10,
					fontWeight: 700,
					color: "var(--muted-foreground)",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
					marginBottom: 6,
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontSize: 30,
					fontWeight: 800,
					color: accentColor,
					fontVariantNumeric: "tabular-nums",
					letterSpacing: "-0.04em",
					lineHeight: 1,
				}}
			>
				{value}
			</div>
		</div>
	);
}

// ─── LoadingState / ErrorState ────────────────────────────────────────────────
function LoadingState() {
	return (
		<div
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
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "3px solid var(--border)",
					borderTopColor: "var(--primary)",
					animation: "spin 0.8s linear infinite",
				}}
			/>
			<span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
				Carregando logs...
			</span>
		</div>
	);
}

function ErrorState({ message }) {
	return (
		<div
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
		</div>
	);
}

// ─── LogFilters ───────────────────────────────────────────────────────────────
function LogFilters({ filters, onUpdate, onReset, isMobile }) {
	const sharedInput = {
		width: "100%",
		padding: "8px 12px",
		borderRadius: 6,
		border: "1px solid var(--border)",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: 13,
		fontFamily: "inherit",
		outline: "none",
		boxSizing: "border-box",
	};
	const labelStyle = {
		display: "block",
		fontSize: 10,
		fontWeight: 700,
		color: "var(--muted-foreground)",
		textTransform: "uppercase",
		letterSpacing: "0.1em",
		marginBottom: 6,
	};

	return (
		<div
			style={{
				display: "grid",
				// Mobile: 1 coluna, Tablet: 2 colunas, Desktop: 4 colunas
				gridTemplateColumns: isMobile ? "1fr" : "1fr 180px 160px auto",
				gap: 12,
				alignItems: "end",
				padding: "16px 20px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				marginBottom: 16,
			}}
		>
			<div>
				<label style={labelStyle}>Mensagem</label>
				<input
					type="text"
					placeholder="Filtrar por mensagem..."
					value={filters.message}
					onChange={(e) => onUpdate("message", e.target.value)}
					style={sharedInput}
				/>
			</div>
			<div>
				<label style={labelStyle}>Data</label>
				<input
					type="date"
					value={filters.date}
					onChange={(e) => onUpdate("date", e.target.value)}
					style={sharedInput}
				/>
			</div>
			<div>
				<label style={labelStyle}>Status</label>
				<select
					value={filters.start}
					onChange={(e) => onUpdate("start", e.target.value)}
					style={{ ...sharedInput, cursor: "pointer" }}
				>
					<option value={START_STATUS.ALL}>Todos</option>
					<option value={START_STATUS.ACTIVE}>Ativo</option>
					<option value={START_STATUS.INACTIVE}>Inativo</option>
				</select>
			</div>
			<button
				onClick={onReset}
				onMouseEnter={(e) =>
					(e.currentTarget.style.backgroundColor = "var(--accent)")
				}
				onMouseLeave={(e) =>
					(e.currentTarget.style.backgroundColor = "transparent")
				}
				style={{
					padding: "8px 14px",
					borderRadius: 6,
					border: "1px solid var(--border)",
					backgroundColor: "transparent",
					color: "var(--muted-foreground)",
					fontSize: 12,
					cursor: "pointer",
					fontFamily: "inherit",
					whiteSpace: "nowrap",
				}}
			>
				Limpar
			</button>
		</div>
	);
}

// ─── LogTable ─────────────────────────────────────────────────────────────────
function LogTable({ logs, isMobile }) {
	const thStyle = {
		padding: "10px 16px",
		textAlign: "left",
		fontSize: 10,
		fontWeight: 700,
		color: "var(--muted-foreground)",
		textTransform: "uppercase",
		letterSpacing: "0.1em",
		borderBottom: "1px solid var(--border)",
		backgroundColor: "var(--muted)",
		whiteSpace: "nowrap",
	};
	const tdStyle = {
		padding: "11px 16px",
		fontSize: 13,
		color: "var(--foreground)",
		borderBottom: "1px solid var(--border)",
		verticalAlign: "middle",
	};

	if (logs.length === 0) {
		return (
			<div
				style={{
					textAlign: "center",
					padding: "56px 16px",
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 8,
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Nenhum log encontrado para os filtros aplicados.
			</div>
		);
	}

	return (
		// overflow-x: auto → scroll horizontal em telas pequenas
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				overflow: "hidden",
				overflowX: "auto",
			}}
		>
			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					minWidth: isMobile ? 600 : "auto",
				}}
			>
				<thead>
					<tr>
						<th style={{ ...thStyle, width: 48 }}>#</th>
						<th style={thStyle}>Mensagem</th>
						{!isMobile && <th style={{ ...thStyle, width: 120 }}>Data</th>}
						{!isMobile && <th style={{ ...thStyle, width: 100 }}>Hora</th>}
						<th style={{ ...thStyle, width: 110 }}>Status</th>
					</tr>
				</thead>
				<tbody>
					{logs.map((log, i) => (
						<tr
							key={`${log.date}-${log.time}-${i}`}
							onMouseEnter={(e) =>
								(e.currentTarget.style.backgroundColor = "var(--accent)")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.backgroundColor = "transparent")
							}
							style={{ transition: "background-color 0.12s" }}
						>
							<td
								style={{
									...tdStyle,
									color: "var(--muted-foreground)",
									fontSize: 11,
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{String(i + 1).padStart(2, "0")}
							</td>
							<td
								style={{
									...tdStyle,
									fontFamily: "var(--font-mono)",
									fontSize: 12,
								}}
							>
								{log.message}
								{/* Em mobile, mostra data/hora inline na mensagem */}
								{isMobile && (
									<div
										style={{
											fontSize: 10,
											color: "var(--muted-foreground)",
											marginTop: 4,
											fontFamily: "var(--font-mono)",
										}}
									>
										{log.date} · {log.time}
									</div>
								)}
							</td>
							{!isMobile && (
								<td
									style={{
										...tdStyle,
										color: "var(--muted-foreground)",
										fontVariantNumeric: "tabular-nums",
										whiteSpace: "nowrap",
									}}
								>
									{log.date}
								</td>
							)}
							{!isMobile && (
								<td
									style={{
										...tdStyle,
										fontFamily: "var(--font-mono)",
										color: "var(--muted-foreground)",
										whiteSpace: "nowrap",
									}}
								>
									{log.time}
								</td>
							)}
							<td style={tdStyle}>
								<StatusBadge isStarted={log.isStarted} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ─── ThemeToggleButton ────────────────────────────────────────────────────────
function ThemeToggleButton() {
	const { isDark, toggle } = useTheme();
	return (
		<button
			onClick={toggle}
			title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
			style={{
				width: 32,
				height: 32,
				borderRadius: 6,
				border: "1px solid var(--border)",
				backgroundColor: "transparent",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: 15,
				color: "var(--muted-foreground)",
				transition: "background-color 0.15s",
			}}
			onMouseEnter={(e) =>
				(e.currentTarget.style.backgroundColor = "var(--accent)")
			}
			onMouseLeave={(e) =>
				(e.currentTarget.style.backgroundColor = "transparent")
			}
		>
			{isDark ? "☀️" : "🌙"}
		</button>
	);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ stats, isOpen, onClose, isMobile }) {
	const { logout } = useAuth();

	// Em mobile, a sidebar é um drawer por cima do conteúdo
	const sidebarStyle = isMobile
		? {
				position: "fixed",
				top: 0,
				left: 0,
				zIndex: 50,
				width: 260,
				height: "100vh",
				transform: isOpen ? "translateX(0)" : "translateX(-100%)",
				transition: "transform 0.25s ease",
				boxShadow: isOpen ? "4px 0 24px rgba(0,0,0,0.15)" : "none",
			}
		: {
				position: "relative",
				width: 220,
				minHeight: "100vh",
				flexShrink: 0,
			};

	return (
		<>
			{/* Overlay escuro em mobile quando sidebar está aberta */}
			{isMobile && isOpen && (
				<div
					onClick={onClose}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 40,
						backgroundColor: "rgba(0,0,0,0.35)",
					}}
				/>
			)}

			<aside
				style={{
					...sidebarStyle,
					backgroundColor: "var(--sidebar)",
					borderRight: "1px solid var(--border)",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						padding: "24px 20px 20px",
						borderBottom: "1px solid var(--border)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
							<div
								style={{
									width: 34,
									height: 34,
									borderRadius: 8,
									backgroundColor: "var(--primary)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "var(--primary-foreground)",
									fontSize: 15,
									fontWeight: 900,
								}}
							>
								L
							</div>
							<div>
								<div
									style={{
										fontSize: 14,
										fontWeight: 800,
										color: "var(--sidebar-foreground)",
										letterSpacing: "-0.03em",
									}}
								>
									LogDash
								</div>
								<div
									style={{
										fontSize: 10,
										color: "var(--muted-foreground)",
										textTransform: "uppercase",
										letterSpacing: "0.1em",
									}}
								>
									v2.0.0
								</div>
							</div>
						</div>
						<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
							<ThemeToggleButton />
							{/* Botão fechar drawer em mobile */}
							{isMobile && (
								<button
									onClick={onClose}
									style={{
										width: 32,
										height: 32,
										borderRadius: 6,
										border: "1px solid var(--border)",
										backgroundColor: "transparent",
										cursor: "pointer",
										fontSize: 16,
										color: "var(--muted-foreground)",
									}}
								>
									✕
								</button>
							)}
						</div>
					</div>
				</div>

				<nav style={{ padding: "14px 10px", flex: 1 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 9,
							padding: "9px 12px",
							borderRadius: 6,
							backgroundColor: "var(--sidebar-accent)",
							color: "var(--sidebar-foreground)",
							fontSize: 13,
							fontWeight: 600,
						}}
					>
						<span>📋</span> Logs
					</div>
				</nav>

				<div
					style={{
						padding: "16px 20px",
						borderTop: "1px solid var(--border)",
						borderBottom: "1px solid var(--border)",
					}}
				>
					<div
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: "var(--muted-foreground)",
							textTransform: "uppercase",
							letterSpacing: "0.1em",
							marginBottom: 12,
						}}
					>
						Visão Geral
					</div>
					{[
						{ label: "Total", value: stats.total, color: "var(--foreground)" },
						{ label: "Ativos", value: stats.active, color: "var(--primary)" },
						{
							label: "Inativos",
							value: stats.inactive,
							color: "var(--status-error)",
						},
					].map(({ label, value, color }) => (
						<div
							key={label}
							style={{
								display: "flex",
								justifyContent: "space-between",
								marginBottom: 8,
							}}
						>
							<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
								{label}
							</span>
							<span
								style={{
									fontSize: 14,
									fontWeight: 700,
									color,
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{value}
							</span>
						</div>
					))}
				</div>

				<div style={{ padding: "16px 20px" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div>
							<div
								style={{
									fontSize: 12,
									fontWeight: 700,
									color: "var(--sidebar-foreground)",
								}}
							>
								ADM
							</div>
							<div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
								Administrador
							</div>
						</div>
						<button
							onClick={logout}
							style={{
								padding: "5px 10px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "transparent",
								color: "var(--muted-foreground)",
								fontSize: 11,
								cursor: "pointer",
								fontFamily: "inherit",
							}}
						>
							Sair
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFile, setLogFile] = useState(null);
	const fileInputRef = useRef(null);

	const { logs, isLoading, error } = useLogs(logFile);
	const { filters, filteredLogs, stats, updateFilter, resetFilters } =
		useLogFilters(logs);

	const handleFileChange = useCallback((e) => {
		const file = e.target.files?.[0];
		if (file) setLogFile(file);
		e.target.value = ""; // permite reselecionar o mesmo arquivo
	}, []);

	return (
		<div
			style={{
				display: "flex",
				minHeight: "100vh",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				stats={stats}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px 36px",
					overflow: "auto",
					minWidth: 0,
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						marginBottom: 24,
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						{/* Botão hamburguer em mobile */}
						{isMobile && (
							<button
								onClick={() => setSidebarOpen(true)}
								style={{
									width: 36,
									height: 36,
									borderRadius: 6,
									border: "1px solid var(--border)",
									backgroundColor: "var(--card)",
									cursor: "pointer",
									fontSize: 18,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "var(--foreground)",
									flexShrink: 0,
								}}
							>
								☰
							</button>
						)}
						<div>
							<h1
								style={{
									margin: 0,
									fontSize: isMobile ? 18 : 22,
									fontWeight: 800,
									color: "var(--foreground)",
									letterSpacing: "-0.04em",
								}}
							>
								Log Viewer
							</h1>
							<p
								style={{
									margin: "4px 0 0",
									fontSize: 13,
									color: "var(--muted-foreground)",
								}}
							>
								<strong style={{ color: "var(--foreground)" }}>
									{filteredLogs.length}
								</strong>{" "}
								de{" "}
								<strong style={{ color: "var(--foreground)" }}>
									{stats.total}
								</strong>{" "}
								registros
							</p>
						</div>
					</div>

					{/* Botão carregar arquivo + toggle dark mode (desktop) */}
					<div
						style={{
							display: "flex",
							gap: 8,
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						{!isMobile && <ThemeToggleButton />}
						{/* Input de arquivo escondido — acionado pelo botão abaixo */}
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							onChange={handleFileChange}
							style={{ display: "none" }}
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							style={{
								padding: "8px 14px",
								borderRadius: 6,
								border: "1px solid var(--primary)",
								backgroundColor: `color-mix(in oklch, var(--primary) 8%, transparent)`,
								color: "var(--primary)",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
								fontFamily: "inherit",
								whiteSpace: "nowrap",
								display: "flex",
								alignItems: "center",
								gap: 6,
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.backgroundColor = `color-mix(in oklch, var(--primary) 15%, transparent)`)
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.backgroundColor = `color-mix(in oklch, var(--primary) 8%, transparent)`)
							}
						>
							📂 {logFile ? `${logFile.name}` : "Carregar JSON"}
						</button>
						{logFile && (
							<button
								onClick={() => setLogFile(null)}
								title="Voltar para dados de exemplo"
								style={{
									padding: "8px 10px",
									borderRadius: 6,
									border: "1px solid var(--border)",
									backgroundColor: "transparent",
									color: "var(--muted-foreground)",
									fontSize: 11,
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								✕ Mock
							</button>
						)}
					</div>
				</div>

				{isLoading ? (
					<LoadingState />
				) : error ? (
					<ErrorState message={error} />
				) : (
					<>
						{/* Stat cards — 1 coluna em mobile, 3 em desktop */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
								gap: 12,
								marginBottom: 24,
							}}
						>
							<StatCard
								label="Total de Logs"
								value={stats.total}
								accentColor="var(--primary)"
							/>
							<StatCard
								label="Ativos"
								value={stats.active}
								accentColor="var(--primary)"
							/>
							<StatCard
								label="Inativos"
								value={stats.inactive}
								accentColor="var(--status-error)"
							/>
						</div>

						<LogFilters
							filters={filters}
							onUpdate={updateFilter}
							onReset={resetFilters}
							isMobile={isMobile}
						/>
						<LogTable logs={filteredLogs} isMobile={isMobile} />
					</>
				)}
			</main>
		</div>
	);
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage() {
	const { login } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = useCallback(async () => {
		if (!username.trim() || !password.trim()) {
			setError("Preencha todos os campos.");
			return;
		}
		setIsLoading(true);
		await new Promise((r) => setTimeout(r, 500));
		const success = login({ username: username.trim(), password });
		if (!success) {
			setError("Usuário ou senha inválidos.");
			setIsLoading(false);
		}
	}, [username, password, login]);

	const inputStyle = {
		width: "100%",
		padding: "10px 14px",
		borderRadius: 7,
		border: "1px solid var(--border)",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: 14,
		fontFamily: "inherit",
		outline: "none",
		boxSizing: "border-box",
	};

	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "var(--background)",
				padding: 16,
			}}
		>
			<div
				style={{
					position: "fixed",
					inset: 0,
					pointerEvents: "none",
					backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
					backgroundSize: "40px 40px",
					opacity: 0.4,
				}}
			/>

			{/* Theme toggle no canto superior direito da tela de login */}
			<div style={{ position: "fixed", top: 16, right: 16, zIndex: 10 }}>
				<ThemeToggleButton />
			</div>

			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 380,
					padding: 40,
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 12,
					boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
				}}
			>
				<div style={{ textAlign: "center", marginBottom: 32 }}>
					<div
						style={{
							width: 52,
							height: 52,
							borderRadius: 12,
							backgroundColor: "var(--primary)",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--primary-foreground)",
							fontSize: 20,
							fontWeight: 900,
							marginBottom: 14,
						}}
					>
						L
					</div>
					<div
						style={{
							fontSize: 18,
							fontWeight: 800,
							color: "var(--foreground)",
							letterSpacing: "-0.04em",
						}}
					>
						LogDash
					</div>
					<div
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							marginTop: 4,
						}}
					>
						Acesso restrito ao painel
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<div>
						<label
							style={{
								display: "block",
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								marginBottom: 6,
							}}
						>
							Usuário
						</label>
						<input
							type="text"
							value={username}
							placeholder="ADM"
							autoComplete="username"
							onChange={(e) => {
								setUsername(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							style={inputStyle}
						/>
					</div>
					<div>
						<label
							style={{
								display: "block",
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								marginBottom: 6,
							}}
						>
							Senha
						</label>
						<input
							type="password"
							value={password}
							placeholder="••••••••"
							autoComplete="current-password"
							onChange={(e) => {
								setPassword(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							style={inputStyle}
						/>
					</div>
					{error && (
						<div
							style={{
								fontSize: 12,
								color: "var(--status-error)",
								textAlign: "center",
								padding: "8px 12px",
								backgroundColor: `color-mix(in oklch, var(--status-error) 8%, transparent)`,
								borderRadius: 6,
								border: `1px solid color-mix(in oklch, var(--status-error) 22%, transparent)`,
							}}
						>
							{error}
						</div>
					)}
					<button
						onClick={handleSubmit}
						disabled={isLoading}
						style={{
							marginTop: 4,
							padding: "11px 16px",
							borderRadius: 7,
							border: "none",
							backgroundColor: isLoading ? "var(--muted)" : "var(--primary)",
							color: isLoading
								? "var(--muted-foreground)"
								: "var(--primary-foreground)",
							fontSize: 14,
							fontWeight: 700,
							cursor: isLoading ? "not-allowed" : "pointer",
							fontFamily: "inherit",
						}}
					>
						{isLoading ? "Autenticando..." : "Entrar"}
					</button>
				</div>

				<div
					style={{
						marginTop: 24,
						textAlign: "center",
						fontSize: 11,
						color: "var(--muted-foreground)",
						padding: "10px 14px",
						backgroundColor: "var(--muted)",
						borderRadius: 6,
					}}
				>
					Usuário: <strong>ADM</strong> · Senha: <strong>admin123</strong>
				</div>
			</div>
		</div>
	);
}

function AppContent() {
	const { isAuthenticated } = useAuth();
	return isAuthenticated ? <Dashboard /> : <LoginPage />;
}

// ═══════════════════════════════════════
// ROOT
// ═══════════════════════════════════════
export default function App() {
	return (
		<>
			<ThemeProvider>
				<AuthProvider>
					<AppContent />
				</AuthProvider>
			</ThemeProvider>
		</>
	);
}
