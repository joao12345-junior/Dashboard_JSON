// src/features/network/format.ts
// Formatadores de exibição da área Rede (pt-BR). Puros, sem React.

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
const BIT_UNITS = ["bps", "kbps", "Mbps", "Gbps"];

function scale(value: number, base: number, units: string[]): string {
	let v = value;
	let i = 0;
	while (v >= base && i < units.length - 1) {
		v /= base;
		i += 1;
	}
	const digits = i === 0 ? 0 : 1;
	return `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits })} ${units[i]}`;
}

/** Tamanho em bytes (base 1024): "1,9 GB". `null` vira "—". */
export function formatBytes(bytes: number | null): string {
	return bytes === null ? "—" : scale(bytes, 1024, BYTE_UNITS);
}

/** Taxa em bits por segundo (base 1000): "1,2 Mbps". `null` vira "—". */
export function formatBitrate(bps: number | null): string {
	return bps === null ? "—" : scale(bps, 1000, BIT_UNITS);
}

/** Tempo ligado: "50 d 5 h", "3 h 12 min", "< 1 min". `null` vira "—". */
export function formatUptime(seconds: number | null): string {
	if (seconds === null) return "—";
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days} d ${hours} h`;
	if (hours > 0) return `${hours} h ${minutes} min`;
	if (minutes > 0) return `${minutes} min`;
	return "< 1 min";
}

/** Tempo decorrido até agora: "agora há pouco", "há 5 min", "há 3 h", "há 2 d". */
export function formatSince(iso: string | null, now: Date = new Date()): string {
	if (!iso) return "—";
	const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
	if (seconds < 60) return "agora há pouco";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `há ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `há ${hours} h`;
	return `há ${Math.floor(hours / 24)} d`;
}

/** O poller grava a cada 60 s; sem ciclo há mais que isso, o dado pode estar velho. */
const STALE_AFTER_MS = 3 * 60 * 1000;

/** `true` se o último ciclo do poller é velho demais (`null` = ainda sem dados: false). */
export function isPollerStale(polledAt: string | null, now: Date = new Date()): boolean {
	if (!polledAt) return false;
	return now.getTime() - new Date(polledAt).getTime() > STALE_AFTER_MS;
}

/** Abaixo disso (dBm) o Wi-Fi costuma dar lentidão e quedas. */
const WEAK_SIGNAL_DBM = -75;

/** `true` se o sinal Wi-Fi é fraco (≤ -75 dBm). `null` (cabo/sem dado): false. */
export function isWeakSignal(dbm: number | null): boolean {
	return dbm !== null && dbm <= WEAK_SIGNAL_DBM;
}

/** Qualidade do sinal Wi-Fi em palavras: ótimo, bom, razoável ou fraco. */
export function signalQuality(dbm: number | null): string {
	if (dbm === null) return "—";
	if (dbm >= -60) return "ótimo";
	if (dbm >= -70) return "bom";
	if (dbm > WEAK_SIGNAL_DBM) return "razoável";
	return "fraco";
}
