// src/features/settings/sourceFormModal.tsx
import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { LogSource } from "../../lib/storage/logPaths";
import type { LogTypeDescriptor } from "../../lib/data/LogMapperRegistry";

interface SourceFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (source: LogSource) => void;
	existingSource: LogSource | null;
	existingAliases: string[];
	/** Vem do LogMapperRegistry.getRegisteredTypes() — não hardcoded aqui */
	availableTypes: LogTypeDescriptor[];
}

const EMPTY_FORM = {
	alias: "",
	url: "",
	logType: "windows-event",
	label: "",
};

export function SourceFormModal({
	isOpen,
	onClose,
	onSave,
	existingSource,
	existingAliases,
	availableTypes,
}: SourceFormModalProps) {
	const isEditing = existingSource !== null;

	const [form, setForm] = useState(EMPTY_FORM);
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
	const [testStatus, setTestStatus] = useState<
		"idle" | "loading" | "ok" | "error" | "warning"
	>("idle");
	const [testError, setTestError] = useState("");

	const firstInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setForm(
				existingSource
					? {
							alias: existingSource.alias,
							url: existingSource.url,
							logType: existingSource.logType,
							label: existingSource.label,
						}
					: {
							...EMPTY_FORM,
							// Seleciona o primeiro tipo disponível como padrão
							logType: availableTypes[0]?.key ?? "windows-event",
						},
			);
			setErrors({});
			setTestStatus("idle");
			setTestError("");
			setTimeout(() => firstInputRef.current?.focus(), 50);
		}
	}, [isOpen, existingSource, availableTypes]);

	function setField(key: string, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }));
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	}

	async function validate(): Promise<boolean> {
		const next: typeof errors = {};

		if (!form.label.trim()) next.label = "Nome de exibição é obrigatório.";

		if (!form.alias.trim()) {
			next.alias = "Alias é obrigatório.";
		} else if (!/^[a-z0-9-]+$/.test(form.alias)) {
			next.alias = "Use apenas letras minúsculas, números e hífens.";
		} else if (existingAliases.includes(form.alias)) {
			next.alias = "Este alias já está em uso.";
		}

		if (!form.url.trim()) {
			next.url = "URL é obrigatória.";
		} else if (
			!form.url.startsWith("/data") &&
			!form.url.startsWith("http://") &&
			!form.url.startsWith("https://")
		) {
			next.url = 'Use "/data" para local ou uma URL completa (http://...).';
		}
		if ((await handleTestConnection()) === "Erro")
			next.url =
				"A URL não passou no teste de conexão. Verifique e tente novamente.";

		setErrors(next);
		return Object.keys(next).length === 0 ? true : false;
	}

	async function handleSubmit() {
		if (!(await validate())) return;
		onSave({ ...form, enabled: existingSource?.enabled ?? true });
	}

	async function handleTestConnection(): Promise<string | void> {
		const raw = form.url?.trim();
		if (!raw) {
			setErrors((prev) => ({ ...prev, url: "Digite a URL antes de testar." }));
			return "Erro";
		}

		let urlToTest: URL;
		try {
			// 1) Caminho absoluto no mesmo host: começa com '/'
			if (raw.startsWith("/")) {
				urlToTest = new URL(raw, window.location.origin);
			} else {
				// 2) Se já tem protocolo, usa direto; se não, assume https
				const candidate = raw.includes("://") ? raw : `https://${raw}`;
				urlToTest = new URL(candidate);
			}
		} catch {
			setErrors((prev) => ({ ...prev, url: "URL inválida." }));
			return "Erro";
		}

		const target = `${urlToTest.origin}${urlToTest.pathname.replace(/\/+$/, "")}/index.json`;

		setTestStatus("loading");
		setTestError("");

		try {
			const res = await fetch(target, { method: "GET" });
			if (!res.ok) {
				setTestStatus("error");
				setTestError(`HTTP ${res.status}: ${res.statusText}`);
				return "Erro";
			}

			const ct = res.headers.get("content-type") || "";
			if (!ct.includes("application/json")) {
				// tenta parsear mesmo assim para detectar HTML de fallback
				try {
					await res.clone().json();
				} catch {
					setTestStatus("error");
					setTestError("Resposta não é JSON (provável fallback para HTML).");
					return "Erro";
				}
				setTestStatus("warning");
				setTestError(
					"Resposta não declarou application/json, mas o corpo foi parseado.",
				);
				return "Warning";
			}

			// parse e validação mínima
			const data = await res.json();
			if (!data || typeof data !== "object") {
				setTestStatus("error");
				setTestError("JSON inválido ou vazio.");
				return "Erro";
			}

			setTestStatus("ok");
		} catch (err) {
			setTestStatus("error");
			setTestError(err instanceof Error ? err.message : "Sem resposta.");
		}
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
			title={isEditing ? "Editar Fonte de Dados" : "Nova Fonte de Dados"}
		>
			<p
				style={{
					fontSize: 13,
					color: "var(--muted-foreground)",
					margin: "0 0 20px",
				}}
			>
				{isEditing
					? "Altere as configurações da fonte selecionada."
					: "Configure uma nova URL de onde o LogDash vai carregar arquivos JSON."}
			</p>

			{/* Nome de exibição */}
			<label style={fieldStyle}>
				Nome de exibição
				<input
					ref={firstInputRef}
					type="text"
					placeholder="Ex: Windows Security 2026"
					value={form.label}
					onChange={(e) => setField("label", e.target.value)}
					style={{
						...inputStyle,
						borderColor: errors.label ? "var(--destructive)" : "var(--border)",
					}}
				/>
				{errors.label && <span style={errorStyle}>{errors.label}</span>}
			</label>

			{/* Alias */}
			<label style={fieldStyle}>
				Alias (identificador único)
				<input
					type="text"
					placeholder="Ex: windows-security"
					value={form.alias}
					onChange={(e) =>
						setField("alias", e.target.value.toLowerCase().replace(/\s/g, "-"))
					}
					disabled={isEditing}
					style={{
						...inputStyle,
						borderColor: errors.alias ? "var(--destructive)" : "var(--border)",
						opacity: isEditing ? 0.6 : 1,
						cursor: isEditing ? "not-allowed" : "text",
					}}
				/>
				{errors.alias && <span style={errorStyle}>{errors.alias}</span>}
				<span style={hintStyle}>
					Apenas letras minúsculas, números e hífens. Não pode ser alterado após
					salvar.
				</span>
			</label>

			{/* URL com botão Testar */}
			<label style={fieldStyle}>
				URL da fonte
				<div style={{ display: "flex", gap: 6, marginTop: 6 }}>
					<input
						type="text"
						placeholder="/data  ou  http://192.168.1.200:9200/data/security"
						value={form.url}
						onChange={(e) => {
							setField("url", e.target.value);
							setTestStatus("idle");
						}}
						style={{
							...inputStyle,
							marginTop: 0,
							flex: 1,
							borderColor: errors.url ? "var(--destructive)" : "var(--border)",
						}}
					/>
					<button
						type="button"
						onClick={handleTestConnection}
						disabled={testStatus === "loading"}
						style={{
							...btnSecondary,
							whiteSpace: "nowrap",
							flexShrink: 0,
							opacity: testStatus === "loading" ? 0.6 : 1,
						}}
					>
						{testStatus === "loading" ? "Testando…" : "Testar"}
					</button>
				</div>
				{testStatus === "ok" && (
					<span style={{ ...hintStyle, color: "var(--primary)", marginTop: 4 }}>
						✓ index.json encontrado — fonte acessível.
					</span>
				)}
				{testStatus === "warning" && (
					<span style={{ ...hintStyle, color: "var(--warning)", marginTop: 4 }}>
						⚠ {testError}
					</span>
				)}
				{testStatus === "error" && (
					<span style={{ ...errorStyle, marginTop: 4 }}>✗ {testError}</span>
				)}
				{errors.url && <span style={errorStyle}>{errors.url}</span>}
				<span style={hintStyle}>
					Use <code>/data</code> para o diretório local ou uma URL completa para
					servidor externo.
				</span>
			</label>

			{/* Tipo de log — alimentado pelo registry */}
			<label style={fieldStyle}>
				Tipo de log
				<select
					value={form.logType}
					onChange={(e) => setField("logType", e.target.value)}
					style={{ ...inputStyle }}
				>
					{availableTypes.map((type) => (
						<option key={type.key} value={type.key}>
							{type.label}
						</option>
					))}
				</select>
				{/* Mostra a descrição do tipo selecionado como dica contextual */}
				{availableTypes.find((t) => t.key === form.logType)?.description && (
					<span style={hintStyle}>
						{availableTypes.find((t) => t.key === form.logType)?.description}
					</span>
				)}
			</label>

			{/* Ações */}
			<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
				<button onClick={handleSubmit} style={btnPrimary}>
					{isEditing ? "Salvar alterações" : "Adicionar fonte"}
				</button>
				<button onClick={onClose} style={btnSecondary}>
					Cancelar
				</button>
			</div>
		</Modal>
	);
}
