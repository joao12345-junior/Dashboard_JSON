// src/lib/data/LogMapperRegistry.ts
import { ProcessLogMapper } from "./mappers/ProcessLogMapper";
import { WindowsEventLogMapper } from "./mappers/WindowsEventLogMapper"; // ← NOVO
import { Log } from "../types/Log";
import { ColumnDefinition } from "../types/ColumnDefinition";

export interface LogMapperContract {
	toLog: (raw: Record<string, unknown>) => Log;
	toLogList: (raws: Record<string, unknown>[]) => Log[];
	columns: ColumnDefinition[];
}

export function detectLogType(raw: Record<string, unknown>): string {
	// Assinatura do JSON gerado pelo Python — tem _enriched no nível raiz
	if ("_enriched" in raw && typeof raw._enriched === "object")
		// ← NOVO
		return "windows-event";

	// Assinatura dos logs de backup internos
	if ("Start" in raw && "Data" in raw && "Hora" in raw) return "process";

	return "process"; // fallback
}

const registry: Record<string, LogMapperContract> = {
	process: ProcessLogMapper as LogMapperContract,
	"windows-event": WindowsEventLogMapper as LogMapperContract, // ← NOVO
};

export function getMapper(logType: string): LogMapperContract {
	return registry[logType] ?? registry["process"];
}
