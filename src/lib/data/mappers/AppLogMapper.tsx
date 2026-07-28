// src/lib/data/mappers/AppLogMapper.ts
import { AppLog } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";
import { AppTypeBadge } from "../../../features/app-logs/components/AppTypeBadge";

type RawAppLog = {
	origem: unknown;
	tipo: unknown;
	mensagem: unknown;
	detalhes: unknown;
	ocorrido_em: unknown;
};

function parseString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseTipo(value: unknown): AppLog["tipo"] {
	if (
		value === "debug" ||
		value === "info" ||
		value === "aviso" ||
		value === "erro"
	) {
		return value;
	}
	return "info";
}

// "2026-07-21T14:23:05.123Z" → { date: "2026-07-21", time: "14:23:05" }
function parseTimestamp(timestamp: string): { date: string; time: string } {
	const [datePart = "", timePart = ""] = timestamp.split("T");
	const time = timePart.split(".")[0].replace("Z", "");
	return { date: datePart, time };
}

export const AppLogMapper = {
	toLog: (raw: Record<string, unknown>): AppLog => {
		const row = raw as RawAppLog;
		const tipo = parseTipo(row.tipo);
		const { date, time } = parseTimestamp(parseString(row.ocorrido_em));

		return {
			logType: "app",
			message: parseString(row.mensagem),
			date,
			time,
			origem: parseString(row.origem),
			tipo,
			detalhes: typeof row.detalhes === "string" ? row.detalhes : undefined,
		};
	},

	toLogList: (raws: Record<string, unknown>[]): AppLog[] =>
		raws.map(AppLogMapper.toLog),

	columns: [
		{
			key: "origem",
			label: "Origem",
			width: 160,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => (log.logType === "app" ? log.origem : ""),
		},
		{
			key: "tipo",
			label: "Tipo",
			width: 90,
			noWrap: true,
			render: (log) =>
				log.logType === "app" ? <AppTypeBadge tipo={log.tipo} /> : "",
		},
		{
			key: "message",
			label: "Mensagem",
			mono: true,
			noWrap: true,
			render: (log) => log.message,
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
