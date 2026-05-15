/**
 * Campos universais presentes em qualquer tipo de log,
 * independente da fonte ou sistema de origem.
 */
export interface BaseLog {
	message: string;
	date: string; // sempre yyyy-mm-dd após o Mapper
	time: string;
	status: number;
}

/**
 * Log completo: campos universais + identificador de tipo + payload livre.
 *
 * O campo `logType` permite que a UI e os filtros saibam de qual
 * sistema o log veio (ex: "process", "payment", "auth").
 *
 * O campo `payload` é um envelope para campos extras específicos
 * de cada tipo, sem poluir a interface base.
 */
export interface Log extends BaseLog {
	logType: string;
	payload: Record<string, unknown>;
}
