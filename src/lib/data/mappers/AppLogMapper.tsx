// src/lib/data/mappers/AppLogMapper.ts
import { FileText } from "lucide-react";
import { AppLog } from "../../types/Log";
import { ColumnDefinition } from "../../types/ColumnDefinition";
import { normalizeDateToView } from "../../normalizeDateToView";
import { AppTypeBadge } from "../../../features/app-logs/components/AppTypeBadge";

type RawAppLog = {
	id?: unknown;
	classe: unknown;
	programa: unknown;
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
			id: Number(row.id ?? 0),
			message: parseString(row.mensagem),
			date,
			time,
			classe: parseString(row.classe),
			programa: typeof row.programa === "string" ? row.programa : null,
			tipo,
			detalhes: typeof row.detalhes === "string" ? row.detalhes : undefined,
		};
	},

	toLogList: (raws: Record<string, unknown>[]): AppLog[] =>
		raws.map(AppLogMapper.toLog),

	columns: [
		{
			key: "programa",
			label: "Programa",
			width: 150,
			noWrap: true,
			hideOnMobile: true,
			// "Sem programa" -- mesmo texto usado em useAppStats.ts pro agrupamento
			// quando programa ainda e null (coluna pendente de virar NOT NULL).
			render: (log) =>
				log.logType === "app" ? (log.programa ?? "Sem programa") : "",
		},
		{
			key: "classe",
			label: "Classe",
			width: 160,
			noWrap: true,
			hideOnMobile: true,
			render: (log) => (log.logType === "app" ? log.classe : ""),
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
			// Linha com "detalhes" preenchido ganha um icone antes da mensagem --
			// sinaliza que ha mais informacao por tras do clique sem depender so
			// do cursor (que so aparece no hover, nao "descobre" a funcionalidade).
			// title no <span> compensa a <td> perder o tooltip de texto completo
			// quando o render vira JSX em vez de string pura (LogTable.extractTextValue
			// só extrai title de string/number).
			render: (log) =>
				log.logType === "app" && log.detalhes ? (
					<span
						title={log.message}
						style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
					>
						<FileText size={14} color="var(--muted-foreground)" aria-hidden />
						{log.message}
					</span>
				) : (
					log.message
				),
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
