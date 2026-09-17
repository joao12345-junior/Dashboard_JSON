// src/components/Sidebar.tsx
import { useState } from "react";
import {
	Home,
	Archive,
	AppWindow,
	ScrollText,
	Globe,
	Settings,
	LayoutDashboard,
	List,
	ChevronDown,
	Menu,
	X,
	PanelLeftClose,
	PanelLeftOpen,
} from "lucide-react";
import { Page } from "../App";
import { useTheme } from "../hooks/useTheme";
import { StatRow } from "./StatRow";

interface SidebarStats {
	total: number;
	started: number;
	finished: number;
	erro: number;
}

interface SidebarProps {
	isMobile: boolean;
	currentPage: Page;
	onNavigate: (page: Page) => void;
	stats?: SidebarStats;
	/** @deprecated a Sidebar controla seu próprio estado de abertura agora. Remover das páginas na próxima limpeza. */
	isOpen?: boolean;
	/** @deprecated ver isOpen. */
	onClose?: () => void;
}

const NAV_SECTIONS = [
	{
		label: "Geral",
		icon: Home,
		items: [{ page: "home" as Page, label: "Home", icon: Home }],
	},
	{
		label: "Logs Backup",
		icon: Archive,
		items: [
			{
				page: "process-dashboard" as Page,
				label: "Dashboard",
				icon: LayoutDashboard,
			},
			{ page: "process-list" as Page, label: "Registros", icon: List },
		],
	},
	{
		label: "Windows Event Log",
		icon: AppWindow,
		items: [
			{
				page: "windows-dashboard" as Page,
				label: "Dashboard",
				icon: LayoutDashboard,
			},
			{ page: "windows-list" as Page, label: "Registros", icon: List },
		],
	},
	{
		label: "Logs Gerais",
		icon: ScrollText,
		items: [
			{
				page: "app-dashboard" as Page,
				label: "Dashboard",
				icon: LayoutDashboard,
			},
			{ page: "app-list" as Page, label: "Registros", icon: List },
		],
	},
	{
		label: "Site Optare",
		icon: Globe,
		items: [
			{
				page: "site-dashboard" as Page,
				label: "Dashboard",
				icon: LayoutDashboard,
			},
			{ page: "site-list" as Page, label: "Registros", icon: List },
		],
	},
	{
		label: "Configurações",
		icon: Settings,
		items: [{ page: "settings" as Page, label: "Ajustes", icon: Settings }],
	},
] as const;

const iconButtonStyle: React.CSSProperties = {
	width: 30,
	height: 30,
	borderRadius: 6,
	border: "1px solid var(--border)",
	backgroundColor: "transparent",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: 0,
};

function navButtonStyle(
	isActive: boolean,
	collapsed: boolean,
	isSub = false,
): React.CSSProperties {
	return {
		width: "100%",
		padding: collapsed ? "10px 0" : isSub ? "6px 10px" : "8px 10px",
		borderRadius: 6,
		border: "none",
		backgroundColor: isActive
			? "color-mix(in oklch, var(--primary) 12%, transparent)"
			: "transparent",
		color: isActive ? "var(--primary)" : "var(--sidebar-foreground)",
		display: "flex",
		alignItems: "center",
		justifyContent: collapsed ? "center" : "flex-start",
		gap: 10,
		cursor: "pointer",
		fontSize: isSub ? 12.5 : 13,
		fontWeight: isActive ? 600 : 400,
		textAlign: "left",
		marginBottom: 2,
		transition: "background-color 0.15s",
	};
}

function findAutoExpandSection(page: Page): string | null {
	const active = NAV_SECTIONS.find((s) => s.items.some((i) => i.page === page));
	return active && active.items.length > 1 ? active.label : null;
}

export function Sidebar({
	isMobile,
	currentPage,
	onNavigate,
	stats,
}: SidebarProps) {
	const isDark = useTheme().isDark;
	const [mobileOpen, setMobileOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const [expandedSection, setExpandedSection] = useState<string | null>(() =>
		findAutoExpandSection(currentPage),
	);

	// Reajusta a secao expandida quando a pagina ativa muda. Ajuste de estado
	// durante o render (nao em efeito) pra nao ter o flash de um commit extra
	// -- padrao que o proprio React recomenda pra "ajustar estado quando uma
	// prop muda" (https://react.dev/learn/you-might-not-need-an-effect).
	const [prevPage, setPrevPage] = useState(currentPage);
	if (currentPage !== prevPage) {
		setPrevPage(currentPage);
		const autoExpand = findAutoExpandSection(currentPage);
		if (autoExpand) setExpandedSection(autoExpand);
	}

	const effectiveCollapsed = !isMobile && collapsed;
	const width = isMobile ? 260 : effectiveCollapsed ? 64 : 220;

	function closeMobile() {
		setMobileOpen(false);
	}

	function handleNavigate(page: Page) {
		onNavigate(page);
		if (isMobile) closeMobile();
	}

	function handleSectionClick(section: (typeof NAV_SECTIONS)[number]) {
		if (effectiveCollapsed) {
			handleNavigate(section.items[0].page);
			return;
		}
		setExpandedSection((prev) =>
			prev === section.label ? null : section.label,
		);
	}

	const asideStyle: React.CSSProperties = isMobile
		? {
				position: "fixed",
				top: 0,
				left: 0,
				zIndex: 50,
				width,
				height: "100vh",
				transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
				transition: "transform 0.25s ease",
				boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,0.15)" : "none",
			}
		: {
				position: "relative",
				width,
				minHeight: "100vh",
				flexShrink: 0,
				transition: "width 0.2s ease",
			};

	return (
		<>
			{isMobile && !mobileOpen && (
				<button
					onClick={() => setMobileOpen(true)}
					aria-label="Abrir menu"
					style={{
						position: "fixed",
						top: 16,
						left: 16,
						zIndex: 45,
						width: 40,
						height: 40,
						borderRadius: 8,
						border: "1px solid var(--border)",
						backgroundColor: "var(--card)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						boxShadow: "var(--shadow-sm)",
					}}
				>
					<Menu size={20} color="var(--foreground)" />
				</button>
			)}

			{isMobile && mobileOpen && (
				<div
					onClick={closeMobile}
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
					...asideStyle,
					backgroundColor: "var(--sidebar)",
					borderRight: "1px solid var(--border)",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						padding: effectiveCollapsed ? "20px 12px" : "20px 20px 16px",
						borderBottom: "1px solid var(--border)",
						display: "flex",
						alignItems: "center",
						justifyContent: effectiveCollapsed ? "center" : "space-between",
						gap: 10,
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							minWidth: 0,
						}}
					>
						<img
							src={
								isDark
									? "/image/favicon/LogDashFavicon-dark.svg"
									: "/image/favicon/LogDashFavicon-light.svg"
							}
							alt="LogDash"
							style={{ width: 36, height: 36, flexShrink: 0 }}
						/>
						{!effectiveCollapsed && (
							<div style={{ minWidth: 0 }}>
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
									v4.0.0
								</div>
							</div>
						)}
					</div>

					{isMobile ? (
						<button
							onClick={closeMobile}
							aria-label="Fechar menu"
							style={iconButtonStyle}
						>
							<X size={16} color="var(--muted-foreground)" />
						</button>
					) : (
						!effectiveCollapsed && (
							<button
								onClick={() => setCollapsed(true)}
								title="Recolher menu"
								aria-label="Recolher menu"
								style={iconButtonStyle}
							>
								<PanelLeftClose size={16} color="var(--muted-foreground)" />
							</button>
						)
					)}
				</div>

				{effectiveCollapsed && (
					<button
						onClick={() => setCollapsed(false)}
						title="Expandir menu"
						aria-label="Expandir menu"
						style={{ ...iconButtonStyle, margin: "8px auto 0" }}
					>
						<PanelLeftOpen size={16} color="var(--muted-foreground)" />
					</button>
				)}

				<nav
					style={{
						padding: effectiveCollapsed ? "12px 8px 0" : "12px 12px 0",
						flex: 1,
						overflowY: "auto",
					}}
				>
					{NAV_SECTIONS.map((section) => {
						const isSingle = section.items.length === 1;
						const isSectionActive = section.items.some(
							(i) => i.page === currentPage,
						);
						const isExpanded = expandedSection === section.label;

						if (isSingle) {
							const item = section.items[0];
							const Icon = item.icon;
							const isActive = currentPage === item.page;
							return (
								<button
									key={item.page}
									onClick={() => handleNavigate(item.page)}
									title={item.label}
									style={navButtonStyle(isActive, effectiveCollapsed)}
								>
									<Icon size={17} strokeWidth={2} />
									{!effectiveCollapsed && item.label}
								</button>
							);
						}

						const SectionIcon = section.icon;
						return (
							<div key={section.label} style={{ marginBottom: 4 }}>
								<button
									onClick={() => handleSectionClick(section)}
									title={section.label}
									style={navButtonStyle(
										effectiveCollapsed
											? isSectionActive
											: isSectionActive && !isExpanded,
										effectiveCollapsed,
									)}
								>
									<SectionIcon size={17} strokeWidth={2} />
									{!effectiveCollapsed && (
										<>
											<span style={{ flex: 1, textAlign: "left" }}>
												{section.label}
											</span>
											<ChevronDown
												size={14}
												style={{
													transform: isExpanded
														? "rotate(180deg)"
														: "rotate(0deg)",
													transition: "transform 0.15s",
													opacity: 0.6,
												}}
											/>
										</>
									)}
								</button>

								{!effectiveCollapsed && isExpanded && (
									<div style={{ paddingLeft: 14, marginTop: 2 }}>
										{section.items.map((item) => {
											const ItemIcon = item.icon;
											const isActive = currentPage === item.page;
											return (
												<button
													key={item.page}
													onClick={() => handleNavigate(item.page)}
													style={navButtonStyle(isActive, false, true)}
												>
													<ItemIcon size={15} strokeWidth={2} />
													{item.label}
												</button>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</nav>

				{stats && !effectiveCollapsed && (
					<div
						style={{
							padding: "12px 16px",
							borderTop: "1px solid var(--border)",
						}}
					>
						<StatRow label="Total" value={stats.total} />
						<StatRow label="Iniciados" value={stats.started} />
						<StatRow label="Finalizados" value={stats.finished} />
						<StatRow label="Erros" value={stats.erro} />
					</div>
				)}
			</aside>
		</>
	);
}
