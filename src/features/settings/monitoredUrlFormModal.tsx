// src/features/settings/monitoredUrlFormModal.tsx
import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";

export interface MonitoredUrlFormValues {
	id?: number;
	label: string;
	url: string;
	timeout_seconds: number;
	has_sentry: boolean;
}

interface MonitoredUrlFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (values: MonitoredUrlFormValues) => void;
	existing: MonitoredUrlFormValues | null;
}

const EMPTY_FORM: MonitoredUrlFormValues = {
	label: "",
	url: "",
	timeout_seconds: 10,
	has_sentry: false,
};

export function MonitoredUrlFormModal({
	isOpen,
	onClose,
	onSave,
	existing,
}: MonitoredUrlFormModalProps) {
	const isEditing = existing !== null;
	const [form, setForm] = useState<MonitoredUrlFormValues>(EMPTY_FORM);
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
	const firstInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setForm(existing ?? EMPTY_FORM);
			setErrors({});
			setTimeout(() => firstInputRef.current?.focus(), 50);
		}
	}, [isOpen, existing]);

	function setField<K extends keyof MonitoredUrlFormValues>(
		key: K,
		value: MonitoredUrlFormValues[K],
	) {
		setForm((prev) => ({ ...prev, [key]: value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	}

	function validate(): boolean {
		const next: Partial<Record<string, string>> = {};
		if (!form.label.trim()) next.label = "Nome é obrigatório.";
		if (!form.url.trim()) {
			next.url = "URL é obrigatória.";
		} else if (
			!form.url.startsWith("http://") &&
			!form.url.startsWith("https://")
		) {
			next.url = "URL deve começar com http:// ou https://.";
		}
		if (!Number.isInteger(form.timeout_seconds) || form.timeout_seconds <= 0) {
			next.timeout_seconds =
				"Timeout deve ser um número inteiro maior que zero.";
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	}

	function handleSubmit() {
		if (!validate()) return;
		onSave(form);
	}

	const inputStyle: React.CSSProperties = {
		display: "block",
		width: "100%",
		padding: "8px 10px",
		borderRadius: 6,
		border: "1px solid var(--border)",
		backgroundColor: "var(--input, var(--background))",
		color: "var(--foreground)",
		fontSize: 13,
		fontFamily: "inherit",
		boxSizing: "border-box",
		marginTop: 6,
	};

	const errorStyle: React.CSSProperties = {
		fontSize: 11,
		color: "var(--destructive, oklch(0.6 0.22 25))",
		marginTop: 4,
		display: "block",
	};

	const fieldStyle: React.CSSProperties = {
		display: "block",
		fontSize: 13,
		fontWeight: 600,
		color: "var(--foreground)",
		marginBottom: 14,
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={isEditing ? "Editar Site Monitorado" : "Novo Site Monitorado"}
		>
			<label style={fieldStyle}>
				Nome de exibição
				<input
					ref={firstInputRef}
					type="text"
					placeholder="Ex: Atendimento Bot"
					value={form.label}
					onChange={(e) => setField("label", e.target.value)}
					style={{
						...inputStyle,
						borderColor: errors.label ? "var(--destructive)" : "var(--border)",
					}}
				/>
				{errors.label && <span style={errorStyle}>{errors.label}</span>}
			</label>

			<label style={fieldStyle}>
				URL
				<input
					type="text"
					placeholder="https://exemplo.com/health"
					value={form.url}
					onChange={(e) => setField("url", e.target.value)}
					style={{
						...inputStyle,
						borderColor: errors.url ? "var(--destructive)" : "var(--border)",
					}}
				/>
				{errors.url && <span style={errorStyle}>{errors.url}</span>}
			</label>

			<label style={fieldStyle}>
				Timeout (segundos)
				<input
					type="number"
					min={1}
					value={form.timeout_seconds}
					onChange={(e) => setField("timeout_seconds", Number(e.target.value))}
					style={{
						...inputStyle,
						borderColor: errors.timeout_seconds
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				{errors.timeout_seconds && (
					<span style={errorStyle}>{errors.timeout_seconds}</span>
				)}
			</label>

			<label
				style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 8 }}
			>
				<input
					type="checkbox"
					checked={form.has_sentry}
					onChange={(e) => setField("has_sentry", e.target.checked)}
				/>
				Tem integração com Sentry
			</label>

			<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
				<button onClick={handleSubmit} style={btnPrimary}>
					{isEditing ? "Salvar alterações" : "Adicionar site"}
				</button>
				<button onClick={onClose} style={btnSecondary}>
					Cancelar
				</button>
			</div>
		</Modal>
	);
}
