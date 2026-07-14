// src/features/settings/settingsPage.tsx
import { useMemo, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";
import { ThemeToggleButton } from "../../components/ThemeButton";
import {
	loadLogSources,
	saveLogSources,
	resetLogSources,
	loadLogTypes,
	saveLogTypes,
} from "../../lib/storage/logPaths";
import type { LogSource } from "../../lib/storage/logPaths";
import { getRegisteredTypes } from "../../lib/data/LogMapperRegistry";
import type { LogTypeDescriptor } from "../../lib/data/LogMapperRegistry";
import { SourceFormModal } from "./sourceFormModal";
import { LogTypeFormModal } from "./logTypeFormModal";
import { loadApiConfig, saveApiConfig } from "../../lib/storage/logPaths";
import type { ApiConfig } from "../../lib/storage/logPaths";
import { getAuthToken } from "../../hooks/useAuth";
import { Toast } from "../../components/Toast";
import type { ToastType } from "../../components/Toast";

export function Settings({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	// ── Fontes ───────────────────────────────────────────────────────────────
	const [sources, setSources] = useState<LogSource[]>(() => loadLogSources());
	const [sourceModalOpen, setSourceModalOpen] = useState(false);
	const [editingSource, setEditingSource] = useState<LogSource | null>(null);
	const [apiConfig, setApiConfig] = useState<ApiConfig>(() => loadApiConfig());

	// Tipos salvos pelo usuário, persistidos no localStorage
	const [customLogTypes, setCustomLogTypes] = useState<string[]>(() =>
		loadLogTypes(),
	);
	const [logTypesModalOpen, setLogTypesModalOpen] = useState(false);
	const [editingLogType, setEditingLogType] = useState<string | null>(null);

	const logTypes = useMemo(() => {
		const typesFromSources = sources
			.filter((s) => s.enabled)
			.map((s) => s.logType);
		return [...new Set([...typesFromSources, ...customLogTypes])];
	}, [sources, customLogTypes]);

	// Tipos disponíveis para o select de fonte — vem do LogMapperRegistry
	// useEffect garante que a lista atualiza quando plugins são adicionados
	const [availableTypes, setAvailableTypes] = useState(getRegisteredTypes);

	const sourceAvailableTypes = [
		...availableTypes,
		...logTypes
			.filter(
				(type) => !availableTypes.some((registered) => registered.key === type),
			)
			.map(
				(key) =>
					({
						key,
						label: key,
						description: "Tipo de log personalizado",
						builtIn: false,
					}) as LogTypeDescriptor,
			),
	];

	function refreshPluginState() {
		setAvailableTypes(getRegisteredTypes());
	}

	// ── Handlers: Fontes ─────────────────────────────────────────────────────

	function updateSources(next: LogSource[]) {
		setSources(next);
		saveLogSources(next);
	}

	function handleToggleSource(alias: string) {
		updateSources(
			sources.map((s) =>
				s.alias === alias ? { ...s, enabled: !s.enabled } : s,
			),
		);
	}

	function handleDeleteSource(alias: string) {
		updateSources(sources.filter((s) => s.alias !== alias));
	}

	function handleSaveSource(source: LogSource) {
		const isEdit = sources.some((s) => s.alias === source.alias);
		updateSources(
			isEdit
				? sources.map((s) => (s.alias === source.alias ? source : s))
				: [...sources, source],
		);
		setSourceModalOpen(false);
		setEditingSource(null);
	}

	function handleSaveApiConfig(config: ApiConfig) {
		setApiConfig(config);
		saveApiConfig(config);
	}

	// ── Handlers: Tipos de Log ───────────────────────────────────────────────

	function handleSaveLogType(
		newLogType: string,
		previousLogType: string | null,
	) {
		setCustomLogTypes((prev) => {
			// Remove o tipo antigo se estava sendo editado
			const withoutPrevious = previousLogType
				? prev.filter((t) => t !== previousLogType)
				: prev;

			// Adiciona o novo tipo (se ainda não existir)
			const next = withoutPrevious.includes(newLogType)
				? withoutPrevious
				: [...withoutPrevious, newLogType];

			saveLogTypes(next);
			return next;
		});

		setLogTypesModalOpen(false);
		setEditingLogType(null);
	}

	function handleDeleteLogType(logType: string) {
		const next = customLogTypes.filter((t) => t !== logType);
		setCustomLogTypes(next);
		saveLogTypes(next);
	}

	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
				currentPage="settings"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					overflowY: "auto",
				}}
			>
				{/* ── Cabeçalho ── */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 32,
						flexWrap: "wrap",
						gap: 12,
					}}
				>
					<div>
						<h1
							style={{
								fontSize: 22,
								fontWeight: 800,
								color: "var(--foreground)",
								margin: 0,
							}}
						>
							Configurações
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							{progress.isLoading
								? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
								: `${logs.length.toLocaleString("pt-BR")} registros · ${sources.filter((s) => s.enabled).length} fonte(s) ativa(s)`}
						</p>
					</div>

					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<ThemeToggleButton />
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							multiple
							style={{ display: "none" }}
							onChange={handleChange}
						/>
						<button onClick={openPicker} style={btnSecondary}>
							+ Carregar Logs
						</button>
						<button onClick={reload} style={btnPrimary}>
							↺ Recarregar
						</button>
					</div>
				</div>

				{/* ── Seção: Fontes de Dados ── */}
				<SettingsSection
					title="Fontes de Dados"
					description={
						<>
							Configure as URLs de onde o LogDash busca os arquivos JSON. Use{" "}
							<code
								style={{
									backgroundColor: "var(--muted)",
									padding: "1px 5px",
									borderRadius: 4,
									fontSize: 12,
								}}
							>
								/data
							</code>{" "}
							para o diretório local ou uma URL completa para servidor externo.
						</>
					}
					actions={
						<>
							<button
								style={btnSecondary}
								onClick={() => setSources(resetLogSources())}
							>
								Restaurar padrão
							</button>
							<button
								style={btnPrimary}
								onClick={() => {
									setEditingSource(null);
									setSourceModalOpen(true);
								}}
							>
								+ Nova Fonte
							</button>
						</>
					}
				>
					<ApiCard
						config={apiConfig}
						onSave={handleSaveApiConfig}
						isMobile={isMobile}
					/>
					{sources.length === 0 ? (
						<EmptyState
							message="Nenhuma fonte configurada."
							actionLabel="Adicionar uma fonte"
							onAction={() => {
								setEditingSource(null);
								setSourceModalOpen(true);
							}}
						/>
					) : (
						sources.map((source) => {
							const typeDescriptor = availableTypes.find(
								(t) => t.key === source.logType,
							);
							return (
								<SourceCard
									key={source.alias}
									source={source}
									typeLabel={typeDescriptor?.label ?? source.logType}
									onToggle={() => handleToggleSource(source.alias)}
									onEdit={() => {
										setEditingSource(source);
										setSourceModalOpen(true);
									}}
									onDelete={() => handleDeleteSource(source.alias)}
									isMobile={isMobile}
								/>
							);
						})
					)}
				</SettingsSection>
				<SettingsSection
					title="Tipos de Logs Registrados"
					description="Lista de tipos de logs atualmente reconhecidos pelo LogDash, com base nas fontes ativas e plugins instalados."
					actions={
						<button
							style={btnPrimary}
							onClick={() => {
								setEditingLogType(null);
								setLogTypesModalOpen(true);
							}}
						>
							+ Novo Tipo Log
						</button>
					}
				>
					{logTypes.length === 0 ? (
						<EmptyState
							message="Nenhum tipo de log registrado."
							actionLabel="Adicionar um tipo de log"
							onAction={() => {
								setEditingLogType(null);
								setLogTypesModalOpen(true);
							}}
						/>
					) : (
						logTypes.map((logType) => (
							<LogTypeCard
								key={logType}
								logType={logType}
								onEdit={() => {
									setEditingLogType(logType);
									setLogTypesModalOpen(true);
								}}
								onDelete={() => handleDeleteLogType(logType)}
							/>
						))
					)}
				</SettingsSection>
			</main>

			{/* ── Modais ── */}
			<SourceFormModal
				isOpen={sourceModalOpen}
				onClose={() => {
					setSourceModalOpen(false);
					setEditingSource(null);
				}}
				onSave={handleSaveSource}
				existingSource={editingSource}
				existingAliases={sources
					.filter((s) => s.alias !== editingSource?.alias)
					.map((s) => s.alias)}
				availableTypes={sourceAvailableTypes}
			/>

			<LogTypeFormModal
				isOpen={logTypesModalOpen}
				onClose={() => {
					setLogTypesModalOpen(false);
					setEditingLogType(null);
				}}
				onSave={handleSaveLogType}
				existingLogType={editingLogType}
				availableTypes={availableTypes}
			/>
		</div>
	);
}

// ── Componentes de layout ─────────────────────────────────────────────────────

interface SettingsSectionProps {
	title: string;
	description: React.ReactNode;
	actions?: React.ReactNode;
	children: React.ReactNode;
}

function SettingsSection({
	title,
	description,
	actions,
	children,
}: SettingsSectionProps) {
	return (
		<section
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				padding: 24,
				marginBottom: 24,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					marginBottom: 16,
					flexWrap: "wrap",
					gap: 12,
				}}
			>
				<div style={{ flex: 1, minWidth: 200 }}>
					<h2
						style={{
							fontSize: 16,
							fontWeight: 700,
							color: "var(--foreground)",
							margin: "0 0 4px",
						}}
					>
						{title}
					</h2>
					<p
						style={{
							fontSize: 13,
							color: "var(--muted-foreground)",
							margin: 0,
							lineHeight: 1.5,
						}}
					>
						{description}
					</p>
				</div>
				{actions && (
					<div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
						{actions}
					</div>
				)}
			</div>
			<div style={{ display: "grid", gap: 10 }}>{children}</div>
		</section>
	);
}

function EmptyState({
	message,
	actionLabel,
	onAction,
}: {
	message: string;
	actionLabel: string;
	onAction: () => void;
}) {
	return (
		<div
			style={{
				textAlign: "center",
				padding: "32px 16px",
				color: "var(--muted-foreground)",
				fontSize: 13,
				border: "1px dashed var(--border)",
				borderRadius: 8,
			}}
		>
			{message}{" "}
			<button
				style={{
					background: "none",
					border: "none",
					color: "var(--primary)",
					cursor: "pointer",
					fontSize: 13,
					textDecoration: "underline",
					padding: 0,
				}}
				onClick={onAction}
			>
				{actionLabel}
			</button>
		</div>
	);
}

// ── SourceCard ────────────────────────────────────────────────────────────────

function SourceCard({
	source,
	typeLabel,
	onToggle,
	onEdit,
	onDelete,
	isMobile,
}: {
	source: LogSource;
	typeLabel: string;
	onToggle: () => void;
	onEdit: () => void;
	onDelete: () => void;
	isMobile: boolean;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 16px",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: source.enabled ? "var(--background)" : "var(--muted)",
				opacity: source.enabled ? 1 : 0.65,
				flexWrap: isMobile ? "wrap" : "nowrap",
				transition: "opacity 0.2s",
			}}
		>
			<button
				onClick={onToggle}
				title={source.enabled ? "Desabilitar" : "Habilitar"}
				style={{
					width: 36,
					height: 20,
					borderRadius: 10,
					border: "none",
					backgroundColor: source.enabled
						? "var(--primary)"
						: "var(--muted-foreground)",
					cursor: "pointer",
					position: "relative",
					flexShrink: 0,
					transition: "background-color 0.2s",
				}}
			>
				<span
					style={{
						position: "absolute",
						top: 2,
						left: source.enabled ? 18 : 2,
						width: 16,
						height: 16,
						borderRadius: "50%",
						backgroundColor: "white",
						transition: "left 0.2s",
					}}
				/>
			</button>

			<div style={{ flex: 1, minWidth: 0 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						flexWrap: "wrap",
					}}
				>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--foreground)",
						}}
					>
						{source.label}
					</span>
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: "var(--primary)",
							backgroundColor:
								"color-mix(in oklch, var(--primary) 12%, transparent)",
							padding: "2px 7px",
							borderRadius: 20,
							textTransform: "uppercase",
							letterSpacing: "0.05em",
							border:
								"1px solid color-mix(in oklch, var(--primary) 25%, transparent)",
						}}
					>
						{typeLabel}
					</span>
				</div>
				<div
					style={{
						fontSize: 12,
						color: "var(--muted-foreground)",
						marginTop: 2,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						fontFamily: "monospace",
					}}
				>
					{source.url}
				</div>
			</div>

			<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
				<button onClick={onEdit} style={btnSecondary}>
					Editar
				</button>
				<button
					onClick={onDelete}
					style={{
						...btnSecondary,
						color: "var(--destructive, oklch(0.6 0.22 25))",
						borderColor: "var(--destructive, oklch(0.6 0.22 25))",
					}}
				>
					Remover
				</button>
			</div>
		</div>
	);
}

// ── LogTypeCard ────────────────────────────────────────────────────────────────

function LogTypeCard({
	logType,
	onEdit,
	onDelete,
}: {
	logType: string;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 16px",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--background)",
				flexWrap: "wrap",
			}}
		>
			<div style={{ flex: 1, minWidth: 0 }}>
				<span
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: "var(--foreground)",
					}}
				>
					{logType}
				</span>
			</div>
			<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
				<button onClick={onEdit} style={btnSecondary}>
					Editar
				</button>
				<button
					onClick={onDelete}
					style={{
						...btnSecondary,
						color: "var(--destructive, oklch(0.6 0.22 25))",
						borderColor: "var(--destructive, oklch(0.6 0.22 25))",
					}}
				>
					Remover
				</button>
			</div>
		</div>
	);
}

// ── ApiCard ────────────────────────────────────────────────────────────────
interface ApiCardProps {
	config: ApiConfig;
	onSave: (config: ApiConfig) => void;
	isMobile: boolean;
}

type TestResult = {
	host: string;
	status: "ok" | "error" | null;
};

type Testing = {
	host: string;
	testing: boolean;
};

type IngestSucesso = {
	status: string;
	ERRO?: string;
};

type IngestErro = {
	ERRO: string;
	status?: string;
};

export type IngestResult = IngestSucesso | IngestErro;

function ApiCard({ config, onSave, isMobile }: ApiCardProps) {
	const [api, setApi] = useState(config.api);

	const [url, setUrl] = useState<string>("");
	const [urls, setUrls] = useState<string[]>(config.urls);

	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [ToastType, setToastType] = useState<ToastType>();

	// Testing
	const [testResult, setTestResult] = useState<TestResult>({
		host: "",
		status: null,
	});
	const [testing, setTesting] = useState<Testing>({ host: "", testing: false });

	function handleToggleUrlApi() {
		onSave({ ...config, enabled: !config.enabled });
	}

	function handleSaveUrlApi() {
		onSave({ ...config, api });
	}

	function checkerValidUrl(s: string): boolean {
		if (s.length === 0) {
			setToastMessage("Informe uma URL.");
			return false;
		}

		if (urls.includes(s)) {
			setToastMessage("Essa URL já foi adicionada.");
			return false;
		}

		if (testResult.host !== s || testResult.status !== "ok") {
			setToastMessage("Teste a URL antes de adicioná-la.");
			return false;
		}

		return true;
	}

	function handleSaveUrls() {
		if (!checkerValidUrl(url)) {
			setToastType("error");
			return;
		}

		const newUrls = [...urls, url];

		setUrls(newUrls);

		onSave({
			...config,
			urls: newUrls,
		});

		setUrl("");
	}

	function handleDeleteUrls(index: number) {
		const newUrls = urls.filter((_, i) => i !== index);
		setUrls(newUrls);

		onSave({
			...config,
			urls: newUrls,
		});
	}

	async function handleTestConnectionUrlApi() {
		setTesting({ host: api, testing: true });
		setTestResult({ host: api, status: null });
		try {
			const res = await fetch(`${api}/api/health`);
			setTestResult({ host: api, status: res.ok ? "ok" : "error" });
		} catch (err) {
			setTestResult({ host: api, status: "error" });
			console.error(
				"[ApiCard/TestConnectionUrlApi] Erro ao testar conexão URL: ",
				err,
			);
		} finally {
			setTesting({ host: api, testing: false });
		}
	}

	async function handleTestConnectionUrls() {
		setTesting({ host: url, testing: true });
		setTestResult({ host: url, status: null });
		try {
			const res = await fetch(`${api}/api/test_conn/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${getAuthToken()}`,
				},
				body: JSON.stringify({ url }),
			});
			setTestResult({ host: url, status: res.ok ? "ok" : "error" });
		} catch (err) {
			setTestResult({ host: url, status: "error" });
			console.error(
				"[ApiCard/TestConnectionUrls] Erro ao testar conexão URL: ",
				err,
			);
		} finally {
			setTesting({ host: url, testing: false });
		}
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 10,
				padding: "12px 16px",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: config.enabled ? "var(--background)" : "var(--muted)",
				opacity: config.enabled ? 1 : 0.65,
				transition: "opacity 0.2s",
			}}
		>
			{/* URL API */}
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{/* Linha superior: toggle + label */}
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<button
						onClick={handleToggleUrlApi}
						title={config.enabled ? "Desabilitar" : "Habilitar"}
						style={{
							width: 36,
							height: 20,
							borderRadius: 10,
							border: "none",
							backgroundColor: config.enabled
								? "var(--primary)"
								: "var(--muted-foreground)",
							cursor: "pointer",
							position: "relative",
							flexShrink: 0,
							transition: "background-color 0.2s",
						}}
					>
						<span
							style={{
								position: "absolute",
								top: 2,
								left: config.enabled ? 18 : 2,
								width: 16,
								height: 16,
								borderRadius: "50%",
								backgroundColor: "white",
								transition: "left 0.2s",
							}}
						/>
					</button>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--foreground)",
						}}
					>
						Flask API
					</span>
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: "var(--primary)",
							backgroundColor:
								"color-mix(in oklch, var(--primary) 12%, transparent)",
							padding: "2px 7px",
							borderRadius: 20,
							textTransform: "uppercase",
							letterSpacing: "0.05em",
							border:
								"1px solid color-mix(in oklch, var(--primary) 25%, transparent)",
						}}
					>
						api
					</span>
				</div>

				{/* Linha inferior: input URL + botões */}
				<div
					style={{
						display: "flex",
						gap: 8,
						flexWrap: isMobile ? "wrap" : "nowrap",
						alignItems: "center",
					}}
				>
					<input
						value={api}
						onChange={(e) => setApi(e.target.value)}
						style={{
							flex: 1,
							fontFamily: "monospace",
							fontSize: 12,
							padding: "6px 10px",
							borderRadius: 6,
							border: "1px solid var(--border)",
							backgroundColor: "var(--background)",
							color: "var(--foreground)",
						}}
					/>
					<button onClick={handleSaveUrlApi} style={btnPrimary}>
						Salvar
					</button>
					<button
						onClick={handleTestConnectionUrlApi}
						style={btnSecondary}
						disabled={testing.testing}
					>
						{testResult.host === api && testing.testing
							? "Testando…"
							: "Testar"}
					</button>
					{testResult.host === api && (
						<span
							style={{
								fontSize: 12,
								color:
									testResult.status === "ok"
										? "oklch(0.6 0.2 145)"
										: "var(--destructive, oklch(0.6 0.22 25))",
							}}
						>
							{testing.testing === false
								? testResult.status === "ok"
									? "✓ Conexão estável"
									: "✗ Falhou"
								: ""}
						</span>
					)}
				</div>
			</div>

			{/* LISTA URL */}
			<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
				{/* Linha superior: toggle + label */}
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--foreground)",
						}}
					>
						Lista URLs
					</span>
					<span
						style={{
							fontSize: 10,
							fontWeight: 700,
							color: "var(--primary)",
							backgroundColor:
								"color-mix(in oklch, var(--primary) 12%, transparent)",
							padding: "2px 7px",
							borderRadius: 20,
							textTransform: "uppercase",
							letterSpacing: "0.05em",
							border:
								"1px solid color-mix(in oklch, var(--primary) 25%, transparent)",
						}}
					>
						api
					</span>
				</div>

				{/* Linha do meio: Lista de URLs */}
				<div
					style={{
						width: "100%",
						overflowX: "auto",
					}}
				>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
						}}
					>
						<tbody>
							{urls.map((url, index) => (
								<tr key={index}>
									<td
										style={{
											display: "flex",
											gap: 6,
											padding: "10px",
											border: "1px solid var(--border)",
										}}
									>
										<input
											value={url}
											readOnly
											style={{
												width: "100%",
												fontFamily: "monospace",
												fontSize: 12,
												padding: "6px 10px",
												borderRadius: 6,
												border: "1px solid var(--border)",
												backgroundColor: "var(--background)",
												color: "var(--foreground)",
												boxSizing: "border-box",
											}}
										/>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											height="24px"
											viewBox="0 -960 960 960"
											width="24px"
											fill="#e3e3e3"
											style={{ cursor: "pointer" }}
											onClick={() => handleDeleteUrls(index)}
										>
											<path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
										</svg>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Linha inferior: input URL + botões */}
				<div
					style={{
						display: "flex",
						gap: 8,
						flexWrap: isMobile ? "wrap" : "nowrap",
						alignItems: "center",
					}}
				>
					<input
						onChange={(e) => setUrl(e.target.value)}
						style={{
							flex: 1,
							fontFamily: "monospace",
							fontSize: 12,
							padding: "6px 10px",
							borderRadius: 6,
							border: "1px solid var(--border)",
							backgroundColor: "var(--background)",
							color: "var(--foreground)",
						}}
						placeholder="Caso queira adicionar uma url para mandar ping"
					/>
					<button onClick={handleSaveUrls} style={btnPrimary}>
						Salvar
					</button>
					<button
						onClick={handleTestConnectionUrls}
						style={btnSecondary}
						disabled={testing.testing}
					>
						{testResult.host === url && testing.testing
							? "Testando…"
							: "Testar"}
					</button>
					{testResult.host === url && (
						<span
							style={{
								fontSize: 12,
								color:
									testResult.status === "ok"
										? "oklch(0.6 0.2 145)"
										: "var(--destructive, oklch(0.6 0.22 25))",
							}}
						>
							{testing.testing === false
								? testResult.status === "ok"
									? "✓ Conexão estável"
									: "✗ Falhou"
								: ""}
						</span>
					)}
				</div>
			</div>
			<Toast
				message={toastMessage}
				type={ToastType}
				onDismiss={() => setToastMessage(null)}
			/>
		</div>
	);
}
