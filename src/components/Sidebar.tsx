// src/components/Sidebar.tsx
import { Page } from "../App";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
	isMobile: boolean;
	currentPage: Page;
	onNavigate: (page: Page) => void;
}

/**
 * Estrutura de navegação declarativa.
 *
 * Cada seção agrupa páginas de um mesmo domínio.
 * Para adicionar um novo tipo de log no futuro:
 *   1. Adicione uma nova seção aqui
 *   2. Nenhum outro arquivo da Sidebar precisa mudar
 */
const NAV_SECTIONS = [
	{
		label: "Geral",
		items: [{ page: "home" as Page, label: "Home", icon: "⬡" }],
	},
	{
		label: "Logs de Processo",
		items: [
			{ page: "process-dashboard" as Page, label: "Dashboard", icon: "▦" },
			{ page: "process-list" as Page, label: "Registros", icon: "☰" },
		],
	},
	{
		label: "Windows Event Log",
		items: [
			{ page: "windows-dashboard" as Page, label: "Dashboard", icon: "▦" },
			{ page: "windows-list" as Page, label: "Registros", icon: "☰" },
		],
	},
] as const;

export function Sidebar({
	isOpen,
	onClose,
	isMobile,
	currentPage,
	onNavigate,
}: SidebarProps) {
	const sidebarStyle: React.CSSProperties = isMobile
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
			{/* Overlay escuro no mobile */}
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
				{/* ── Header ── */}
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
									v3.0.0
								</div>
							</div>
						</div>

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

				{/* ── Navegação por seções ── */}
				<nav style={{ padding: "12px 12px 0", flex: 1, overflowY: "auto" }}>
					{NAV_SECTIONS.map((section) => (
						<div key={section.label} style={{ marginBottom: 24 }}>
							{/* Label da seção */}
							<div
								style={{
									fontSize: 10,
									fontWeight: 700,
									color: "var(--muted-foreground)",
									textTransform: "uppercase",
									letterSpacing: "0.12em",
									padding: "0 12px",
									marginBottom: 6,
								}}
							>
								{section.label}
							</div>

							{/* Itens da seção */}
							{section.items.map(({ page, label, icon }) => {
								const isActive = currentPage === page;
								return (
									<button
										key={page}
										onClick={() => {
											onNavigate(page);
											onClose();
										}}
										style={{
											width: "100%",
											padding: "8px 12px",
											borderRadius: 6,
											border: "none",
											backgroundColor: isActive
												? "color-mix(in oklch, var(--primary) 12%, transparent)"
												: "transparent",
											color: isActive
												? "var(--primary)"
												: "var(--sidebar-foreground)",
											display: "flex",
											alignItems: "center",
											gap: 10,
											cursor: "pointer",
											fontSize: 13,
											fontWeight: isActive ? 600 : 400,
											textAlign: "left",
											marginBottom: 2,
											transition: "background-color 0.15s",
										}}
									>
										<span style={{ fontSize: 14, opacity: 0.8 }}>{icon}</span>
										{label}
									</button>
								);
							})}
						</div>
					))}
				</nav>
			</aside>
		</>
	);
}
