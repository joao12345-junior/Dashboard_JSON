// src/components/DebugPanel.tsx

import { useState } from "react";
import { DebugInfo, LoadProgress } from "../hooks/useProgressiveLogs";
import { FileLoadResult } from "../lib/repository/LogRepository";

interface DebugPanelProps {
	progress: LoadProgress;
	debug: DebugInfo;
}

/**
 * Painel de debug colapsável.
 *
 * Mostra em tempo real:
 * - Progresso de carregamento (arquivos e registros)
 * - Métricas de performance (tempo, tamanho total)
 * - Lista detalhada de cada arquivo (sucesso/erro/skip)
 *
 * Só aparece quando ativo — não polui a UI em uso normal.
 */
export function DebugPanel({ progress, debug }: DebugPanelProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [filter, setFilter] = useState<"all" | "success" | "error" | "skipped">(
		"all",
	);

	const filteredResults = debug.results.filter(
		(r) => filter === "all" || r.status === filter,
	);

	return (
		<div
			style={{
				position: "fixed",
				bottom: 16,
				right: 16,
				zIndex: 100,
				width: isOpen ? 560 : "auto",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
				overflow: "hidden",
				transition: "width 0.2s ease",
			}}
		>
			{/* ── Header sempre visível ── */}
			<button
				onClick={() => setIsOpen((o) => !o)}
				style={{
					width: "100%",
					padding: "10px 16px",
					backgroundColor: "transparent",
					border: "none",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					gap: 8,
					color: "var(--foreground)",
					fontSize: 12,
					fontWeight: 700,
					fontFamily: "inherit",
					textAlign: "left",
				}}
			>
				{/* Indicador de status */}
				<span
					style={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						backgroundColor: progress.isLoading
							? "#f59e0b"
							: progress.error
								? "var(--destructive)"
								: debug.errorCount > 0
									? "#f59e0b"
									: "#22c55e",
						flexShrink: 0,
					}}
				/>
				DEBUG
				{progress.isLoading && (
					<span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>
						— {progress.percentComplete}% ({progress.loadedFiles}/
						{progress.totalFiles} arquivos)
					</span>
				)}
				{progress.isDone && (
					<span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>
						— {debug.totalRecords.toLocaleString("pt-BR")} registros em{" "}
						{debug.elapsedSeconds}s
					</span>
				)}
				{progress.error && (
					<span style={{ color: "var(--destructive)", fontWeight: 400 }}>
						— Erro: {progress.error}
					</span>
				)}
				<span style={{ marginLeft: "auto" }}>{isOpen ? "▾" : "▸"}</span>
			</button>

			{/* ── Corpo expandido ── */}
			{isOpen && (
				<div style={{ borderTop: "1px solid var(--border)" }}>
					{/* Métricas globais */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
							gap: 1,
							backgroundColor: "var(--border)",
						}}
					>
						{[
							{
								label: "Arquivos OK",
								value: debug.successCount,
								color: "#22c55e",
							},
							{
								label: "Erros",
								value: debug.errorCount,
								color: "var(--destructive)",
							},
							{
								label: "Ignorados",
								value: debug.skippedCount,
								color: "var(--muted-foreground)",
							},
							{
								label: "Total MB",
								value: `${debug.totalSizeMb}`,
								color: "var(--foreground)",
							},
						].map((metric) => (
							<div
								key={metric.label}
								style={{
									padding: "10px 12px",
									backgroundColor: "var(--card)",
									textAlign: "center",
								}}
							>
								<div
									style={{
										fontSize: 18,
										fontWeight: 700,
										color: metric.color,
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{metric.value}
								</div>
								<div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
									{metric.label}
								</div>
							</div>
						))}
					</div>

					{/* Barra de progresso */}
					{(progress.isLoading || progress.isDone) && (
						<div
							style={{
								height: 3,
								backgroundColor: "var(--muted)",
								margin: "0 16px",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${progress.percentComplete}%`,
									backgroundColor: progress.isDone
										? "#22c55e"
										: "var(--primary)",
									transition: "width 0.3s ease",
									borderRadius: 9999,
								}}
							/>
						</div>
					)}

					{/* Filtros */}
					<div
						style={{
							display: "flex",
							gap: 6,
							padding: "10px 16px 6px",
						}}
					>
						{(["all", "success", "error", "skipped"] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								style={{
									padding: "3px 10px",
									borderRadius: 4,
									border: "1px solid var(--border)",
									backgroundColor:
										filter === f ? "var(--primary)" : "transparent",
									color:
										filter === f
											? "var(--primary-foreground)"
											: "var(--muted-foreground)",
									fontSize: 11,
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								{f === "all"
									? `Todos (${debug.results.length})`
									: f === "success"
										? `OK (${debug.successCount})`
										: f === "error"
											? `Erros (${debug.errorCount})`
											: `Ignorados (${debug.skippedCount})`}
							</button>
						))}
					</div>

					{/* Lista de arquivos */}
					<div
						style={{
							maxHeight: 280,
							overflowY: "auto",
							padding: "0 16px 12px",
						}}
					>
						{filteredResults.length === 0 ? (
							<div
								style={{
									textAlign: "center",
									padding: "20px 0",
									fontSize: 12,
									color: "var(--muted-foreground)",
								}}
							>
								Nenhum resultado ainda
							</div>
						) : (
							filteredResults.map((result, i) => (
								<FileResultRow
									key={`${result.fileName}-${i}`}
									result={result}
								/>
							))
						)}
					</div>

					{/* Rodapé com timing */}
					{debug.startedAt && (
						<div
							style={{
								padding: "8px 16px",
								borderTop: "1px solid var(--border)",
								fontSize: 10,
								color: "var(--muted-foreground)",
								fontFamily: "monospace",
							}}
						>
							Iniciado: {debug.startedAt.toLocaleTimeString("pt-BR")}
							{debug.finishedAt && (
								<>
									{" "}
									· Concluído: {debug.finishedAt.toLocaleTimeString("pt-BR")} ·
									Duração: {debug.elapsedSeconds}s
								</>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Linha individual na lista de arquivos do debug panel */
function FileResultRow({ result }: { result: FileLoadResult }) {
	const statusColor =
		result.status === "success"
			? "#22c55e"
			: result.status === "error"
				? "var(--destructive)"
				: "var(--muted-foreground)";

	const statusLabel =
		result.status === "success"
			? "OK"
			: result.status === "error"
				? "ERRO"
				: "SKIP";

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "4px 0",
				borderBottom: "1px solid var(--border)",
				fontSize: 11,
			}}
		>
			{/* Badge de status */}
			<span
				style={{
					width: 36,
					textAlign: "center",
					padding: "1px 4px",
					borderRadius: 3,
					backgroundColor: `color-mix(in oklch, ${statusColor} 15%, transparent)`,
					color: statusColor,
					fontWeight: 700,
					flexShrink: 0,
					fontSize: 10,
				}}
			>
				{statusLabel}
			</span>

			{/* Nome do arquivo */}
			<span
				style={{
					flex: 1,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					color: "var(--foreground)",
					fontFamily: "monospace",
				}}
				title={result.fileName}
			>
				{result.fileName}
			</span>

			{/* Detalhes à direita */}
			<span
				style={{
					color: "var(--muted-foreground)",
					flexShrink: 0,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{result.status === "success" &&
					`${result.recordCount.toLocaleString("pt-BR")} reg · ${result.duration_ms}ms`}
				{result.status === "error" && result.error}
				{result.status === "skipped" && result.reason}
			</span>

			{/* Tamanho */}
			<span
				style={{
					color: "var(--muted-foreground)",
					flexShrink: 0,
					minWidth: 48,
					textAlign: "right",
				}}
			>
				{result.size_mb}MB
			</span>
		</div>
	);
}
