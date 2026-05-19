// src/lib/data/mappers/WindowsEventLogMapper.ts
import { WindowsEventLog } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";

// Tipo que representa o bloco _enriched gerado pelo Python
// Todos os campos são unknown para forçar validação explícita no mapper
type RawEnriched = {
	provider: unknown;
	eventId: unknown;
	recordId: unknown;
	level: unknown;
	levelLabel: unknown;
	criticality: unknown;
	description: unknown;
	source: unknown;
	computer: unknown;
	channel: unknown;
	timestamp: unknown;
};

// ── Funções de parse — cada uma valida e converte um campo ──────────────────

function parseString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseCriticality(value: unknown): WindowsEventLog["criticality"] {
	if (value === "High" || value === "Medium" || value === "Low") return value;
	return "Unknown";
}

function parseSource(value: unknown): WindowsEventLog["source"] {
	if (value === "rendered" || value === "dictionary") return value;
	return "unknown";
}

// level numérico do Windows → status do BaseLog
// 1 = Critical, 2 = Error → 2 (erro)
// 3 = Warning              → 0 (finalizado/aviso)
// demais                   → 1 (ativo/info)
function levelToStatus(level: string): number {
	if (level === "1" || level === "2") return 2;
	if (level === "3") return 0;
	return 1;
}

// "2021-07-11T18:39:17.6352909Z" → { date: "2021-07-11", time: "18:39:17" }
function parseTimestamp(timestamp: string): { date: string; time: string } {
	const [datePart = "", timePart = ""] = timestamp.split("T");
	const time = timePart.split(".")[0].replace("Z", "");
	return { date: datePart, time };
}

// ── Mapper principal ────────────────────────────────────────────────────────

export const WindowsEventLogMapper = {
	toLog: (raw: Record<string, unknown>): WindowsEventLog => {
		// _enriched pode não existir em arquivos antigos — fallback para {}
		const enriched = (raw._enriched ?? {}) as RawEnriched;

		const level = parseString(enriched.level);
		const timestamp = parseString(enriched.timestamp);
		const { date, time } = parseTimestamp(timestamp);

		return {
			logType: "windows-event",
			message: parseString(enriched.description), // BaseLog.message ← description
			date,
			time,
			status: levelToStatus(level),
			criticality: parseCriticality(enriched.criticality),
			source: parseSource(enriched.source),
			computer: parseString(enriched.computer),
			channel: parseString(enriched.channel),
			eventId: parseString(enriched.eventId),
			recordId: parseString(enriched.recordId),
			level,
			levelLabel: parseString(enriched.levelLabel),
			provider: parseString(enriched.provider),
		};
	},

	toLogList: (raws: Record<string, unknown>[]): WindowsEventLog[] =>
		raws.map(WindowsEventLogMapper.toLog),

	columns: [
		{
			key: "provider",
			label: "Provider",
			width: 180,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => (log.logType === "windows-event" ? log.provider : ""),
		},
		{
			key: "message",
			label: "Descrição",
			mono: true,
			noWrap: true,
			render: (log) => log.message,
		},
		{
			key: "channel",
			label: "Canal",
			width: 160,
			muted: true,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => (log.logType === "windows-event" ? log.channel : ""),
		},
		{
			key: "computer",
			label: "Máquina",
			width: 130,
			muted: true,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => (log.logType === "windows-event" ? log.computer : ""),
		},
		{
			key: "eventId",
			label: "Event ID",
			width: 90,
			numeric: true,
			noWrap: true,
			render: (log) => (log.logType === "windows-event" ? log.eventId : ""),
		},
		{
			key: "date",
			label: "Data",
			width: 110,
			muted: true,
			noWrap: true,
			numeric: true,
			hideOnMobile: true,
			render: (log) => normalizeDateToView(log.date),
		},
		{
			key: "time",
			label: "Hora",
			width: 90,
			mono: true,
			muted: true,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => log.time,
		},
	] satisfies ColumnDefinition[],
};
