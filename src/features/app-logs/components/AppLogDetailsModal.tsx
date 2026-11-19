// src/features/app-logs/components/AppLogDetailsModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../../components/Modal";
import { AppTypeBadge } from "./AppTypeBadge";
import { normalizeDateToView } from "../../../lib/normalizeDateToView";
import { formatDetails } from "../../../lib/formatDetails";
import type { AppLog } from "../../../lib/types/Log";

interface AppLogDetailsModalProps {
	/** Log clicado na tabela. `null` = modal fechado (mesmo padrão que `Modal.isOpen`). */
	log: AppLog | null;
	onClose: () => void;
	/**
	 * Registros do mesmo programa logo antes/depois do log aberto (inclui ele),
	 * do mais novo para o mais antigo. Vazio = esconde a seção.
	 */
	surrounding?: AppLog[];
	/** Clique num registro da seção "ao redor": abre os detalhes dele. */
	onSelectSurrounding?: (log: AppLog) => void;
	/**
	 * Posição do log na lista filtrada (index base 0) e total. Sem isso, a
	 * navegação entre registros some.
	 */
	position?: { index: number; total: number };
	/** Vai para o registro mais novo (acima na lista). `undefined` = não há. */
	onPrev?: () => void;
	/** Vai para o registro mais antigo (abaixo na lista). `undefined` = não há. */
	onNext?: () => void;
}

/** Campos digitáveis onde as setas do teclado têm outro significado. */
function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.tagName === "TEXTAREA" ||
			target.tagName === "INPUT" ||
			target.tagName === "SELECT")
	);
}

const navButtonStyle: React.CSSProperties = {
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
export function AppLogDetailsModal({
	log,
	onClose,
	surrounding = [],
	onSelectSurrounding,
	position,
	onPrev,
	onNext,
}: AppLogDetailsModalProps) {
	const [copied, setCopied] = useState(false);
	// true = mostra o texto original em vez do JSON indentado
	const [showRawDetails, setShowRawDetails] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const logId = log?.id;

	// Ao trocar de registro (← → ou "ao redor"), volta ao topo do modal:
	// sem isso você ficava vendo o rodapé do registro anterior.
	useEffect(() => {
		contentRef.current?.closest(".modal-body")?.scrollTo({ top: 0 });
	}, [logId]);

	// JSON indentado só é recalculado quando o log muda (pode ser um texto grande).
	const formatted = useMemo(
		() => (log?.detalhes ? formatDetails(log.detalhes) : null),
		[log],
	);

	// ← = mais novo, → = mais antigo (mesma ordem da lista, de cima para baixo).
	useEffect(() => {
		if (!log) return;
		function onKey(e: KeyboardEvent) {
			if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
			if (e.key === "ArrowLeft" && onPrev) {
				e.preventDefault();
				onPrev();
			} else if (e.key === "ArrowRight" && onNext) {
				e.preventDefault();
				onNext();
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [log, onPrev, onNext]);

	// log null == modal fechado -- AppList controla isso via selectedLog.
	if (!log) return null;

	async function handleCopy(current: AppLog) {
		const text = [
			`${normalizeDateToView(current.date)} ${current.time} [${current.tipo}] ${current.programa ?? "Sem programa"} › ${current.classe}`,
			current.message,
			current.detalhes ?? "",
		]
			.filter(Boolean)
			.join("\n\n");
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Sem permissão de área de transferência (ex.: contexto não seguro): sem feedback falso.
			setCopied(false);
		}
	}

	return (
		<Modal isOpen onClose={onClose} title="Detalhes do Log">
			<div
				ref={contentRef}
				style={{ display: "flex", flexDirection: "column", gap: 20 }}
			>
				{position && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: 8,
						}}
					>
						<button
							type="button"
							onClick={onPrev}
							disabled={!onPrev}
							title="Registro mais novo (tecla ←)"
							style={{ ...navButtonStyle, opacity: onPrev ? 1 : 0.4 }}
						>
							← Novo
						</button>
						<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
							{(position.index + 1).toLocaleString("pt-BR")} de{" "}
							{position.total.toLocaleString("pt-BR")}
						</span>
						<button
							type="button"
							onClick={onNext}
							disabled={!onNext}
							title="Registro mais antigo (tecla →)"
							style={{ ...navButtonStyle, opacity: onNext ? 1 : 0.4 }}
						>
							Antigo →
						</button>
					</div>
				)}

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

				<div>
					<button
						type="button"
						onClick={() => void handleCopy(log)}
						style={{
							padding: "5px 12px",
							borderRadius: 999,
							border: "1px solid var(--border)",
							backgroundColor: "transparent",
							color: "var(--foreground)",
							fontSize: 12,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						{copied ? "✓ Copiado" : "Copiar log"}
					</button>
				</div>

				{/* "detalhes" e opcional -- so mostra o textarea quando ha algo pra ver */}
				{log.detalhes && (
					<div>
						<div
							style={{
								...fieldLabelStyle,
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<span>Detalhes{formatted?.isJson ? " · JSON" : ""}</span>
							{formatted?.isJson && (
								<button
									type="button"
									onClick={() => setShowRawDetails((v) => !v)}
									style={{
										...navButtonStyle,
										padding: "2px 10px",
										fontSize: 11,
										textTransform: "none",
										letterSpacing: 0,
									}}
								>
									{showRawDetails ? "Formatar" : "Ver original"}
								</button>
							)}
						</div>
						<textarea
							readOnly
							value={
								formatted?.isJson && !showRawDetails
									? formatted.text
									: log.detalhes
							}
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

				{surrounding.length > 1 && (
					<div>
						<div style={fieldLabelStyle}>
							Ao redor — {log.programa ?? "Sem programa"}
						</div>
						<div
							style={{
								border: "1px solid var(--border)",
								borderRadius: 6,
								overflow: "hidden",
							}}
						>
							{surrounding.map((item) => {
								const isCurrent = item.id === log.id;
								return (
									<button
										key={item.id}
										type="button"
										disabled={isCurrent}
										onClick={() => onSelectSurrounding?.(item)}
										title={item.message}
										style={{
											display: "grid",
											gridTemplateColumns: "auto auto 1fr",
											gap: 10,
											alignItems: "center",
											width: "100%",
											padding: "6px 10px",
											border: "none",
											borderBottom: "1px solid var(--border)",
											backgroundColor: isCurrent
												? "color-mix(in oklch, var(--primary) 14%, transparent)"
												: "transparent",
											color: "var(--foreground)",
											textAlign: "left",
											cursor: isCurrent ? "default" : "pointer",
											fontFamily: "inherit",
										}}
									>
										<span
											style={{
												fontFamily: "monospace",
												fontSize: 11,
												color: "var(--muted-foreground)",
											}}
										>
											{item.date === log.date
												? item.time
												: `${normalizeDateToView(item.date).slice(0, 5)} ${item.time}`}
										</span>
										<AppTypeBadge tipo={item.tipo} />
										<span
											style={{
												fontFamily: "monospace",
												fontSize: 12,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												fontWeight: isCurrent ? 700 : 400,
											}}
										>
											{item.message}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
