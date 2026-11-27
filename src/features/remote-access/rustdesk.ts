// src/features/remote-access/rustdesk.ts
//
// Tipos e regras puras da tela "Acesso remoto" (auditoria do RustDesk). Os dados vêm de
// GET /api/rustdesk/sessions | /alarms | /machines (coletor a cada 5 min, migração 022).
// Sem React e sem fetch: testado com vitest.

export type SessionStatus = "concluida" | "aberta" | "bloqueada" | "tentativa";

export interface RemoteSession {
	/** Máquina ACESSADA (ID do RustDesk). */
	machine_id: string;
	machine_name: string | null;
	machine_is_test: boolean;
	conn_id: number;
	started_at: string;
	authenticated_at: string | null;
	ended_at: string | null;
	/** Quem acessou: ID e nome do RustDesk dele. */
	peer_id: string | null;
	peer_name: string | null;
	peer_ip: string | null;
	/** Nome do computador de quem acessou, se ele também está cadastrado. */
	peer_hostname: string | null;
	primary_auth: number | null;
	conn_type: number | null;
	/** Texto: o número passa do que o JavaScript guarda sem perder dígitos. */
	session_id: string | null;
	alarm_type: number | null;
	status: SessionStatus;
}

export interface SessionsResponse {
	days: number;
	sessions: RemoteSession[];
	counts: Record<SessionStatus, number>;
	truncated: boolean;
}

export interface RemoteAlarm {
	received_at: string;
	machine_id: string | null;
	machine_name: string | null;
	conn_id: number | null;
	alarm_type: number | null;
	peer_id: string | null;
	peer_name: string | null;
	peer_ip: string | null;
}

export interface RemoteMachine {
	machine_id: string;
	hostname: string | null;
	/** Logado no último sinal; null = ninguém. */
	username: string | null;
	last_username: string | null;
	os: string | null;
	version: string | null;
	memory: string | null;
	source_ip: string | null;
	is_test: boolean;
	first_seen_at: string | null;
	last_sysinfo_at: string | null;
	sessions_30d: number;
	blocked_30d: number;
	last_session_at: string | null;
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
	concluida: "Concluída",
	aberta: "Aberta",
	bloqueada: "Bloqueada",
	tentativa: "Tentativa",
};

/** O que cada status quer dizer (tooltip). */
export const STATUS_HINT: Record<SessionStatus, string> = {
	concluida: "Entrou e saiu.",
	aberta: "Entrou e ainda não saiu (ou o aviso de saída não chegou).",
	bloqueada: "Errou a senha várias vezes e o RustDesk bloqueou.",
	tentativa: "Pediu conexão e não entrou (desistiu ou foi recusado).",
};

export const SESSION_STATUSES: readonly SessionStatus[] = ["concluida", "aberta", "bloqueada", "tentativa"];

const AUTH_LABEL: Record<number, string> = {
	1: "Aceito por clique",
	2: "Senha temporária",
	3: "Senha permanente",
	4: "Troca de lados",
};

const CONN_TYPE_LABEL: Record<number, string> = {
	0: "Controle remoto",
	1: "Arquivos",
	2: "Port forward",
	3: "Câmera",
	4: "Terminal",
};

const ALARM_LABEL: Record<number, string> = {
	1: "Mais de 30 senhas erradas do mesmo IP (IP bloqueado até o serviço reiniciar)",
	2: "Mais de 6 senhas erradas em 1 minuto (bloqueio de 1 minuto)",
};

export function authLabel(value: number | null): string {
	return value === null ? "—" : (AUTH_LABEL[value] ?? `Método ${value}`);
}

export function connTypeLabel(value: number | null): string {
	return value === null ? "—" : (CONN_TYPE_LABEL[value] ?? `Tipo ${value}`);
}

export function alarmLabel(value: number | null): string {
	return value === null ? "Alarme" : (ALARM_LABEL[value] ?? `Alarme ${value}`);
}

/** Quem acessou: nome do computador (se conhecido), senão o nome no RustDesk, senão o ID. */
export function peerLabel(s: Pick<RemoteSession, "peer_hostname" | "peer_name" | "peer_id">): string {
	return s.peer_hostname ?? s.peer_name ?? s.peer_id ?? "desconhecido";
}

/** Máquina acessada: nome se conhecido, senão o ID do RustDesk. */
export function machineLabel(s: { machine_name: string | null; machine_id: string | null }): string {
	return s.machine_name ?? s.machine_id ?? "—";
}

/** Aberta há mais que isso = provavelmente o aviso de saída se perdeu. */
export const STALE_OPEN_MS = 12 * 60 * 60 * 1000;

/// <summary>
/// Duração em ms: do início ao fim; aberta = até agora; sem fim e sem entrada (tentativa,
/// bloqueada sem close) = null.
/// </summary>
export function sessionDurationMs(s: RemoteSession, now: Date): number | null {
	const start = Date.parse(s.started_at);
	if (Number.isNaN(start)) return null;
	if (s.ended_at) {
		const end = Date.parse(s.ended_at);
		return Number.isNaN(end) ? null : Math.max(0, end - start);
	}
	if (s.status === "aberta" && s.authenticated_at) return Math.max(0, now.getTime() - start);
	return null;
}

/** "agora", "45 s", "4 min 48 s", "2 h 05 min", "3 d 4 h". */
export function formatDuration(ms: number | null): string {
	if (ms === null) return "—";
	const seconds = Math.round(ms / 1000);
	if (seconds < 1) return "agora";
	if (seconds < 60) return `${seconds} s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		const s = seconds % 60;
		return s === 0 ? `${minutes} min` : `${minutes} min ${s} s`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
	return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** Aberta há tanto tempo que provavelmente o fechamento não foi avisado. */
export function isStaleOpen(s: RemoteSession, now: Date): boolean {
	if (s.status !== "aberta") return false;
	const start = Date.parse(s.started_at);
	return !Number.isNaN(start) && now.getTime() - start > STALE_OPEN_MS;
}

/** Máquina sem sinal (sysinfo chega a cada ~2 min) há mais que isso = desligada ou sem RustDesk. */
export const MACHINE_OFFLINE_MS = 10 * 60 * 1000;

export function isMachineOnline(m: Pick<RemoteMachine, "last_sysinfo_at">, now: Date): boolean {
	if (!m.last_sysinfo_at) return false;
	const t = Date.parse(m.last_sysinfo_at);
	return !Number.isNaN(t) && now.getTime() - t <= MACHINE_OFFLINE_MS;
}
