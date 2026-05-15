// ═══════════════════════════════════════
// DATA LAYER — LogMapper (Adapter)
// ═══════════════════════════════════════

import { RawLog } from "../types/RawLog";

function normalizeDate(raw: string): string {
	const parts = raw.split("/");

	// Garante que o formato tem exatamente 3 partes antes de reordenar]
	if (parts.length !== 3) return raw;
	const [day, month, year] = parts;
	return `20${year}-${month}-${day}`;
}

// Único lugar que conhece o schema externo (RawLog) e o interno (Log).
export const LogMapper = {
	/** @param {{ message:string, Data:string, Hora:string, Start:0|1|2 }} raw */
	toLog: (raw: RawLog) => ({
		message: raw.message,
		date: normalizeDate(raw.Data),
		time: raw.Hora,
		status: Number(raw.Start ?? 0),
	}),
	toLogList: (rawLogs: RawLog[]) => rawLogs.map(LogMapper.toLog),
};
