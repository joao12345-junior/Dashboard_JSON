// src/features/settings/ProgramsList.tsx
import { useState } from "react";
import { Modal } from "../../components/Modal";
import { btnSecondary } from "../../lib/styles/buttonStyles";
import type { ToastType } from "../../components/Toast";
import type {
	ClassifiedProgram,
	ProgramStatus,
	ProgramVisibility,
} from "../app-logs/programRegistry";
import { INACTIVE_AFTER_DAYS } from "../app-logs/programRegistry";

interface ProgramsListProps {
	programs: ClassifiedProgram[];
	loading: boolean;
	error: string | null;
	isMobile: boolean;
	onChangeVisibility: (programa: string, visibility: ProgramVisibility) => Promise<void>;
	/** Devolve quantos logs foram apagados. */
	onDeleteLogs: (programa: string) => Promise<number>;
	onToast: (message: string, type: ToastType) => void;
}

const VISIBILITY_OPTIONS: { value: ProgramVisibility; label: string }[] = [
	{ value: "auto", label: `Automático (oculta após ${INACTIVE_AFTER_DAYS} dias)` },
	{ value: "shown", label: "Sempre visível" },
	{ value: "hidden", label: "Oculto" },
];

const STATUS_CHIP: Record<ProgramStatus, { label: string; color: string }> = {
	active: { label: "Ativo", color: "var(--foreground)" },
	inactive: { label: "Inativo", color: "var(--warning-text)" },
	hidden: { label: "Oculto", color: "var(--destructive-text)" },
};

/** "há 3 h" / "há 6 d" a partir de dias de silêncio (sem ler o relógio no render). */
function formatSilence(daysSilent: number | null): string {
	if (daysSilent === null) return "sem logs registrados";
	if (daysSilent < 1 / 24) return "há menos de 1 h";
	if (daysSilent < 1) return `há ${Math.floor(daysSilent * 24)} h`;
	return `há ${Math.floor(daysSilent)} d`;
}

function formatCount(n: number): string {
	return n.toLocaleString("pt-BR");
}

/// <summary>
/// Lista de todos os programas dos Logs Gerais com a escolha de visibilidade
/// e o botão de apagar logs. A regra "ativo/inativo/oculto" vem pronta de
/// `classifyPrograms`; aqui é só apresentação e confirmação.
/// </summary>
export function ProgramsList({
	programs,
	loading,
	error,
	isMobile,
	onChangeVisibility,
	onDeleteLogs,
	onToast,
}: ProgramsListProps) {
	const [busy, setBusy] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<ClassifiedProgram | null>(null);

	if (loading) return <Message text="Carregando programas…" />;
	if (error && programs.length === 0) return <Message text={error} tone="error" />;
	if (programs.length === 0) {
		return (
			<Message text="Nenhum programa registrado ainda. Eles aparecem aqui assim que enviarem o primeiro log geral." />
		);
	}

	const inactive = programs.filter((p) => p.status === "inactive").length;
	const hidden = programs.filter((p) => p.status === "hidden").length;

	async function handleChange(programa: string, visibility: ProgramVisibility) {
		setBusy(programa);
		try {
			await onChangeVisibility(programa, visibility);
		} catch (err) {
			onToast(err instanceof Error ? err.message : "Erro ao salvar", "error");
		} finally {
			setBusy(null);
		}
	}

	async function handleConfirmDelete() {
		if (!toDelete) return;
		const { programa } = toDelete;
		setBusy(programa);
		try {
			const deleted = await onDeleteLogs(programa);
			onToast(
				deleted > 0
					? `${formatCount(deleted)} logs de ${programa} apagados.`
					: `${programa} removido da lista.`,
				"message",
			);
			setToDelete(null);
		} catch (err) {
			onToast(err instanceof Error ? err.message : "Erro ao apagar", "error");
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
				{programs.length} programa{programs.length === 1 ? "" : "s"}
				{inactive > 0 && ` · ${inactive} inativo${inactive === 1 ? "" : "s"}`}
				{hidden > 0 && ` · ${hidden} oculto${hidden === 1 ? "" : "s"}`}
			</div>

			{programs.map((p) => {
				const chip =
					p.visibility === "shown"
						? { label: "Sempre visível", color: "var(--primary)" }
						: STATUS_CHIP[p.status];
				const isBusy = busy === p.programa;
				return (
					<div
						key={p.programa}
						style={{
							display: "flex",
							flexDirection: isMobile ? "column" : "row",
							alignItems: isMobile ? "stretch" : "center",
							gap: 12,
							padding: "12px 14px",
							border: "1px solid var(--border)",
							borderLeft: `3px solid ${chip.color}`,
							borderRadius: 8,
							backgroundColor: "var(--background)",
							opacity: p.status === "active" ? 1 : 0.9,
						}}
					>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
								<span
									style={{
										fontSize: 14,
										fontWeight: 700,
										color: "var(--foreground)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										maxWidth: "100%",
									}}
									title={p.programa}
								>
									{p.programa}
								</span>
								<span
									style={{
										fontSize: 11,
										fontWeight: 600,
										padding: "1px 8px",
										borderRadius: 999,
										border: `1px solid ${chip.color}`,
										color: chip.color,
									}}
								>
									{chip.label}
								</span>
							</div>
							<div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
								Último log {formatSilence(p.daysSilent)} · {formatCount(p.log_count)} logs no banco
								{p.logs_24h > 0 && ` · ${formatCount(p.logs_24h)} nas últimas 24 h`}
							</div>
							{p.status === "hidden" && p.logs_24h > 0 && (
								<div style={{ fontSize: 12, color: "var(--warning-text)", marginTop: 2 }}>
									Oculto, mas está recebendo logs — eles não aparecem nas telas.
								</div>
							)}
							{p.status === "inactive" && (
								<div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
									Fora das telas até voltar a logar. Para ver os logs antigos, escolha
									“Sempre visível”.
								</div>
							)}
						</div>

						<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
							<select
								className="ld-control"
								aria-label={`Visibilidade de ${p.programa}`}
								value={p.visibility}
								disabled={isBusy}
								onChange={(e) => void handleChange(p.programa, e.target.value as ProgramVisibility)}
								style={{
									padding: "7px 10px",
									borderRadius: 8,
									border: "1px solid var(--border)",
									backgroundColor: "var(--card)",
									color: "var(--foreground)",
									fontSize: 13,
									fontFamily: "inherit",
									maxWidth: "100%",
								}}
							>
								{VISIBILITY_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
							<button
								type="button"
								disabled={isBusy}
								onClick={() => setToDelete(p)}
								aria-label={`Apagar logs de ${p.programa}`}
								style={{
									...btnSecondary,
									padding: "7px 12px",
									color: "var(--destructive-text)",
									borderColor: "var(--destructive)",
								}}
							>
								{p.log_count > 0 ? "Apagar logs" : "Remover"}
							</button>
						</div>
					</div>
				);
			})}

			<Modal
				isOpen={toDelete !== null}
				onClose={() => (busy ? undefined : setToDelete(null))}
				title={toDelete ? `Apagar logs de ${toDelete.programa}?` : ""}
			>
				{toDelete && (
					<div style={{ display: "grid", gap: 16 }}>
						<p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.6 }}>
							{toDelete.log_count > 0
								? `Serão apagados ${formatCount(toDelete.log_count)} logs deste programa do banco. Isso não pode ser desfeito.`
								: "Este programa não tem mais logs no banco. Ele será removido da lista."}
						</p>
						<p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
							Se o programa voltar a enviar logs, ele reaparece na lista como automático.
						</p>
						<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
							<button
								type="button"
								style={btnSecondary}
								disabled={busy !== null}
								onClick={() => setToDelete(null)}
							>
								Cancelar
							</button>
							<button
								type="button"
								disabled={busy !== null}
								onClick={() => void handleConfirmDelete()}
								style={{
									...btnSecondary,
									backgroundColor: "var(--destructive)",
									color: "var(--destructive-foreground)",
									borderColor: "var(--destructive)",
								}}
							>
								{busy ? "Apagando…" : toDelete.log_count > 0 ? "Apagar logs" : "Remover"}
							</button>
						</div>
					</div>
				)}
			</Modal>
		</>
	);
}

function Message({ text, tone }: { text: string; tone?: "error" }) {
	return (
		<div
			style={{
				fontSize: 13,
				color: tone === "error" ? "var(--destructive-text)" : "var(--muted-foreground)",
				padding: "8px 0",
			}}
		>
			{text}
		</div>
	);
}
