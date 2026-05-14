// ═══════════════════════════════════════
// DATA LAYER — LogMapper (Adapter)
// ═══════════════════════════════════════
// Único lugar que conhece o schema externo (RawLog) e o interno (Log).
export const LogMapper = {
	/** @param {{ message:string, Data:string, Hora:string, Start:0|1|2 }} raw */
	toLog: (raw: object) => ({
		message: raw.message,
		date: raw.Data,
		time: raw.Hora,
		status: Number(raw.Start ?? 0),
	}),
	toLogList: (rawLogs: File[]) => rawLogs.map(LogMapper.toLog),
};
