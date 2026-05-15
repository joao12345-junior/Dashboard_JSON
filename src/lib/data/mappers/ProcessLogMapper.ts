// src/lib/data/mappers/ProcessLogMapper.ts
import { Log } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";

type RawProcessLog = {
	message: string;
	Data: string;
	Hora: string;
	Start: unknown;
};

function normalizeDate(raw: string): string {
	const parts = raw.split("/");
	if (parts.length !== 3) return raw;
	const [day, month, year] = parts;
	return `20${year}-${month}-${day}`;
}

function parseStatus(value: unknown): number {
	const num = Number(value ?? 0);
	return [0, 1, 2].includes(num) ? num : 0;
}

export const ProcessLogMapper = {
	// Parâmetro agora é Record<string, unknown> para satisfazer o LogMapperContract
	toLog: (raw: Record<string, unknown>): Log => {
		// Cast interno seguro — detectLogType já confirmou que os campos existem
		const typed = raw as RawProcessLog;
		return {
			logType: "process",
			message: typed.message ?? "",
			date: normalizeDate(typed.Data ?? ""),
			time: String(typed.Hora ?? "").trim(),
			status: parseStatus(typed.Start),
			payload: {},
		};
	},

	toLogList: (raws: Record<string, unknown>[]): Log[] =>
		raws.map(ProcessLogMapper.toLog),

	columns: [
		{
			key: "message",
			label: "Mensagem",
			mono: true,
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
			render: (log: Log) => log.time,
		},
	] satisfies ColumnDefinition[],
};
