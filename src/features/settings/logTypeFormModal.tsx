// src/features/settings/logTypeFormModal.tsx
import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { LogTypeDescriptor } from "../../lib/data/LogMapperRegistry";

interface LogTypeFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (logType: string) => void;
	existingLogType: string | null;
	availableTypes: LogTypeDescriptor[];
}

const DEFAULT_LOG_TYPE = "windows-event";

export function LogTypeFormModal({
	isOpen,
	onClose,
	onSave,
	existingLogType,
	availableTypes,
}: LogTypeFormModalProps) {
	const isEditing = existingLogType !== null;
	const [logType, setLogType] = useState(
		existingLogType ?? availableTypes[0]?.key ?? DEFAULT_LOG_TYPE,
	);
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
	const firstInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setLogType(existingLogType ?? availableTypes[0]?.key ?? DEFAULT_LOG_TYPE);
			setErrors({});
			setTimeout(() => firstInputRef.current?.focus(), 50);
		}
	}, [isOpen, existingLogType, availableTypes]);

	function validate(): boolean {
		if (!logType) {
			setErrors({ logType: "Selecione um tipo de log." });
			return false;
		}
		return true;
	}

	function handleSubmit() {
		if (!validate()) return;
		onSave(logType);
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

	const hintStyle: React.CSSProperties = {
		fontSize: 11,
		color: "var(--muted-foreground)",
		marginTop: 3,
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
			title={isEditing ? "Editar Tipo de Log" : "Novo Tipo de Log"}
		>
			<p
				style={{
					fontSize: 13,
					color: "var(--muted-foreground)",
					margin: "0 0 20px",
				}}
			>
				{isEditing
					? "Altere o tipo de log registrado."
					: "Selecione um tipo de log para registrar no LogDash."}
			</p>

			<label style={fieldStyle}>
				Tipo de log
				<input
					ref={firstInputRef}
					list="log-types"
					value={logType}
					onChange={(e) => {
						setLogType(e.target.value);
						setErrors({});
					}}
					style={{
						...inputStyle,
						borderColor: errors.logType
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				<datalist id="log-types">
					{availableTypes.map((type) => (
						<option key={type.key} value={type.key}>
							{type.label}
						</option>
					))}
				</datalist>
				{errors.logType && <span style={errorStyle}>{errors.logType}</span>}
				{availableTypes.find((t) => t.key === logType)?.description && (
					<span style={hintStyle}>
						{availableTypes.find((t) => t.key === logType)?.description}
					</span>
				)}
			</label>

			<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
				<button onClick={handleSubmit} style={btnPrimary}>
					{isEditing ? "Salvar alterações" : "Adicionar tipo"}
				</button>
				<button onClick={onClose} style={btnSecondary}>
					Cancelar
				</button>
			</div>
		</Modal>
	);
}
