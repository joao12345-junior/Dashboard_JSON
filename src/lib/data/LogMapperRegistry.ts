// src/lib/data/LogMapperRegistry.ts

import { ProcessLogMapper } from "./mappers/ProcessLogMapper";
import { WindowsEventLogMapper } from "./mappers/WindowsEventLogMapper";
import { Log } from "../types/Log";
import { ColumnDefinition } from "../types/ColumnDefinition";

export interface LogMapperContract {
	toLog: (raw: Record<string, unknown>) => Log;
	toLogList: (raws: Record<string, unknown>[]) => Log[];
	columns: ColumnDefinition[];
}

/**
 * Metadados de exibição de um tipo de log registrado.
 *
 * Separa "o que o mapper faz" (LogMapperContract) de
 * "como ele aparece na UI" (LogTypeDescriptor).
 *
 * Single Responsibility Principle: o mapper não precisa saber
 * que existe uma settings page — essa informação fica aqui.
 */
export interface LogTypeDescriptor {
	/** Chave técnica usada no código e no localStorage */
	key: string;
	/** Rótulo legível para exibição na UI */
	label: string;
	/** Descrição curta do formato — aparece nos tooltips e cards */
	description: string;
	/**
	 * Se true, o tipo é built-in e não pode ser removido pelo usuário.
	 * Evita que alguém remova "process" ou "windows-event" acidentalmente.
	 */
	builtIn: boolean;
}

// ── Registry interno ──────────────────────────────────────────────────────────

/**
 * O registry armazena dois mapas paralelos:
 * - mappers: chave → implementação (usado pelo LogRepository)
 * - descriptors: chave → metadados de UI (usado pela settings page)
 *
 * Por que separados? Porque o LogRepository não precisa saber nada
 * sobre labels ou descrições, e a settings page não precisa instanciar
 * mappers. Cada camada consome apenas o que precisa.
 */
const mappers: Record<string, LogMapperContract> = {
	process: ProcessLogMapper as LogMapperContract,
	"windows-event": WindowsEventLogMapper as LogMapperContract,
};

const descriptors: Record<string, LogTypeDescriptor> = {
	process: {
		key: "process",
		label: "Log de Processo",
		description:
			"Logs internos de backup e rotinas do sistema (campos: message, Data, Hora, Start).",
		builtIn: true,
	},
	"windows-event": {
		key: "windows-event",
		label: "Windows Event Log",
		description:
			"Logs convertidos de .evtx pelo evtx_converter_v2.py com campos _enriched.",
		builtIn: true,
	},
};

// ── API pública ───────────────────────────────────────────────────────────────

export function detectLogType(raw: Record<string, unknown>): string {
	if ("_enriched" in raw && typeof raw._enriched === "object")
		return "windows-event";
	if ("Start" in raw && "Data" in raw && "Hora" in raw) return "process";
	return "process";
}

export function getMapper(logType: string): LogMapperContract {
	return mappers[logType] ?? mappers["process"];
}

/**
 * Retorna todos os descritores registrados.
 * Usado pela settings page para popular o select de tipo.
 *
 * Por que retornar array em vez de objeto?
 * Arrays têm ordem garantida — importantes para selects e listas.
 * Objetos não têm ordem confiável em todos os engines JS.
 */
export function getRegisteredTypes(): LogTypeDescriptor[] {
	return Object.values(descriptors);
}

/**
 * Registra um novo tipo de log em tempo de execução.
 *
 * Usado futuramente por conversores plugáveis:
 * quando o usuário "instalar" um novo conversor,
 * ele chama registerLogType() para torná-lo disponível.
 *
 * Por que `builtIn: false` como padrão?
 * Tipos registrados em runtime são contribuições do usuário —
 * ele deve poder removê-los. Built-ins não.
 */
export function registerLogType(
	descriptor: Omit<LogTypeDescriptor, "builtIn">,
	mapper: LogMapperContract,
): void {
	if (descriptors[descriptor.key]?.builtIn) {
		console.warn(
			`[LogMapperRegistry] Tentativa de sobrescrever tipo built-in "${descriptor.key}" ignorada.`,
		);
		return;
	}
	descriptors[descriptor.key] = { ...descriptor, builtIn: false };
	mappers[descriptor.key] = mapper;
}

/**
 * Remove um tipo registrado em runtime.
 * Tipos built-in não podem ser removidos.
 */
export function unregisterLogType(key: string): boolean {
	if (descriptors[key]?.builtIn) {
		console.warn(
			`[LogMapperRegistry] Tipo built-in "${key}" não pode ser removido.`,
		);
		return false;
	}
	delete descriptors[key];
	delete mappers[key];
	return true;
}
