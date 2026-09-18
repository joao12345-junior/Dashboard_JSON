// src/features/app-logs/components/AppLogDetailsModal.tsx
import React from "react";
import { Modal } from "../../../components/Modal";
import { AppTypeBadge } from "./AppTypeBadge";
import { normalizeDateToView } from "../../../lib/normalizeDateToView";
import type { AppLog } from "../../../lib/types/Log";

interface AppLogDetailsModalProps {
	/** Log clicado na tabela. `null` = modal fechado (mesmo padrão que `Modal.isOpen`). */
	log: AppLog | null;
	onClose: () => void;
}

const fieldLabelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	marginBottom: 4,
};

const fieldValueStyle: React.CSSProperties = {
	fontSize: 14,
	color: "var(--foreground)",
};

/// <summary>
/// Um par label/valor da grade de informações básicas — evita repetir a
/// mesma estrutura de <div> 6 vezes dentro do modal.
/// </summary>
function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div style={fieldLabelStyle}>{label}</div>
			<div style={fieldValueStyle}>{children}</div>
		</div>
	);
}

/// <summary>
/// Modal com todas as informações básicas de um <see cref="AppLog"/> clicado
/// na tabela de Registros, mais o campo "detalhes" completo em um textarea
/// somente leitura (pode conter stack trace / mensagem de erro longa, por
/// isso não cabe na tabela).
/// </summary>
export function AppLogDetailsModal({ log, onClose }: AppLogDetailsModalProps) {
	// log null == modal fechado -- AppList controla isso via selectedLog.
	if (!log) return null;

	return (
		<Modal isOpen onClose={onClose} title="Detalhes do Log">
			<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
						gap: 16,
					}}
				>
					<Field label="Programa">{log.programa ?? "Sem programa"}</Field>
					<Field label="Classe">{log.classe}</Field>
					<Field label="Tipo">
						<AppTypeBadge tipo={log.tipo} />
					</Field>
					<Field label="Data">{normalizeDateToView(log.date)}</Field>
					<Field label="Hora">{log.time}</Field>
				</div>

				<Field label="Mensagem">{log.message}</Field>

				{/* "detalhes" e opcional -- so mostra o textarea quando ha algo pra ver */}
				{log.detalhes && (
					<div>
						<div style={fieldLabelStyle}>Detalhes</div>
						<textarea
							readOnly
							value={log.detalhes}
							rows={12}
							style={{
								width: "100%",
								resize: "vertical",
								fontFamily: "var(--font-mono)",
								fontSize: 12,
								padding: 10,
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "var(--muted)",
								color: "var(--foreground)",
								boxSizing: "border-box",
							}}
						/>
					</div>
				)}
			</div>
		</Modal>
	);
}
