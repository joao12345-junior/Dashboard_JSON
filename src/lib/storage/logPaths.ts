// src/lib/storage/logPaths.ts

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

/**
 * Representa um conversor de log instalado pelo usuário.
 *
 * Um conversor é diferente de um mapper:
 * - Mapper: sabe transformar JSON bruto → Log (roda no frontend)
 * - Converter: sabe transformar formato externo → JSON (roda como script)
 *
 * A settings page gerencia os metadados do conversor.
 * O script em si (Python, PowerShell, etc.) fica no servidor.
 */
export interface ConverterEntry {
	/** Identificador único do conversor */
	id: string;
	/** Nome exibido na UI */
	name: string;
	/** Descrição do formato que o conversor processa */
	description: string;
	/** Extensão de entrada: ".evtx", ".log", ".csv", etc. */
	inputExtension: string;
	/**
	 * Caminho ou comando para executar o conversor no servidor.
	 * Apenas informativo por enquanto — o frontend não executa scripts.
	 * Exemplo: "python evtx_converter_v2.py"
	 */
	command: string;
	/**
	 * Se true, é um conversor embutido no sistema (evtx_converter_v2.py).
	 * Built-ins aparecem na lista mas não podem ser removidos.
	 */
	builtIn: boolean;
	/** Versão do conversor — exibida na UI para referência */
	version: string;
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
const SOURCES_KEY = "logdash:sources:v2";
const CONVERTERS_KEY = "logdash:converters:v1";

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
	{
		alias: "local-data/process_logs",
		url: "/data/process_logs",
		logType: "process",
		enabled: true,
		label: "Dados Locais (public/data/process_logs)",
	},
];

/**
 * Conversores embutidos — espelham o que já existe no projeto.
 * builtIn: true impede remoção acidental pela UI.
 */
const DEFAULT_CONVERTERS: ConverterEntry[] = [
	{
		id: "evtx-v2",
		name: "Windows Event Log (.evtx)",
		description:
			"Converte arquivos .evtx do Windows para JSON estruturado com campos _enriched. " +
			"Requer Python 3.8+ no servidor onde os logs estão armazenados.",
		inputExtension: ".evtx",
		command: "python evtx_converter_v2.py",
		builtIn: true,
		version: "2.0",
	},
];

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

export function resetLogSources(): LogSource[] {
	saveLogSources(DEFAULT_SOURCES);
	return DEFAULT_SOURCES;
}

export function loadEnabledSources(): LogSource[] {
	return loadLogSources().filter((s) => s.enabled);
}

// ── API pública — Converters ──────────────────────────────────────────────────

export function loadConverters(): ConverterEntry[] {
	try {
		const raw = localStorage.getItem(CONVERTERS_KEY);
		if (!raw) return DEFAULT_CONVERTERS;
		const parsed = JSON.parse(raw) as ConverterEntry[];
		if (!Array.isArray(parsed)) return DEFAULT_CONVERTERS;

		// Garante que os built-ins sempre estão na lista,
		// mesmo que o localStorage esteja corrompido ou desatualizado
		const hasEvtx = parsed.some((c) => c.id === "evtx-v2");
		return hasEvtx ? parsed : [...DEFAULT_CONVERTERS, ...parsed];
	} catch {
		return DEFAULT_CONVERTERS;
	}
}

export function saveConverters(converters: ConverterEntry[]): void {
	try {
		localStorage.setItem(CONVERTERS_KEY, JSON.stringify(converters));
	} catch {
		console.warn("[logPaths] Falha ao salvar conversores no localStorage");
	}
}
