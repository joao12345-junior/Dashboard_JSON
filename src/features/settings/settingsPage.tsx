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
import {
	getAllPlugins,
	registerPlugin,
	unregisterPlugin,
} from "../../lib/plugins/converterRegistry";
import type { IConverterPlugin } from "../../lib/plugins/IConverterPlugin";
import { SourceFormModal } from "./sourceFormModal";
import { ConverterFormModal } from "./converterFormModal";
import { LogTypeFormModal } from "./logTypeFormModal";

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

	// ── Plugins/Conversores ──────────────────────────────────────────────────
	// Estado derivado do ConverterRegistry — re-sincroniza após operações
	const [plugins, setPlugins] = useState<IConverterPlugin[]>(() =>
		getAllPlugins(),
	);
	const [converterModalOpen, setConverterModalOpen] = useState(false);
	const [editingPlugin, setEditingPlugin] = useState<IConverterPlugin | null>(
		null,
	);

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
		setPlugins(getAllPlugins());
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

	// ── Handlers: Conversores ────────────────────────────────────────────────

	function handleSavePlugin(plugin: IConverterPlugin) {
		registerPlugin(plugin);
		refreshPluginState();
		setConverterModalOpen(false);
		setEditingPlugin(null);
	}

	function handleDeletePlugin(id: string) {
		const removed = unregisterPlugin(id);
		if (removed) refreshPluginState();
	}

	// ── Handlers: Tipos de Log ───────────────────────────────────────────────

	function handleSaveLogType(logType: string) {
		if (!customLogTypes.includes(logType)) {
			const next = [...customLogTypes, logType];
			setCustomLogTypes(next);
			saveLogTypes(next);
		}
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
								: `${logs.length.toLocaleString("pt-BR")} registros · ${sources.filter((s) => s.enabled).length} fonte(s) ativa(s) · ${plugins.length} conversor(es)`}
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

				{/* ── Seção: Conversores ── */}
				<SettingsSection
					title="Conversores de Log"
					description="Plugins que transformam formatos externos em JSON compatível com o LogDash. Cada conversor registra automaticamente o tipo de log correspondente na lista acima."
					actions={
						<button
							style={btnPrimary}
							onClick={() => {
								setEditingPlugin(null);
								setConverterModalOpen(true);
							}}
						>
							+ Novo Conversor
						</button>
					}
				>
					{plugins.length === 0 ? (
						<EmptyState
							message="Nenhum conversor registrado."
							actionLabel="Adicionar um conversor"
							onAction={() => {
								setEditingPlugin(null);
								setConverterModalOpen(true);
							}}
						/>
					) : (
						plugins.map((plugin) => (
							<PluginCard
								key={plugin.id}
								plugin={plugin}
								onEdit={() => {
									setEditingPlugin(plugin);
									setConverterModalOpen(true);
								}}
								onDelete={
									plugin.builtIn
										? undefined
										: () => handleDeletePlugin(plugin.id)
								}
							/>
						))
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

			<ConverterFormModal
				isOpen={converterModalOpen}
				onClose={() => {
					setConverterModalOpen(false);
					setEditingPlugin(null);
				}}
				onSave={handleSavePlugin}
				existingPlugin={editingPlugin}
				existingIds={plugins
					.filter((p) => p.id !== editingPlugin?.id)
					.map((p) => p.id)}
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

// ── PluginCard ────────────────────────────────────────────────────────────────

function PluginCard({
	plugin,
	onEdit,
	onDelete,
}: {
	plugin: IConverterPlugin;
	onEdit: () => void;
	onDelete?: () => void;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				padding: "12px 16px",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--background)",
				flexWrap: "wrap",
			}}
		>
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
						{plugin.name}
					</span>

					{/* Extensões aceitas */}
					{plugin.inputExtensions.map((ext) => (
						<span
							key={ext}
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								backgroundColor: "var(--muted)",
								padding: "2px 7px",
								borderRadius: 20,
								fontFamily: "monospace",
							}}
						>
							{ext}
						</span>
					))}

					{plugin.builtIn && (
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								border: "1px solid var(--border)",
								padding: "2px 7px",
								borderRadius: 20,
								textTransform: "uppercase",
								letterSpacing: "0.05em",
							}}
						>
							built-in
						</span>
					)}

					<span
						style={{
							fontSize: 10,
							color: "var(--muted-foreground)",
							marginLeft: "auto",
						}}
					>
						v{plugin.version}
					</span>
				</div>

				<p
					style={{
						fontSize: 12,
						color: "var(--muted-foreground)",
						margin: "4px 0 0",
						lineHeight: 1.5,
					}}
				>
					{plugin.description}
				</p>

				<div
					style={{
						marginTop: 6,
						display: "flex",
						alignItems: "center",
						gap: 6,
					}}
				>
					<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
						Comando:
					</span>
					<code
						style={{
							fontSize: 11,
							backgroundColor: "var(--muted)",
							padding: "2px 8px",
							borderRadius: 4,
							color: "var(--foreground)",
						}}
					>
						{plugin.serverCommand}
					</code>
				</div>

				{/* Metadados extras — exibidos se existirem */}
				{plugin.metadata && Object.keys(plugin.metadata).length > 0 && (
					<div
						style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}
					>
						{Object.entries(plugin.metadata).map(([key, value]) => (
							<span
								key={key}
								style={{
									fontSize: 10,
									color: "var(--muted-foreground)",
									backgroundColor: "var(--muted)",
									padding: "2px 8px",
									borderRadius: 4,
								}}
							>
								{key}: {value}
							</span>
						))}
					</div>
				)}
			</div>

			<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
				<button onClick={onEdit} style={btnSecondary}>
					{plugin.builtIn ? "Ver detalhes" : "Editar"}
				</button>
				{onDelete && (
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
				)}
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
