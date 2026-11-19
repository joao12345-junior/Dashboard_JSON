// src/lib/logSeverity.ts
import type { Log } from "./types/Log";

/**
 * "Erro crítico" de qualquer tipo de log — a mesma regra usada nos KPIs da Home:
 *  - Windows Event: criticidade "High";
 *  - Logs Gerais (app): tipo "erro";
 *  - Backup (process): status 2.
 */
export function isCriticalLog(log: Log): boolean {
	if (log.logType === "windows-event") return log.criticality === "High";
	if (log.logType === "app") return log.tipo === "erro";
	return log.status === 2;
}

/**
 * "Aviso" de qualquer tipo de log — o que merece atenção mas não é crítico:
 *  - Windows Event: criticidade "Medium" (nível 3 = Warning);
 *  - Logs Gerais (app): tipo "aviso".
 * (Backup não tem aviso: status 0 é "finalizado".)
 */
export function isWarningLog(log: Log): boolean {
	if (log.logType === "windows-event") return log.criticality === "Medium";
	if (log.logType === "app") return log.tipo === "aviso";
	return false;
}
