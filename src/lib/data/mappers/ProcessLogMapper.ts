// src/lib/data/mappers/ProcessLogMapper.ts
import { Log } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";
import { ProcessLog } from "../../types/Log";

type RawProcessLog = {
	// Formato banco (API)
	log_date?: string;
	log_time?: string;
	start?: unknown;
	// Formato arquivo JSON (legado)
	Data?: string;
	Hora?: string;
	Start?: unknown;
	// Comum aos dois
	message?: string;
	Message?: string;
};

function normalizeDate(raw: string): string {
	const parts = raw.split("/");
	if (parts.length !== 3) return raw;
	const [day, month, year] = parts;
	// Se o ano já tem 4 dígitos, usa direto
	const fullYear = year.length === 4 ? year : `20${year}`;
	return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeTime(raw: string): string {
	const parts = raw.split(".").reverse().pop();
	if (parts == undefined) return "Erro ao normalizar tempo";
	return parts;
}

function parseStatus(value: unknown): number {
	const num = Number(value ?? 0);
	return [0, 1, 2].includes(num) ? num : 0;
}

export const ProcessLogMapper = {
	// Parâmetro agora é Record<string, unknown> para satisfazer o LogMapperContract
	toLog: (raw: Record<string, unknown>): ProcessLog => {
		// Cast interno seguro — detectLogType já confirmou que os campos existem
		const typed = raw as RawProcessLog;
		return {
			logType: "process",
			message: String(typed.Message ?? typed.message ?? ""),
			date: normalizeDate(String(typed.log_date ?? typed.Data ?? "")),
			time: String(typed.log_time ?? typed.Hora ?? "").trim(),
			status: parseStatus(typed.start ?? typed.Start),
			payload: {},
		};
	},

	toLogList: (raws: Record<string, unknown>[]): ProcessLog[] =>
		raws.map(ProcessLogMapper.toLog),

	columns: [
		{
			key: "message",
			label: "Mensagem",
			mono: true,
			noWrap: true,
			render: (log: Log) => log.message,
		},
		{
			key: "date",
			label: "Data",
			width: 120,
			muted: true,
			noWrap: true,
			numeric: true,
			hideOnMobile: true,
			render: (log: Log) => normalizeDateToView(log.date),
		},
		{
			key: "time",
			label: "Hora",
			width: 100,
			mono: true,
			muted: true,
			noWrap: true,
			hideOnMobile: true,
			render: (log: Log) => normalizeTime(log.time),
		},
	] satisfies ColumnDefinition[],
};
