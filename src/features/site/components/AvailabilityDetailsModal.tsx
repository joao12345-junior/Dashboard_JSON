// src/features/site/components/AvailabilityDetailsModal.tsx
import React, { useMemo, useState } from "react";
import { Modal } from "../../../components/Modal";
import { formatDetails } from "../../../lib/formatDetails";
import type { AvailabilityRecord } from "../hooks/useSiteData";

interface AvailabilityDetailsModalProps {
	/** Check clicado na tabela. `null` = modal fechado (mesmo padrão que `Modal.isOpen`). */
	record: AvailabilityRecord | null;
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
	padding: "5px 12px",
	borderRadius: 999,
	border: "1px solid var(--border)",
	backgroundColor: "transparent",
	color: "var(--foreground)",
	fontSize: 12,
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
			<div style={{ fontSize: 14, color: "var(--foreground)", wordBreak: "break-all" }}>
				{children}
			</div>
		</div>
	);
}

/// <summary>
/// Modal com os dados de um check de disponibilidade e o corpo da resposta
/// (texto simples ou JSON) que o site devolveu — mesmo padrão do modal de
/// detalhes dos logs: JSON vem indentado, com opção de ver o original.
/// </summary>
export function AvailabilityDetailsModal({
	record,
	onClose,
}: AvailabilityDetailsModalProps) {
	const [copied, setCopied] = useState(false);
	// true = mostra o corpo original em vez do JSON indentado
	const [showRaw, setShowRaw] = useState(false);

	const body = record?.response_body ?? null;
	// Só recalcula quando o corpo muda (pode ser um texto grande).
	const formatted = useMemo(() => (body ? formatDetails(body) : null), [body]);

	if (!record) return null;

	async function handleCopy(text: string) {
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
		<Modal isOpen onClose={onClose} title="Detalhes do Check">
			<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
						gap: 16,
					}}
				>
					<Field label="Data / Hora">
						{new Date(record.checked_at).toLocaleString("pt-BR", {
							timeZone: "America/Sao_Paulo",
						})}
					</Field>
					<Field label="Status">
						<span
							style={{
								fontSize: 11,
								fontWeight: 700,
								padding: "3px 10px",
								borderRadius: 20,
								backgroundColor: record.is_up
									? "color-mix(in oklch, oklch(0.65 0.15 145) 15%, transparent)"
									: "color-mix(in oklch, var(--destructive) 12%, transparent)",
								color: record.is_up ? "oklch(0.5 0.15 145)" : "var(--destructive)",
							}}
						>
							{record.is_up ? "● Online" : "● Offline"}
						</span>
					</Field>
					<Field label="Código HTTP">{record.status_code ?? "—"}</Field>
					<Field label="Tempo de resposta">{record.response_time_ms}ms</Field>
				</div>

				<Field label="URL">{record.url}</Field>

				<div>
					<div
						style={{
							...fieldLabelStyle,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							gap: 8,
						}}
					>
						<span>Resposta{formatted?.isJson ? " · JSON" : ""}</span>
						{body && (
							<span style={{ display: "flex", gap: 6 }}>
								{formatted?.isJson && (
									<button
										type="button"
										onClick={() => setShowRaw((v) => !v)}
										style={{
											...pillButtonStyle,
											padding: "2px 10px",
											fontSize: 11,
											textTransform: "none",
											letterSpacing: 0,
										}}
									>
										{showRaw ? "Formatar" : "Ver original"}
									</button>
								)}
								<button
									type="button"
									onClick={() => void handleCopy(body)}
									style={{
										...pillButtonStyle,
										padding: "2px 10px",
										fontSize: 11,
										textTransform: "none",
										letterSpacing: 0,
									}}
								>
									{copied ? "✓ Copiado" : "Copiar"}
								</button>
							</span>
						)}
					</div>
					{body ? (
						<textarea
							readOnly
							aria-label="Corpo da resposta HTTP"
							value={formatted?.isJson && !showRaw ? formatted.text : body}
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
					) : (
						<div
							style={{
								padding: 12,
								borderRadius: 6,
								border: "1px dashed var(--border)",
								color: "var(--muted-foreground)",
								fontSize: 13,
							}}
						>
							{record.response_body === undefined
								? "A API ainda não envia o corpo da resposta."
								: "Nenhum corpo foi guardado neste check (sem resposta do site, ou corpo não guardado para esta URL)."}
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}
