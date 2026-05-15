// src/components/Sidebar.tsx
import React from "react";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggleButton } from "./ThemeButton";
import type { Page } from "../App";

type Stats = {
	total: number;
	started: number;
	finished: number;
	erro: number;
};

interface SidebarProps {
	stats: Stats;
	isOpen: boolean;
	onClose: () => void;
	isMobile: boolean;
	currentPage: Page;
	onNavigate: (page: Page) => void;
}

export function Sidebar({
	stats,
	isOpen,
	onClose,
	isMobile,
	currentPage,
	onNavigate,
}: SidebarProps) {
	const { logout } = useAuth();

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
				{/* ── Header: logo + fechar (mobile) ── */}
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

						{/* Botão fechar só aparece em mobile */}
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

				{/* ── Navegação ── */}
				<nav style={{ padding: "12px 12px 0" }}>
					{(
						[
							{ page: "dashboard", label: "Dashboard", icon: "▦" },
							{ page: "logs", label: "Logs", icon: "☰" },
						] as { page: Page; label: string; icon: string }[]
					).map(({ page, label, icon }) => (
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
								backgroundColor:
									currentPage === page
										? "color-mix(in oklch, var(--primary) 12%, transparent)"
										: "transparent",
								color:
									currentPage === page
										? "var(--primary)"
										: "var(--muted-foreground)",
								fontSize: 13,
								fontWeight: currentPage === page ? 700 : 400,
								cursor: "pointer",
								fontFamily: "inherit",
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 2,
								textAlign: "left",
							}}
						>
							<span>{icon}</span>
							{label}
						</button>
					))}
				</nav>

				{/* ── Visão geral (stats) ── */}
				<div
					style={{
						padding: "16px 20px",
						borderTop: "1px solid var(--border)",
						borderBottom: "1px solid var(--border)",
						marginTop: 8,
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
						{ label: "Ativos", value: stats.started, color: "var(--primary)" },
						{
							label: "Inativos",
							value: stats.finished,
							color: "var(--chart-4)",
						},
						{ label: "Erros", value: stats.erro, color: "var(--destructive)" },
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

				{/* ── Rodapé: usuário + tema + logout ── */}
				<div
					style={{
						marginTop: "auto", // empurra para o fundo da sidebar
						padding: "16px 20px",
						borderTop: "1px solid var(--border)",
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

					<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
						<ThemeToggleButton />
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
