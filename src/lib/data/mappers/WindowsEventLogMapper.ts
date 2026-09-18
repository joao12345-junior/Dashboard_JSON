// src/lib/data/mappers/WindowsEventLogMapper.ts
import { WindowsEventLog } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";

// ── Funções de parse — cada uma valida e converte um campo ──────────────────

function parseString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseCriticality(value: unknown): WindowsEventLog["criticality"] {
	if (value === "High" || value === "Medium" || value === "Low") return value;
	return "Unknown";
}

// level numérico do Windows (smallint no banco, chega como number ou null)
// → status do BaseLog
// 1 = Critical, 2 = Error → 2 (erro)
// 3 = Warning              → 0 (finalizado/aviso)
// demais                   → 1 (ativo/info)
function levelToStatus(level: string): number {
	if (level === "1" || level === "2") return 2;
	if (level === "3") return 0;
	return 1;
}

// "2026-09-17T19:12:14.123456+00:00" → { date: "2026-09-17", time: "19:12:14" }
function parseTimestamp(timestamp: string): { date: string; time: string } {
	const [datePart = "", timePart = ""] = timestamp.split("T");
	const time = timePart.split(".")[0].replace("Z", "");
	return { date: datePart, time };
}

// ── Mapper principal ────────────────────────────────────────────────────────
//
// Lê direto das colunas soltas que /api/logs?type=windows-event devolve
// (id, event_id, level, level_label, provider, computer, channel,
// time_created, message, criticality, summary, source_file, created_at).
// Antes este mapper lia um bloco raw._enriched que só existia no formato de
// arquivo do conversor antigo (evtx_converter_v2.py) -- nunca existiu na
// resposta da API, então todo log chegava em branco/"Unknown" (QUAL-6).
//
// Campos que existiam no formato antigo e não têm coluna equivalente no
// banco (recordId, source: "rendered"/"dictionary") ficam vazio/"unknown" --
// não dá pra reconstruir informação que não foi persistida.
export const WindowsEventLogMapper = {
	toLog: (raw: Record<string, unknown>): WindowsEventLog => {
		const level = raw.level != null ? String(raw.level) : "";
		const { date, time } = parseTimestamp(parseString(raw.time_created));

		return {
			logType: "windows-event",
			id: Number(raw.id ?? 0),
			message: parseString(raw.message),
			date,
			time,
			status: levelToStatus(level),
			criticality: parseCriticality(raw.criticality),
			source: "unknown",
			computer: parseString(raw.computer),
			channel: parseString(raw.channel),
			eventId: parseString(raw.event_id),
			recordId: "",
			level,
			levelLabel: parseString(raw.level_label),
			provider: parseString(raw.provider),
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
