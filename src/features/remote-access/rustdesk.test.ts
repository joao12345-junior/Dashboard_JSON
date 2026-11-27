// src/features/remote-access/rustdesk.test.ts
import { describe, expect, it } from "vitest";
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
	type RemoteSession,
} from "./rustdesk";

function session(overrides: Partial<RemoteSession> = {}): RemoteSession {
	return {
		machine_id: "419304090",
		machine_name: "servweb",
		machine_is_test: false,
		conn_id: 631,
		started_at: "2026-11-27T20:13:47Z",
		authenticated_at: "2026-11-27T20:13:47Z",
		ended_at: "2026-11-27T20:18:35Z",
		peer_id: "234838759",
		peer_name: "Joaov",
		peer_ip: "170.244.220.173",
		peer_hostname: "joao-dell",
		primary_auth: 3,
		conn_type: 0,
		session_id: "14704232641301615989",
		alarm_type: null,
		status: "concluida",
		...overrides,
	};
}

const NOW = new Date("2026-11-27T21:00:00Z");

describe("rótulos", () => {
	it("método, tipo e alarme, com fallback para valor desconhecido", () => {
		expect(authLabel(3)).toBe("Senha permanente");
		expect(authLabel(9)).toBe("Método 9");
		expect(authLabel(null)).toBe("—");
		expect(connTypeLabel(1)).toBe("Arquivos");
		expect(alarmLabel(2)).toContain("6 senhas erradas");
	});

	it("quem acessou: computador, depois nome, depois ID", () => {
		expect(peerLabel(session())).toBe("joao-dell");
		expect(peerLabel(session({ peer_hostname: null }))).toBe("Joaov");
		expect(peerLabel(session({ peer_hostname: null, peer_name: null }))).toBe("234838759");
		expect(peerLabel(session({ peer_hostname: null, peer_name: null, peer_id: null }))).toBe("desconhecido");
		expect(machineLabel({ machine_name: null, machine_id: "28426763" })).toBe("28426763");
	});
});

describe("duração", () => {
	it("concluída: início ao fim", () => {
		expect(formatDuration(sessionDurationMs(session(), NOW))).toBe("4 min 48 s");
	});

	it("aberta com entrada: até agora; tentativa sem fim: sem duração", () => {
		const open = session({ ended_at: null, status: "aberta" });
		expect(sessionDurationMs(open, NOW)).toBe(46 * 60_000 + 13_000);
		const attempt = session({ ended_at: null, authenticated_at: null, status: "tentativa" });
		expect(sessionDurationMs(attempt, NOW)).toBeNull();
	});

	it("formatos", () => {
		expect(formatDuration(null)).toBe("—");
		expect(formatDuration(300)).toBe("agora");
		expect(formatDuration(45_000)).toBe("45 s");
		expect(formatDuration(5 * 60_000)).toBe("5 min");
		expect(formatDuration(125 * 60_000)).toBe("2 h 05 min");
		expect(formatDuration(76 * 3_600_000)).toBe("3 d 4 h");
	});
});

describe("aberta há muito tempo e máquina sem sinal", () => {
	it("aberta há mais de 12 h é suspeita", () => {
		expect(isStaleOpen(session({ status: "aberta", started_at: "2026-11-27T08:00:00Z" }), NOW)).toBe(true);
		expect(isStaleOpen(session({ status: "aberta" }), NOW)).toBe(false);
		expect(isStaleOpen(session({ status: "concluida", started_at: "2026-11-01T00:00:00Z" }), NOW)).toBe(false);
	});

	it("online = sinal nos últimos 10 min", () => {
		expect(isMachineOnline({ last_sysinfo_at: "2026-11-27T20:55:00Z" }, NOW)).toBe(true);
		expect(isMachineOnline({ last_sysinfo_at: "2026-11-27T20:40:00Z" }, NOW)).toBe(false);
		expect(isMachineOnline({ last_sysinfo_at: null }, NOW)).toBe(false);
	});
});
