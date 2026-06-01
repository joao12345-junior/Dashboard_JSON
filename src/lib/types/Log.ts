// types/Log.ts

/**
 * Contrato mínimo — presente em qualquer tipo de log do sistema.
 * Campos universais que a UI sempre pode acessar com segurança.
 */
export interface BaseLog {
	message: string; // descrição legível do evento
	date: string; // sempre yyyy-mm-dd após o Mapper
	time: string; // sempre HH:MM:SS após o Mapper
	status: number; // 0 = ok/finalizado, 1 = ativo, 2 = erro
	logType: string; // identifica qual mapper gerou este log
}

/**
 * Log de processo interno (backups, rotinas do sistema próprio).
 * Estrutura simples — campos do BaseLog são suficientes.
 * O payload existe para flexibilidade futura, mas não é obrigatório.
 */
export interface ProcessLog extends BaseLog {
	logType: "process";
	payload: Record<string, unknown>;
}

/**
 * Log do Windows Event Log (gerado pelo conversor Python).
 * Estende BaseLog com campos específicos do schema do Windows.
 *
 * Cada campo aqui vem do bloco _enriched gerado pelo Python —
 * não precisamos mais navegar estruturas aninhadas no frontend.
 */
export interface WindowsEventLog extends BaseLog {
	logType: "windows-event";
	// message (do BaseLog) ← recebe _enriched.description
	// status (do BaseLog)  ← mapeado do level numérico
	criticality: "High" | "Medium" | "Low" | "Unknown";
	source: "rendered" | "dictionary" | "unknown";
	computer: string;
	channel: string;
	eventId: string;
	recordId: string;
	level: string; // preserva o valor original do Windows ("1","2","3")
	levelLabel: string; // "Crítico", "Erro", "Aviso" — para exibição
	provider: string;
}

/**
 * União discriminada — o campo logType identifica qual tipo é qual.
 *
 * "União discriminada" é um padrão TypeScript onde um campo literal
 * (logType: "process" | "windows-event") permite ao compilador
 * saber exatamente qual interface está em uso em cada contexto.
 */
export type Log = ProcessLog | WindowsEventLog;
