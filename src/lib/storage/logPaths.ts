// src/lib/storage/logPaths.ts

import type { IConverterPlugin } from "../plugins/IConverterPlugin";

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Representa uma fonte de dados configurada pelo usuário.
 *
 * Arquitetura Hexagonal (Alistair Cockburn):
 * Este tipo é a "porta de saída" — o contrato entre o domínio e a
 * infraestrutura de armazenamento. O LogRepository é o "adapter" que
 * consome esse contrato para saber onde buscar dados.
 */
export interface LogSource {
	/** Identificador técnico único: "process", "windows-security", etc. */
	alias: string;
	/**
	 * URL base do diretório servido.
	 * Exemplos:
	 *   /data                               → relativo ao Vite (local)
	 *   http://192.168.1.200:9200/data/sec  → servidor externo
	 */
	url: string;
	/**
	 * Tipo de log — define qual mapper será usado.
	 * Deve corresponder a uma chave registrada no LogMapperRegistry.
	 * Usar string em vez de union fixa porque tipos podem ser
	 * registrados dinamicamente pelos conversores.
	 */
	logType: string;
	/** Permite desativar sem remover */
	enabled: boolean;
	/** Rótulo exibido na UI */
	label: string;
}

export interface ApiConfig {
	url: string;
	enabled: boolean;
}

// ── Chaves de storage ─────────────────────────────────────────────────────────

/**
 * Chave v2: formato novo com LogSource[] em vez de string[].
 * Chave diferente da versão antiga (LOG_PATHS_KEY = "logPaths")
 * para evitar conflito com dados incompatíveis no localStorage.
 *
 * Por que versionar a chave?
 * localStorage não tem migrations automáticas. Se o formato muda
 * e a chave é a mesma, o JSON.parse retorna a estrutura antiga
 * e o código quebra de formas imprevisíveis.
 */
const PLUGINS_KEY = "logdash:converters:v1";
const SOURCES_KEY = "logdash:sources:v2";
const LOG_TYPES_KEY = "logdash:logtype:v3";
const API_CONFIG_KEY = "logdash:API:v4";

// ── Fontes padrão ─────────────────────────────────────────────────────────────

/**
 * Espelha o comportamento atual: carrega de /data (public/data do Vite).
 * Garante que quem ainda não configurou nada continue funcionando.
 */
const DEFAULT_SOURCES: LogSource[] = [
	{
		alias: "local-data/windows_logs",
		url: "/data/windows_logs",
		logType: "windows-event",
		enabled: true,
		label: "Dados Locais (public/data/windows_logs)",
	},
];

const DEFAULT_API_CONFIG: ApiConfig = {
	url: "http://localhost:8765",
	enabled: true,
};

// ── API pública — Sources ─────────────────────────────────────────────────────

export function loadLogSources(): LogSource[] {
	try {
		const raw = localStorage.getItem(SOURCES_KEY);
		if (!raw) return DEFAULT_SOURCES;
		const parsed = JSON.parse(raw) as LogSource[];
		if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SOURCES;
		return parsed;
	} catch {
		return DEFAULT_SOURCES;
	}
}

export function saveLogSources(sources: LogSource[]): void {
	try {
		localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
	} catch {
		console.warn("[logPaths] Falha ao salvar fontes no localStorage");
	}
}

export function loadLogTypes(): string[] {
	try {
		const raw = localStorage.getItem(LOG_TYPES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as string[];
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

export function saveLogTypes(types: string[]): void {
	try {
		localStorage.setItem(LOG_TYPES_KEY, JSON.stringify(types));
	} catch {
		console.warn("[logPaths] Falha ao salvar tipos de log no localStorage");
	}
}

export function resetLogSources(): LogSource[] {
	saveLogSources(DEFAULT_SOURCES);
	return DEFAULT_SOURCES;
}

export function loadEnabledSources(): LogSource[] {
	return loadLogSources().filter((s) => s.enabled);
}

// ── API pública — Converters ──────────────────────────────────────────────────

export function saveCustomPlugins(plugins: IConverterPlugin[]): void {
	try {
		const custom = plugins.filter((p) => !p.builtIn);
		localStorage.setItem(PLUGINS_KEY, JSON.stringify(custom));
	} catch {
		console.warn("[logPaths] Falha ao salvar plugins no localStorage");
	}
}

export function loadCustomPlugins(): IConverterPlugin[] {
	try {
		const raw = localStorage.getItem(PLUGINS_KEY);
		if (!raw) return [];

		const parsed = JSON.parse(raw) as IConverterPlugin[];
		if (!Array.isArray(parsed)) return [];

		return parsed.map((p) => ({ ...p, builtIn: false, mapper: null }));
	} catch {
		return [];
	}
}

// ── API pública — API ──────────────────────────────────────────────────

export function loadApiConfig(): ApiConfig {
	try {
		const raw = localStorage.getItem(API_CONFIG_KEY);
		if (!raw) return DEFAULT_API_CONFIG;
		const parsed = JSON.parse(raw) as ApiConfig;
		if (!parsed.url) return DEFAULT_API_CONFIG;
		return parsed;
	} catch {
		return DEFAULT_API_CONFIG;
	}
}

export function saveApiConfig(config: ApiConfig): void {
	try {
		localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config));
	} catch {
		console.warn("[logPaths] Falha ao salvar fontes no localStorage");
	}
}
