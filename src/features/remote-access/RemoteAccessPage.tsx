// src/features/remote-access/RemoteAccessPage.tsx
import React, { useMemo, useState } from "react";
import { MonitorSmartphone, ShieldAlert } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { ErrorState } from "../../components/Error";
import type { SharedPageProps } from "../../App";
import { btnSecondary } from "../../lib/styles/buttonStyles";
import { plural } from "../../lib/plural";
import { loadApiConfig } from "../../lib/storage/logPaths";
import { authorizedFetch } from "../../hooks/useAuth";
import { useNetworkPolling } from "../network/hooks/useNetworkPolling";
import { formatEventTime } from "../network/formatEventTime";
import { formatSince } from "../network/format";
import {
	alarmLabel,
	authLabel,
	connTypeLabel,
	formatDuration,
	isMachineOnline,
	isStaleOpen,
	machineLabel,
	peerLabel,
	sessionDurationMs,
	SESSION_STATUSES,
	STATUS_HINT,
	STATUS_LABEL,
	type RemoteAlarm,
	type RemoteMachine,
	type RemoteSession,
	type SessionStatus,
	type SessionsResponse,
} from "./rustdesk";

type Tab = "sessions" | "alarms" | "machines";

const PERIODS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "1", label: "24 h" },
	{ value: "7", label: "7 dias" },
	{ value: "30", label: "30 dias" },
	{ value: "90", label: "90 dias" },
];

const muted: React.CSSProperties = { color: "var(--muted-foreground)" };

const cardStyle: React.CSSProperties = {
	backgroundColor: "var(--card)",
	border: "1px solid var(--border)",
	borderRadius: 8,
	overflow: "hidden",
	flexShrink: 0,
};

const headerCell: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

const STATUS_COLOR: Record<SessionStatus, string> = {
	concluida: "var(--muted-foreground)",
	aberta: "var(--primary)",
	bloqueada: "var(--destructive)",
	tentativa: "var(--chart-4)",
};

const STATUS_TEXT: Record<SessionStatus, string> = {
	concluida: "var(--foreground)",
	aberta: "var(--foreground)",
	bloqueada: "var(--destructive-text)",
	tentativa: "var(--warning-text)",
};

function chipStyle(active: boolean): React.CSSProperties {
	return {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "4px 10px",
		borderRadius: 999,
		border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
		backgroundColor: active ? "color-mix(in oklch, var(--primary) 18%, transparent)" : "transparent",
		color: active ? "var(--foreground)" : "var(--muted-foreground)",
		fontSize: 12,
		fontWeight: 600,
		cursor: "pointer",
		fontFamily: "inherit",
	};
}

/** Mensagem quando as tabelas/coletor ainda não existem no servidor. */
function SetupHint({ error, onRetry }: { error: string; onRetry: () => void }) {
	return (
		<ErrorState
			title="Sem dados do RustDesk"
			message={`${error}. No servidor: aplicar a migração 022, preencher RUSTDESK_SSH_* no api/.env e reiniciar o LogDashSyslog.`}
			onRetry={onRetry}
		/>
	);
}

const SESSION_COLUMNS = "150px minmax(140px, 1fr) minmax(170px, 1.2fr) 120px 140px 110px 120px";

function SessionRow({ s, now, isMobile }: { s: RemoteSession; now: Date; isMobile: boolean }) {
	const stale = isStaleOpen(s, now);
	const duration = formatDuration(sessionDurationMs(s, now));
	const statusTitle = stale
		? "Aberta há mais de 12 h: provavelmente o aviso de saída não chegou."
		: STATUS_HINT[s.status];
	return (
		<div
			style={{
				display: isMobile ? "flex" : "grid",
				flexDirection: "column",
				gridTemplateColumns: SESSION_COLUMNS,
				gap: isMobile ? 2 : 12,
				alignItems: isMobile ? "flex-start" : "center",
				padding: "10px 16px",
				borderBottom: "1px solid var(--border)",
				borderLeft: `3px solid ${STATUS_COLOR[s.status]}`,
				fontSize: 13,
			}}
		>
			<span style={{ fontVariantNumeric: "tabular-nums" }}>{formatEventTime(s.started_at)}</span>
			<span style={{ minWidth: 0 }}>
				<span style={{ fontWeight: 600 }}>{machineLabel(s)}</span>
				{s.machine_is_test && <span style={{ fontSize: 11, ...muted }}> · teste</span>}
				<div style={{ fontSize: 11, ...muted, fontFamily: "monospace" }}>{s.machine_id}</div>
			</span>
			<span style={{ minWidth: 0 }} title={s.peer_id ? `ID RustDesk ${s.peer_id}` : undefined}>
				{isMobile && <span style={muted}>por </span>}
				<span style={{ fontWeight: 600 }}>{peerLabel(s)}</span>
				{s.peer_name && s.peer_hostname && <span style={muted}> ({s.peer_name})</span>}
				<div style={{ fontSize: 11, ...muted, fontFamily: "monospace" }}>{s.peer_ip ?? "IP não informado"}</div>
			</span>
			<span>{s.alarm_type !== null && !s.authenticated_at ? "—" : connTypeLabel(s.conn_type)}</span>
			<span style={muted}>{s.alarm_type !== null && !s.authenticated_at ? "senha errada" : authLabel(s.primary_auth)}</span>
			<span style={{ fontVariantNumeric: "tabular-nums" }}>{duration}</span>
			<span title={statusTitle} style={{ fontWeight: 700, color: STATUS_TEXT[s.status] }}>
				{stale ? "Sem encerramento" : STATUS_LABEL[s.status]}
			</span>
		</div>
	);
}

function SessionsTab({ isMobile, includeTest }: { isMobile: boolean; includeTest: boolean }) {
	const [days, setDays] = useState("7");
	const [status, setStatus] = useState<SessionStatus | "">("");
	const params = new URLSearchParams({ days });
	if (status) params.set("status", status);
	if (includeTest) params.set("include_test", "1");
	const { data, error, loading, reload } = useNetworkPolling<SessionsResponse>(
		`/api/rustdesk/sessions?${params.toString()}`,
		"Erro ao buscar as sessões",
	);
	const now = new Date();
	const total = data ? SESSION_STATUSES.reduce((sum, s) => sum + data.counts[s], 0) : 0;

	return (
		<>
			<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
				<SegmentedControl label="Período" options={PERIODS} value={days} onChange={setDays} />
				<div role="group" aria-label="Status" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button type="button" className="ld-chip" aria-pressed={status === ""} onClick={() => setStatus("")} style={chipStyle(status === "")}>
						Todas{data ? ` (${total})` : ""}
					</button>
					{SESSION_STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							className="ld-chip"
							aria-pressed={status === s}
							title={STATUS_HINT[s]}
							onClick={() => setStatus(s)}
							style={chipStyle(status === s)}
						>
							{STATUS_LABEL[s]}
							{data ? ` (${data.counts[s]})` : ""}
						</button>
					))}
				</div>
			</div>

			{error && !data ? (
				<SetupHint error={error} onRetry={reload} />
			) : !data ? (
				<p style={muted}>{loading ? "Carregando…" : ""}</p>
			) : data.sessions.length === 0 ? (
				<div style={{ ...cardStyle, padding: 24, textAlign: "center", ...muted }}>
					Nenhuma sessão {status ? `"${STATUS_LABEL[status]}" ` : ""}no período.
				</div>
			) : (
				<div style={cardStyle}>
					{!isMobile && (
						<div style={{ display: "grid", gridTemplateColumns: SESSION_COLUMNS, gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", borderLeft: "3px solid transparent" }}>
							{["Início", "Máquina acessada", "Quem acessou", "Tipo", "Autenticação", "Duração", "Status"].map((h) => (
								<span key={h} style={headerCell}>
									{h}
								</span>
							))}
						</div>
					)}
					{data.sessions.map((s) => (
						<SessionRow key={`${s.machine_id}-${s.conn_id}-${s.started_at}`} s={s} now={now} isMobile={isMobile} />
					))}
					{data.truncated && (
						<div style={{ padding: "8px 16px", fontSize: 12, ...muted }}>Mostrando as 1.000 mais recentes. Diminua o período.</div>
					)}
				</div>
			)}
		</>
	);
}

function AlarmsTab({ includeTest }: { includeTest: boolean }) {
	const { data, error, reload } = useNetworkPolling<{ alarms: RemoteAlarm[] }>(
		`/api/rustdesk/alarms?days=90${includeTest ? "&include_test=1" : ""}`,
		"Erro ao buscar os alarmes",
	);
	if (error && !data) return <SetupHint error={error} onRetry={reload} />;
	if (!data) return <p style={muted}>Carregando…</p>;
	if (data.alarms.length === 0)
		return (
			<div style={{ ...cardStyle, padding: 24, textAlign: "center", ...muted }}>
				Nenhum alarme de senha nos últimos 90 dias. Senha errada isolada não gera alarme: só repetição (força bruta).
			</div>
		);
	return (
		<div style={cardStyle}>
			<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
				{data.alarms.map((a, i) => (
					<li key={`${a.received_at}-${i}`} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)", borderLeft: "3px solid var(--destructive)", fontSize: 13 }}>
						<ShieldAlert size={16} aria-hidden="true" style={{ flexShrink: 0, color: "var(--destructive-text)", marginTop: 2 }} />
						<div style={{ minWidth: 0 }}>
							<div style={{ fontWeight: 600 }}>{alarmLabel(a.alarm_type)}</div>
							<div style={{ fontSize: 12, ...muted }}>
								{formatEventTime(a.received_at)} · em {machineLabel(a)} · por {a.peer_name ?? a.peer_id ?? "desconhecido"}
								{a.peer_ip ? ` de ${a.peer_ip}` : ""}
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

function MachinesTab({ isMobile }: { isMobile: boolean }) {
	const { data, error, reload } = useNetworkPolling<{ machines: RemoteMachine[] }>(
		"/api/rustdesk/machines",
		"Erro ao buscar as máquinas",
	);
	const [saving, setSaving] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const now = new Date();

	async function toggleTest(m: RemoteMachine) {
		setSaving(m.machine_id);
		setSaveError(null);
		try {
			const { api } = loadApiConfig();
			const res = await authorizedFetch(`${api}/api/rustdesk/machines/${encodeURIComponent(m.machine_id)}/test`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ is_test: !m.is_test }),
			});
			if (!res.ok) throw new Error("não foi possível salvar");
			reload();
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : "erro");
		} finally {
			setSaving(null);
		}
	}

	if (error && !data) return <SetupHint error={error} onRetry={reload} />;
	if (!data) return <p style={muted}>Carregando…</p>;
	const columns = "minmax(160px, 1.2fr) minmax(150px, 1fr) minmax(180px, 1.3fr) 130px 110px 150px";
	return (
		<>
			{saveError && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--destructive-text)" }}>Erro: {saveError}</p>}
			<div style={cardStyle}>
				{!isMobile && (
					<div style={{ display: "grid", gridTemplateColumns: columns, gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
						{["Máquina", "Usuário", "Sistema", "Último sinal", "Sessões 30 d", ""].map((h) => (
							<span key={h} style={headerCell}>
								{h}
							</span>
						))}
					</div>
				)}
				{data.machines.map((m) => {
					const online = isMachineOnline(m, now);
					return (
						<div
							key={m.machine_id}
							style={{
								display: isMobile ? "flex" : "grid",
								flexDirection: "column",
								gridTemplateColumns: columns,
								gap: isMobile ? 2 : 12,
								alignItems: isMobile ? "flex-start" : "center",
								padding: "10px 16px",
								borderBottom: "1px solid var(--border)",
								fontSize: 13,
								opacity: m.is_test ? 0.65 : 1,
							}}
						>
							<span style={{ display: "inline-flex", gap: 8, alignItems: "center", minWidth: 0 }}>
								<span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, backgroundColor: online ? "var(--primary)" : "var(--muted-foreground)" }} />
								<span style={{ minWidth: 0 }}>
									<span style={{ fontWeight: 600 }}>{m.hostname ?? m.machine_id}</span>
									{m.is_test && <span style={{ fontSize: 11, ...muted }}> · teste</span>}
									<div style={{ fontSize: 11, ...muted, fontFamily: "monospace" }}>{m.machine_id}</div>
								</span>
							</span>
							<span>
								{m.username ?? <span style={muted}>ninguém logado{m.last_username ? ` (último: ${m.last_username})` : ""}</span>}
							</span>
							<span style={{ fontSize: 12, ...muted }}>
								{m.os ?? "—"}
								{m.version ? ` · RustDesk ${m.version}` : ""}
							</span>
							<span title={m.last_sysinfo_at ? formatEventTime(m.last_sysinfo_at) : undefined} style={{ color: online ? "var(--foreground)" : "var(--muted-foreground)" }}>
								{m.last_sysinfo_at ? (online ? "online" : formatSince(m.last_sysinfo_at, now)) : "sem sinal"}
							</span>
							<span style={{ fontVariantNumeric: "tabular-nums" }}>
								{m.sessions_30d}
								{m.blocked_30d > 0 && <span style={{ color: "var(--destructive-text)", fontWeight: 700 }}> · {m.blocked_30d} bloq.</span>}
							</span>
							<button
								type="button"
								onClick={() => void toggleTest(m)}
								disabled={saving === m.machine_id}
								title="Máquina de teste (VM de laboratório, notebook do técnico) some das listas de sessões e alarmes"
								style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px", justifySelf: "start" }}
							>
								{m.is_test ? "Desmarcar teste" : "Marcar como teste"}
							</button>
						</div>
					);
				})}
			</div>
		</>
	);
}

/// <summary>
/// "Acesso remoto": auditoria do RustDesk auto-hospedado da Optare. O VPS registra os
/// avisos das máquinas; o coletor do LogDash (thread no LogDashSyslog) lê por SFTP a
/// cada 5 min e monta uma linha por conexão. Três abas:
///  - Sessões: quem acessou qual máquina, de onde, quando, quanto tempo e como entrou;
///  - Alarmes: senha errada repetida (força bruta), o único sinal que o RustDesk avisa;
///  - Máquinas: estado de cada uma e a marcação de "teste" (some das outras abas).
/// As regras de exibição ficam em `rustdesk.ts`.
/// </summary>
export function RemoteAccessPage({ isMobile }: SharedPageProps) {
	const [tab, setTab] = useState<Tab>("sessions");
	const [includeTest, setIncludeTest] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);
	const tabs = useMemo(
		() => [
			{ value: "sessions" as Tab, label: "Sessões" },
			{ value: "alarms" as Tab, label: "Alarmes" },
			{ value: "machines" as Tab, label: "Máquinas" },
		],
		[],
	);

	return (
		<div style={{ display: "flex", flex: 1, minWidth: 0, height: "100vh", overflow: "hidden", backgroundColor: "var(--background)" }}>
			<main
				style={{
					flex: 1,
					padding: isMobile ? "64px 16px 16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0,
					overflowY: "auto",
					overflowX: "hidden",
				}}
			>
				<PageHeader
					title="Acesso remoto"
					subtitle="RustDesk da Optare · quem acessou qual máquina, de onde e como · atualizado a cada 5 min"
					spacing="compact"
					wrap
				>
					<button onClick={() => setReloadKey((k) => k + 1)} style={btnSecondary}>
						↺ Recarregar
					</button>
				</PageHeader>

				<div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
					<MonitorSmartphone size={16} aria-hidden="true" style={muted} />
					<SegmentedControl label="Aba" options={tabs} value={tab} onChange={setTab} />
					{tab !== "machines" && (
						<label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, ...muted, cursor: "pointer" }}>
							<input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
							Mostrar máquinas de teste
						</label>
					)}
				</div>

				<div key={reloadKey} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					{tab === "sessions" && <SessionsTab isMobile={isMobile} includeTest={includeTest} />}
					{tab === "alarms" && <AlarmsTab includeTest={includeTest} />}
					{tab === "machines" && <MachinesTab isMobile={isMobile} />}
				</div>

				<p style={{ margin: 0, fontSize: 11, ...muted }}>
					{plural(1, "registro", "registros").replace("1 registro", "Os registros")} contêm IPs e nomes de pessoas e ficam 365 dias no LogDash. Senha
					errada isolada não gera aviso no RustDesk: "Tentativa" é conexão pedida que não entrou; "Bloqueada" é repetição de senha errada.
				</p>
			</main>
		</div>
	);
}
