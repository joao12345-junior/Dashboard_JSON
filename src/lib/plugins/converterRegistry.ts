// src/lib/plugins/converterRegistry.ts

import type { IConverterPlugin } from "./IConverterPlugin";
import {
	registerLogType,
	unregisterLogType,
	getRegisteredTypes,
} from "../data/LogMapperRegistry";

/**
 * Registry central de plugins de conversão.
 *
 * ─── Responsabilidade Única (SRP) ────────────────────────────────────────────
 * Este módulo faz exatamente uma coisa: gerenciar o ciclo de vida dos plugins.
 * Ele não sabe converter arquivos, não sabe renderizar UI, não sabe fazer fetch.
 * Só registra, desregistra e lista.
 *
 * ─── Por que um módulo separado do LogMapperRegistry? ───────────────────────
 * O LogMapperRegistry é o registry de MAPPERS — ele mapeia JSON → objeto Log.
 * Este é o registry de PLUGINS — ele gerencia a informação completa do plugin
 * (metadados, mapper, comando, extensões, etc.).
 *
 * Eles se comunicam: quando um plugin é registrado aqui, seu mapper é
 * automaticamente registrado no LogMapperRegistry. Mas cada um tem sua
 * responsabilidade própria.
 *
 * ─── Padrão Singleton implícito ──────────────────────────────────────────────
 * O registry usa um Map no escopo do módulo (fora de qualquer função).
 * Em JavaScript/TypeScript, módulos são singletons — o mesmo Map é
 * compartilhado em toda a aplicação. Não precisamos de uma classe Singleton
 * explícita porque o sistema de módulos já garante isso.
 */

// Armazenamento interno — Map em vez de objeto puro porque:
// 1. Map preserva ordem de inserção
// 2. Map tem métodos nativos (has, delete, values)
// 3. Map é mais semântico para dicionários dinâmicos
const _plugins = new Map<string, IConverterPlugin>();

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Registra um plugin no sistema.
 *
 * Efeitos colaterais controlados:
 * - Adiciona o plugin ao registry interno
 * - Registra o mapper no LogMapperRegistry (se o plugin fornecer um)
 *
 * "Efeito colateral controlado" significa que a função faz mais de uma
 * coisa, mas de forma documentada e previsível — não escondida.
 *
 * @param plugin Objeto que implementa IConverterPlugin
 * @returns true se registrado, false se o ID já existe e é built-in
 */
export function registerPlugin(plugin: IConverterPlugin): boolean {
	const existing = _plugins.get(plugin.id);

	// Protege built-ins de serem sobrescritos
	if (existing?.builtIn) {
		console.warn(
			`[ConverterRegistry] Plugin built-in "${plugin.id}" não pode ser sobrescrito.`,
		);
		return false;
	}

	_plugins.set(plugin.id, plugin);

	// Registra o mapper no LogMapperRegistry para que o LogRepository
	// consiga usar o tipo correto ao carregar arquivos desta fonte
	if (plugin.mapper) {
		registerLogType(
			{
				key: plugin.outputLogType,
				label: plugin.name,
				description: plugin.description,
			},
			plugin.mapper,
		);
	}

	return true;
}

/**
 * Remove um plugin registrado pelo usuário.
 * Plugins built-in não podem ser removidos.
 *
 * @returns true se removido, false se não encontrado ou built-in
 */
export function unregisterPlugin(id: string): boolean {
	const plugin = _plugins.get(id);

	if (!plugin) return false;

	if (plugin.builtIn) {
		console.warn(
			`[ConverterRegistry] Plugin built-in "${id}" não pode ser removido.`,
		);
		return false;
	}

	_plugins.delete(id);

	// Remove o mapper do LogMapperRegistry também
	// para manter os dois registries sincronizados
	unregisterLogType(plugin.outputLogType);

	return true;
}

/**
 * Retorna todos os plugins registrados como array.
 * Built-ins sempre aparecem primeiro (ordenados por nome).
 */
export function getAllPlugins(): IConverterPlugin[] {
	const all = Array.from(_plugins.values());
	return [
		...all
			.filter((p) => p.builtIn)
			.sort((a, b) => a.name.localeCompare(b.name)),
		...all
			.filter((p) => !p.builtIn)
			.sort((a, b) => a.name.localeCompare(b.name)),
	];
}

/**
 * Retorna um plugin pelo ID.
 * Retorna undefined se não encontrado — não lança exceção.
 *
 * Por que não lançar exceção?
 * Exceções devem ser reservadas para situações verdadeiramente excepcionais.
 * "Buscar um item que pode não existir" é um caso normal — undefined é a
 * resposta semântica correta.
 */
export function getPlugin(id: string): IConverterPlugin | undefined {
	return _plugins.get(id);
}

/**
 * Verifica se um plugin está registrado.
 */
export function hasPlugin(id: string): boolean {
	return _plugins.has(id);
}

/**
 * Retorna os logTypes registrados por plugins (exceto os built-in do
 * LogMapperRegistry que existiam antes de qualquer plugin).
 * Útil para debug e para a UI de configurações.
 */
export function getPluginLogTypes(): string[] {
	return Array.from(_plugins.values()).map((p) => p.outputLogType);
}
