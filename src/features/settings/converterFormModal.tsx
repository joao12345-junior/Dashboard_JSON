// src/features/settings/converterFormModal.tsx
import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { IConverterPlugin } from "../../lib/plugins/IConverterPlugin";

interface ConverterFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (plugin: IConverterPlugin) => void;
	existingPlugin: IConverterPlugin | null;
	existingIds: string[];
}

const EMPTY_FORM = {
	id: "",
	name: "",
	description: "",
	inputExtensions: "", // campo de texto livre — "," separa múltiplas extensões
	serverCommand: "",
	version: "1.0",
	outputLogType: "",
};

/**
 * Modal para registrar ou visualizar um plugin de conversor.
 *
 * ─── Modos de operação ───────────────────────────────────────────────────────
 * 1. Criação   (existingPlugin = null, !builtIn)  → formulário editável
 * 2. Edição    (existingPlugin != null, !builtIn) → formulário editável
 * 3. Somente-leitura (existingPlugin.builtIn)     → campos desabilitados
 *
 * Plugins adicionados via UI têm mapper = null.
 * Isso significa que o sistema vai usar o mapper padrão do outputLogType
 * registrado no LogMapperRegistry — o usuário não pode injetar código
 * TypeScript pela interface gráfica.
 */
export function ConverterFormModal({
	isOpen,
	onClose,
	onSave,
	existingPlugin,
	existingIds,
}: ConverterFormModalProps) {
	const isEditing = existingPlugin !== null;
	const isReadOnly = existingPlugin?.builtIn ?? false;

	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

	const firstInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		setErrors({});
		if (existingPlugin) {
			setForm({
				id: existingPlugin.id,
				name: existingPlugin.name,
				description: existingPlugin.description,
				inputExtensions: existingPlugin.inputExtensions.join(", "),
				serverCommand: existingPlugin.serverCommand,
				version: existingPlugin.version,
				outputLogType: existingPlugin.outputLogType,
			});
		} else {
			setForm(EMPTY_FORM);
		}

		if (!isReadOnly) {
			setTimeout(() => firstInputRef.current?.focus(), 50);
		}
	}, [isOpen, existingPlugin, isReadOnly]);

	function setField(key: string, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	}

	function validate(): boolean {
		const next: typeof errors = {};

		if (!form.name.trim()) next.name = "Nome é obrigatório.";

		if (!form.id.trim()) {
			next.id = "ID é obrigatório.";
		} else if (!/^[a-z0-9-]+$/.test(form.id)) {
			next.id = "Use apenas letras minúsculas, números e hífens.";
		} else if (existingIds.includes(form.id)) {
			next.id = "Este ID já está em uso.";
		}

		const extensions = form.inputExtensions
			.split(",")
			.map((e) => e.trim())
			.filter(Boolean);

		if (extensions.length === 0) {
			next.inputExtensions = "Informe ao menos uma extensão.";
		} else if (extensions.some((e) => !e.startsWith("."))) {
			next.inputExtensions =
				'Cada extensão deve começar com "." (ex: .log, .txt).';
		}

		if (!form.serverCommand.trim())
			next.serverCommand = "Comando é obrigatório.";
		if (!form.outputLogType.trim())
			next.outputLogType = "Tipo de saída é obrigatório.";
		if (!form.version.trim()) next.version = "Versão é obrigatória.";

		setErrors(next);
		return Object.keys(next).length === 0;
	}

	function handleSubmit() {
		if (isReadOnly || !validate()) return;

		const extensions = form.inputExtensions
			.split(",")
			.map((e) => e.trim())
			.filter(Boolean);

		const plugin: IConverterPlugin = {
			id: form.id,
			name: form.name,
			description: form.description,
			inputExtensions: extensions,
			serverCommand: form.serverCommand,
			version: form.version,
			outputLogType: form.outputLogType,
			builtIn: false,
			// Plugins criados via UI não injetam código TypeScript
			mapper: null,
		};

		onSave(plugin);
	}

	const inputStyle: React.CSSProperties = {
		display: "block",
		width: "100%",
		padding: "8px 10px",
		borderRadius: 6,
		border: "1px solid var(--border)",
		backgroundColor: isReadOnly
			? "var(--muted)"
			: "var(--input, var(--background))",
		color: "var(--foreground)",
		fontSize: 13,
		fontFamily: "inherit",
		boxSizing: "border-box",
		marginTop: 6,
		cursor: isReadOnly ? "not-allowed" : "text",
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

	const title = isReadOnly
		? "Detalhes do Conversor"
		: isEditing
			? "Editar Conversor"
			: "Novo Conversor";

	return (
		<Modal isOpen={isOpen} onClose={onClose} title={title}>
			{isReadOnly ? (
				<div
					style={{
						padding: "8px 12px",
						borderRadius: 6,
						backgroundColor:
							"color-mix(in oklch, var(--primary) 10%, transparent)",
						border:
							"1px solid color-mix(in oklch, var(--primary) 25%, transparent)",
						fontSize: 12,
						color: "var(--muted-foreground)",
						marginBottom: 20,
					}}
				>
					Conversor built-in — somente leitura.
				</div>
			) : (
				<p
					style={{
						fontSize: 13,
						color: "var(--muted-foreground)",
						margin: "0 0 20px",
					}}
				>
					{isEditing
						? "Altere os metadados do conversor."
						: "Registre um conversor externo. O script precisa estar no servidor — aqui você cadastra os metadados para referência."}
				</p>
			)}

			{/* Nome */}
			<label style={fieldStyle}>
				Nome
				<input
					ref={firstInputRef}
					type="text"
					placeholder="Ex: Syslog RFC 5424"
					value={form.name}
					onChange={(e) => setField("name", e.target.value)}
					readOnly={isReadOnly}
					style={{
						...inputStyle,
						borderColor: errors.name ? "var(--destructive)" : "var(--border)",
					}}
				/>
				{errors.name && <span style={errorStyle}>{errors.name}</span>}
			</label>

			{/* ID */}
			<label style={fieldStyle}>
				ID único
				<input
					type="text"
					placeholder="Ex: syslog-rfc5424"
					value={form.id}
					onChange={(e) =>
						setField("id", e.target.value.toLowerCase().replace(/\s/g, "-"))
					}
					readOnly={isReadOnly || isEditing}
					style={{
						...inputStyle,
						borderColor: errors.id ? "var(--destructive)" : "var(--border)",
						opacity: isEditing || isReadOnly ? 0.6 : 1,
						cursor: isEditing || isReadOnly ? "not-allowed" : "text",
					}}
				/>
				{errors.id && <span style={errorStyle}>{errors.id}</span>}
				{!isReadOnly && (
					<span style={hintStyle}>Não pode ser alterado após salvar.</span>
				)}
			</label>

			{/* Descrição */}
			<label style={fieldStyle}>
				Descrição
				<textarea
					placeholder="Descreva o formato e o que o conversor faz."
					value={form.description}
					onChange={(e) => setField("description", e.target.value)}
					readOnly={isReadOnly}
					rows={3}
					style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
				/>
			</label>

			{/* Extensões */}
			<label style={fieldStyle}>
				Extensões de entrada
				<input
					type="text"
					placeholder=".log, .txt"
					value={form.inputExtensions}
					onChange={(e) => setField("inputExtensions", e.target.value)}
					readOnly={isReadOnly}
					style={{
						...inputStyle,
						borderColor: errors.inputExtensions
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				{errors.inputExtensions && (
					<span style={errorStyle}>{errors.inputExtensions}</span>
				)}
				<span style={hintStyle}>
					Separe com vírgula para múltiplas extensões. Ex: .log, .txt
				</span>
			</label>

			{/* Tipo de saída */}
			<label style={fieldStyle}>
				Tipo de log gerado (outputLogType)
				<input
					type="text"
					placeholder="Ex: syslog"
					value={form.outputLogType}
					onChange={(e) =>
						setField(
							"outputLogType",
							e.target.value.toLowerCase().replace(/\s/g, "-"),
						)
					}
					readOnly={isReadOnly}
					style={{
						...inputStyle,
						borderColor: errors.outputLogType
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				{errors.outputLogType && (
					<span style={errorStyle}>{errors.outputLogType}</span>
				)}
				<span style={hintStyle}>
					Deve corresponder a um tipo registrado no LogMapperRegistry. Para
					novos formatos, o mapper TypeScript precisa ser criado por um
					desenvolvedor.
				</span>
			</label>

			{/* Comando */}
			<label style={fieldStyle}>
				Comando no servidor
				<input
					type="text"
					placeholder="python syslog_converter.py"
					value={form.serverCommand}
					onChange={(e) => setField("serverCommand", e.target.value)}
					readOnly={isReadOnly}
					style={{
						...inputStyle,
						fontFamily: "monospace",
						borderColor: errors.serverCommand
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				{errors.serverCommand && (
					<span style={errorStyle}>{errors.serverCommand}</span>
				)}
				<span style={hintStyle}>
					Apenas informativo — o LogDash não executa scripts diretamente.
				</span>
			</label>

			{/* Versão */}
			<label style={fieldStyle}>
				Versão
				<input
					type="text"
					placeholder="1.0"
					value={form.version}
					onChange={(e) => setField("version", e.target.value)}
					readOnly={isReadOnly}
					style={{
						...inputStyle,
						borderColor: errors.version
							? "var(--destructive)"
							: "var(--border)",
					}}
				/>
				{errors.version && <span style={errorStyle}>{errors.version}</span>}
			</label>

			<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
				{!isReadOnly && (
					<button onClick={handleSubmit} style={btnPrimary}>
						{isEditing ? "Salvar alterações" : "Registrar conversor"}
					</button>
				)}
				<button onClick={onClose} style={btnSecondary}>
					{isReadOnly ? "Fechar" : "Cancelar"}
				</button>
			</div>
		</Modal>
	);
}
