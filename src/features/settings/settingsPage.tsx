// src/features/settings/settingsPage.tsx
import { useState } from "react";
import { useWindowSize } from "../../hooks/useWindowSize";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";
import { PageHeader } from "../../components/PageHeader";
import { loadApiConfig, saveApiConfig } from "../../lib/storage/logPaths";
import type { ApiConfig } from "../../lib/storage/logPaths";
import { Toast } from "../../components/Toast";
import type { ToastType } from "../../components/Toast";
import { authorizedFetch } from "../../hooks/useAuth";
import { ProgramsList } from "./ProgramsList";
import { SystemHealthList } from "../system/SystemHealthList";
import {
	MonitoredUrlFormModal,
	type MonitoredUrlFormValues,
} from "./monitoredUrlFormModal";

/** Mensagem exibida no Toast da página (sucesso ou erro). */
type PageToast = { message: string; type: ToastType };

export function Settings({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	siteData,
	appPrograms,
	systemHealth,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [apiConfig, setApiConfig] = useState<ApiConfig>(() => loadApiConfig());
	const [toast, setToast] = useState<PageToast | null>(null);

	function handleSaveApiConfig(config: ApiConfig) {
		setApiConfig(config);
		saveApiConfig(config);
	}

	// ── Monitoramento de URLs ────────────────────────────────────────────────
	const { monitoredUrls, refresh, refreshMonitoredUrls } = siteData;
	const [monitoredUrlModalOpen, setMonitoredUrlModalOpen] = useState(false);
	const [editingMonitoredUrl, setEditingMonitoredUrl] =
		useState<MonitoredUrlFormValues | null>(null);

	async function handleSaveMonitoredUrl(values: MonitoredUrlFormValues) {
		const { api } = loadApiConfig();
		const isEdit = values.id !== undefined;
		const url = isEdit
			? `${api}/api/site/monitored-urls/${values.id}`
			: `${api}/api/site/monitored-urls`;

		try {
			const res = await authorizedFetch(url, {
				method: isEdit ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label: values.label,
					url: values.url,
					timeout_seconds: values.timeout_seconds,
					has_sentry: values.has_sentry,
					save_response_body: values.save_response_body,
				}),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			refreshMonitoredUrls();
			refresh(); // caso o site ativo tenha sido afetado (ex: desativado)
			setMonitoredUrlModalOpen(false);
			setEditingMonitoredUrl(null);
			setToast({ message: "Site salvo.", type: "message" });
		} catch (err) {
			console.error("[Settings] Erro ao salvar site monitorado:", err);
			setToast({
				message: "Não foi possível salvar o site. Tente novamente.",
				type: "error",
			});
		}
	}

	async function handleToggleMonitoredUrl(id: number, active: boolean) {
		const { api } = loadApiConfig();
		try {
			const res = await authorizedFetch(
				`${api}/api/site/monitored-urls/${id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ active: !active }),
				},
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			refreshMonitoredUrls();
			refresh(); // caso o site ativo tenha sido afetado (ex: desativado)
		} catch (err) {
			console.error("[Settings] Erro ao alternar status:", err);
			setToast({
				message: "Não foi possível alterar o status do site.",
				type: "error",
			});
		}
	}

	return (
		<div
			style={{
				// flex: 1 + minWidth: 0: a raiz precisa ocupar todo o espaço ao lado da Sidebar.
				// Sem isso a largura vira a do conteúdo (flex: 0 1 auto) e sobra uma faixa vazia à direita
				// quando a página é mais estreita que a tela (ex.: lista curta de programas).
				flex: 1,
				minWidth: 0,
				display: "flex",
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<main
				style={{
					flex: 1,
					padding: isMobile ? "64px 16px 16px" : "32px",
					overflowY: "auto",
				}}
			>
				{/* ── Cabeçalho ── */}
				<PageHeader
					title="Configurações"
					subtitle={
						progress.isLoading
							? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
							: `${logs.length.toLocaleString("pt-BR")} registros carregados`
					}
					spacing="dense"
					wrap
				>
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
				</PageHeader>

				{/* ── Seção: Conexão com a API ── */}
				<SettingsSection
					title="Conexão com a API"
					description="Endereço da Flask API de onde o LogDash lê os logs. Use Testar para confirmar que ela responde antes de salvar."
				>
					<ApiCard
						config={apiConfig}
						onSave={handleSaveApiConfig}
						isMobile={isMobile}
					/>
				</SettingsSection>

				{/* ── Seção: Saúde do LogDash ── */}
				<SettingsSection
					title="Saúde do LogDash"
					description="Quando chegou o último dado de cada serviço e de cada origem de logs. Serviço atrasado ou parado também gera um aviso na Home. Os limites de cada item estão em healthStatus.ts."
				>
					<SystemHealthList {...systemHealth} />
				</SettingsSection>

				{/* ── Seção: Programas dos Logs Gerais ── */}
				<SettingsSection
					title="Programas (Logs Gerais)"
					description="Programas que enviam logs gerais. No modo automático, quem passa 5 dias sem enviar nada some do dashboard e dos registros e volta sozinho ao enviar de novo. Oculto só volta por aqui. Apagar remove os logs do programa do banco."
				>
					<ProgramsList
						programs={appPrograms.programs}
						loading={appPrograms.loading}
						error={appPrograms.error}
						isMobile={isMobile}
						onChangeVisibility={appPrograms.setVisibility}
						onDeleteLogs={appPrograms.deleteLogs}
						onToast={(message, type) => setToast({ message, type })}
					/>
				</SettingsSection>

				{/* ── Seção: Monitoramento de URLs ── */}
				<SettingsSection
					title="Monitoramento de URLs"
					description="Sites e serviços monitorados pelo LogDash (disponibilidade e, quando aplicável, erros do Sentry)."
					actions={
						<button
							style={btnPrimary}
							onClick={() => {
								setEditingMonitoredUrl(null);
								setMonitoredUrlModalOpen(true);
							}}
						>
							+ Novo Site
						</button>
					}
				>
					{monitoredUrls.length === 0 ? (
						<EmptyState
							message="Nenhum site monitorado."
							actionLabel="Adicionar um site"
							onAction={() => {
								setEditingMonitoredUrl(null);
								setMonitoredUrlModalOpen(true);
							}}
						/>
					) : (
						monitoredUrls.map((mu) => (
							<MonitoredUrlCard
								key={mu.id}
								monitoredUrl={mu}
								onToggle={() => void handleToggleMonitoredUrl(mu.id, mu.active)}
								onEdit={() => {
									setEditingMonitoredUrl({
										id: mu.id,
										label: mu.label,
										url: mu.url,
										timeout_seconds: mu.timeout_seconds,
										has_sentry: mu.has_sentry,
										save_response_body: mu.save_response_body,
									});
									setMonitoredUrlModalOpen(true);
								}}
							/>
						))
					)}
				</SettingsSection>
			</main>

			{/* ── Modais ── */}
			<MonitoredUrlFormModal
				isOpen={monitoredUrlModalOpen}
				onClose={() => {
					setMonitoredUrlModalOpen(false);
					setEditingMonitoredUrl(null);
				}}
				onSave={(values) => void handleSaveMonitoredUrl(values)}
				existing={editingMonitoredUrl}
			/>

			<Toast
				message={toast?.message ?? null}
				type={toast?.type}
				onDismiss={() => setToast(null)}
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

// ── ApiCard ───────────────────────────────────────────────────────────────────

interface ApiCardProps {
	config: ApiConfig;
	onSave: (config: ApiConfig) => void;
	isMobile: boolean;
}

type TestStatus = "idle" | "testing" | "ok" | "error";

function ApiCard({ config, onSave, isMobile }: ApiCardProps) {
	const [api, setApi] = useState(config.api);
	// O resultado vale só para o endereço testado: se o usuário editar o campo, volta a "idle".
	const [test, setTest] = useState<{ host: string; status: TestStatus }>({
		host: "",
		status: "idle",
	});
	const status: TestStatus = test.host === api ? test.status : "idle";

	function handleToggleUrlApi() {
		onSave({ ...config, enabled: !config.enabled });
	}

	function handleSaveUrlApi() {
		onSave({ ...config, api });
	}

	async function handleTestConnectionUrlApi() {
		setTest({ host: api, status: "testing" });
		try {
			const res = await fetch(`${api}/api/health`);
			setTest({ host: api, status: res.ok ? "ok" : "error" });
		} catch (err) {
			setTest({ host: api, status: "error" });
			console.error("[ApiCard] Erro ao testar conexão com a API:", err);
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
						onClick={() => void handleTestConnectionUrlApi()}
						style={btnSecondary}
						disabled={status === "testing"}
					>
						{status === "testing" ? "Testando…" : "Testar"}
					</button>
					{(status === "ok" || status === "error") && (
						<span
							style={{
								fontSize: 12,
								color:
									status === "ok"
										? "oklch(0.6 0.2 145)"
										: "var(--destructive, oklch(0.6 0.22 25))",
							}}
						>
							{status === "ok" ? "✓ Conexão estável" : "✗ Falhou"}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function MonitoredUrlCard({
	monitoredUrl,
	onToggle,
	onEdit,
}: {
	monitoredUrl: {
		id: number;
		label: string;
		url: string;
		active: boolean;
		timeout_seconds: number;
		has_sentry: boolean;
		save_response_body: boolean;
	};
	onToggle: () => void;
	onEdit: () => void;
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
				backgroundColor: monitoredUrl.active
					? "var(--background)"
					: "var(--muted)",
				opacity: monitoredUrl.active ? 1 : 0.65,
				flexWrap: "wrap",
				transition: "opacity 0.2s",
			}}
		>
			<button
				onClick={onToggle}
				title={monitoredUrl.active ? "Desativar" : "Ativar"}
				style={{
					width: 36,
					height: 20,
					borderRadius: 10,
					border: "none",
					backgroundColor: monitoredUrl.active
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
						left: monitoredUrl.active ? 18 : 2,
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
						{monitoredUrl.label}
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
						{monitoredUrl.timeout_seconds}s timeout
					</span>
					{monitoredUrl.has_sentry && (
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								backgroundColor: "var(--muted)",
								padding: "2px 7px",
								borderRadius: 20,
							}}
						>
							Sentry
						</span>
					)}
					{monitoredUrl.save_response_body && (
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								backgroundColor: "var(--muted)",
								padding: "2px 7px",
								borderRadius: 20,
							}}
						>
							Guarda resposta
						</span>
					)}
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
					{monitoredUrl.url}
				</div>
			</div>

			<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
				<button onClick={onEdit} style={btnSecondary}>
					Editar
				</button>
			</div>
		</div>
	);
}
