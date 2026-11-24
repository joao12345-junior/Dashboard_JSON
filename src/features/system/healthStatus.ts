// src/features/system/healthStatus.ts

/// <summary>
/// Regras de saúde do próprio LogDash: dado "quando foi o último dado de cada
/// componente", decide se está em dia, atrasado ou parado. Tudo puro (sem React,
/// sem rede). O horário de referência é o do SERVIDOR (`server_time`): comparar
/// com o relógio do navegador faria um PC com a hora errada mostrar tudo parado.
/// </summary>

/** Resposta de `GET /api/system/health`. */
export interface HealthSnapshot {
	server_time: string;
	unifi_poller: string | null;
	site_check: string | null;
	network_events: string | null;
	app_logs: string | null;
	windows_logs: string | null;
	process_logs: string | null;
}

export type HealthKey = Exclude<keyof HealthSnapshot, "server_time">;

/** service = algo que o LogDash roda e DEVE andar sempre; source = quem manda logs (pode ficar quieto). */
export type HealthKind = "service" | "source";

export type HealthLevel = "ok" | "warn" | "stale" | "unknown";

interface HealthRule {
	key: HealthKey;
	label: string;
	kind: HealthKind;
	/** Minutos sem dado a partir dos quais vira "Atrasado". */
	warnAfterMin: number;
	/** Minutos sem dado a partir dos quais vira "Parado". */
	staleAfterMin: number;
	hint: string;
}

/// <summary>
/// Limites. Os de SERVIÇO vêm do intervalo de cada um (poller: ciclo de 1 min com
/// recuo até 5 min; sync de sites: a cada 30 min, tolerando uma rodada perdida).
/// Os de FONTE são estimativas do que é "silêncio estranho" para cada origem —
/// ajuste aqui se gerarem falso alarme. Fontes nunca disparam o aviso da Home.
/// </summary>
export const HEALTH_RULES: readonly HealthRule[] = [
	{
		key: "unifi_poller",
		label: "Coleta da rede (poller UniFi)",
		kind: "service",
		warnAfterMin: 3,
		staleAfterMin: 10,
		hint: "Serviço LogDashUnifiPoller. Também para se o UniFi ficar inacessível.",
	},
	{
		key: "site_check",
		label: "Checagem de sites",
		kind: "service",
		warnAfterMin: 35,
		staleAfterMin: 90,
		hint: "Roda a cada 30 min dentro do serviço LogDashSyslog.",
	},
	{
		key: "network_events",
		label: "Eventos de rede (syslog)",
		kind: "source",
		warnAfterMin: 3 * 60,
		staleAfterMin: 12 * 60,
		hint: "Receptor UDP do LogDashSyslog; o gateway costuma enviar eventos o tempo todo.",
	},
	{
		key: "app_logs",
		label: "Logs Gerais",
		kind: "source",
		warnAfterMin: 6 * 60,
		staleAfterMin: 24 * 60,
		hint: "Último log gravado por qualquer programa.",
	},
	{
		key: "windows_logs",
		label: "Windows Event Log",
		kind: "source",
		warnAfterMin: 12 * 60,
		staleAfterMin: 48 * 60,
		hint: "Último evento do Windows importado.",
	},
	{
		key: "process_logs",
		label: "Logs de Backup",
		kind: "source",
		warnAfterMin: 36 * 60,
		staleAfterMin: 72 * 60,
		hint: "Os backups rodam uma vez por dia.",
	},
];

export interface HealthItem {
	key: HealthKey;
	label: string;
	kind: HealthKind;
	hint: string;
	/** ISO do último dado; null = nunca houve. */
	lastAt: string | null;
	/** Idade do último dado em ms (hora estimada do servidor − último dado); null se não há dado. */
	ageMs: number | null;
	level: HealthLevel;
}

const MIN_MS = 60_000;

/// <summary>
/// Avalia cada componente. `receivedAtMs` é quando o navegador recebeu o snapshot e
/// `nowMs` o instante atual: a hora do servidor é estimada como
/// `server_time + (nowMs − receivedAtMs)`, assim a tela continua envelhecendo
/// entre uma consulta e outra sem depender de o relógio local estar certo.
/// </summary>
export function evaluateHealth(
	snapshot: HealthSnapshot,
	receivedAtMs: number,
	nowMs: number,
): HealthItem[] {
	const serverMs = Date.parse(snapshot.server_time);
	const estimatedNow = serverMs + Math.max(0, nowMs - receivedAtMs);

	return HEALTH_RULES.map((rule) => {
		const lastAt = snapshot[rule.key];
		const lastMs = lastAt ? Date.parse(lastAt) : NaN;
		const base = { key: rule.key, label: rule.label, kind: rule.kind, hint: rule.hint, lastAt };

		if (!Number.isFinite(lastMs) || !Number.isFinite(estimatedNow)) {
			return { ...base, ageMs: null, level: "unknown" as const };
		}
		const ageMs = Math.max(0, estimatedNow - lastMs);
		let level: HealthLevel = "ok";
		if (ageMs > rule.staleAfterMin * MIN_MS) level = "stale";
		else if (ageMs > rule.warnAfterMin * MIN_MS) level = "warn";
		return { ...base, ageMs, level };
	});
}

/** Serviços que não estão em dia (base do aviso da Home). Fontes e "sem dado" ficam de fora. */
export function serviceAlerts(items: readonly HealthItem[]): HealthItem[] {
	return items.filter((i) => i.kind === "service" && (i.level === "warn" || i.level === "stale"));
}

/** Pior estado entre os SERVIÇOS; "unknown" só se nenhum serviço tem dado. */
export function overallLevel(items: readonly HealthItem[]): HealthLevel {
	const services = items.filter((i) => i.kind === "service");
	if (services.some((i) => i.level === "stale")) return "stale";
	if (services.some((i) => i.level === "warn")) return "warn";
	if (services.some((i) => i.level === "ok")) return "ok";
	return "unknown";
}

/** "agora há pouco", "há 5 min", "há 3 h", "há 2 d". `null` = sem dado. */
export function formatAge(ageMs: number | null): string {
	if (ageMs === null) return "sem registro";
	const minutes = Math.floor(ageMs / MIN_MS);
	if (minutes < 1) return "agora há pouco";
	if (minutes < 60) return `há ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `há ${hours} h`;
	return `há ${Math.floor(hours / 24)} d`;
}

export const LEVEL_LABEL: Record<HealthLevel, string> = {
	ok: "Em dia",
	warn: "Atrasado",
	stale: "Parado",
	unknown: "Sem dados",
};
