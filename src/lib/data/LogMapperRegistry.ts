import { ProcessLogMapper } from "./mappers/ProcessLogMapper";
import { Log } from "../types/Log";
import { ColumnDefinition } from "../types/ColumnDefinition";

/**
 * Contrato que todo Mapper deve implementar.
 * Qualquer mapper novo precisa ter exatamente esses dois métodos.
 *
 * Isso é um "Port" na Arquitetura Hexagonal: define o que o sistema
 * espera, sem se importar com quem implementa.
 */
export interface LogMapperContract {
	toLog: (raw: Record<string, unknown>) => Log;
	toLogList: (raws: Record<string, unknown>[]) => Log[];
	// Cada mapper declara as colunas que quer exibir na tabela
	columns: ColumnDefinition[];
}

/**
 * Detecta o tipo do log com base nos campos presentes no JSON.
 * Cada tipo de log tem uma "assinatura" de campos que o identifica.
 */
export function detectLogType(raw: Record<string, unknown>): string {
	if ("Start" in raw && "Data" in raw && "Hora" in raw) return "process";
	// Futuros tipos serão detectados aqui:
	// if ("level" in raw && "timestamp" in raw) return "payment";
	return "process"; // fallback: se não reconhece, tenta como process
}

/**
 * Registry central: mapeia logType → Mapper responsável.
 *
 * Para adicionar um novo tipo de log no futuro:
 *   1. Crie o arquivo em mappers/NovoTipoMapper.ts
 *   2. Adicione UMA linha aqui: novoTipo: NovoTipoMapper
 *   Nenhum outro arquivo precisa ser alterado.
 */
const registry: Record<string, LogMapperContract> = {
	process: ProcessLogMapper as LogMapperContract,
};

/**
 * Retorna o mapper correto para o logType informado.
 * Se o tipo não estiver registrado, usa "process" como fallback.
 */
export function getMapper(logType: string): LogMapperContract {
	return registry[logType] ?? registry["process"];
}
