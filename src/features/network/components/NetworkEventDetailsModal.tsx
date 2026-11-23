// src/features/network/components/NetworkEventDetailsModal.tsx
import React, { useMemo, useState } from "react";
import { Modal } from "../../../components/Modal";
import { SeverityBadge } from "./SeverityBadge";
import { formatEventTime } from "../formatEventTime";
import type { NetworkEvent } from "../hooks/useNetworkEvents";

interface NetworkEventDetailsModalProps {
	/** Evento clicado na tabela. `null` = modal fechado (mesmo padrão que `Modal.isOpen`). */
	event: NetworkEvent | null;
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

const pillButtonStyle: React.CSSProperties = {
	padding: "2px 10px",
	borderRadius: 999,
	border: "1px solid var(--border)",
	backgroundColor: "transparent",
	color: "var(--foreground)",
	fontSize: 11,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
};

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
			<div
				style={{
					fontSize: 14,
					color: "var(--foreground)",
					wordBreak: "break-word",
				}}
			>
				{children}
			</div>
		</div>
	);
}

/// <summary>
/// Modal com os dados de um evento de rede: cabeçalho (gravidade, tipo, hora,
/// dispositivo), a mensagem completa e todos os campos CEF extras em JSON.
/// </summary>
export function NetworkEventDetailsModal({
	event,
	onClose,
}: NetworkEventDetailsModalProps) {
	const [copied, setCopied] = useState(false);

	// JSON dos campos extras: só recalcula quando o evento muda.
	const extensionJson = useMemo(
		() => (event ? JSON.stringify(event.extension, null, 2) : ""),
		[event],
	);

	if (!event) return null;

	const when = event.event_time ?? event.created_at;
	const ext = event.extension;
	const device =
		ext.UNIFIdeviceName ?? ext.UNIFIdeviceModel ?? event.device_product ?? "—";

	async function handleCopy(current: NetworkEvent) {
		const text = [
			`${formatEventTime(current.event_time ?? current.created_at)} — ${current.name ?? "Sem nome"}`,
			current.extension.msg ?? "",
			extensionJson,
		]
			.filter(Boolean)
			.join("\n\n");
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Sem permissão de área de transferência: sem feedback falso.
			setCopied(false);
		}
	}

	return (
		<Modal isOpen onClose={onClose} title="Detalhes do Evento de Rede">
			<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
						gap: 16,
					}}
				>
					<Field label="Data / Hora">{formatEventTime(when)}</Field>
					<Field label="Gravidade">
						<SeverityBadge severity={event.severity} />
					</Field>
					<Field label="Evento">{event.name ?? "Sem nome"}</Field>
					<Field label="Código">{event.signature_id ?? "—"}</Field>
					<Field label="Dispositivo">{device}</Field>
					<Field label="IP de origem">{event.source_ip ?? "—"}</Field>
				</div>

				{ext.msg && <Field label="Mensagem">{ext.msg}</Field>}

				<div>
					<div
						style={{
							...fieldLabelStyle,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span>Campos do evento · JSON</span>
						<button
							type="button"
							onClick={() => void handleCopy(event)}
							style={pillButtonStyle}
						>
							{copied ? "✓ Copiado" : "Copiar"}
						</button>
					</div>
					<textarea
						readOnly
						aria-label="Campos do evento em JSON"
						value={extensionJson}
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
			</div>
		</Modal>
	);
}
