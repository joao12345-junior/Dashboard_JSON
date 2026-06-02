// src/lib/plugins/converterRegistry.ts
import type { IConverterPlugin } from "./IConverterPlugin";
import { registerLogType, unregisterLogType } from "../data/LogMapperRegistry";
import { saveCustomPlugins } from "../storage/logPaths"; // ← import novo

const _plugins = new Map<string, IConverterPlugin>();

export function registerPlugin(plugin: IConverterPlugin): boolean {
	const existing = _plugins.get(plugin.id);

	if (existing?.builtIn) {
		console.warn(
			`[ConverterRegistry] Plugin built-in "${plugin.id}" não pode ser sobrescrito.`,
		);
		return false;
	}

	_plugins.set(plugin.id, plugin);

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

	// Só persiste plugins customizados — built-ins são recriados pelo pluginSetup
	// e não devem acionar gravação no localStorage durante a inicialização
	if (!plugin.builtIn) {
		saveCustomPlugins(getAllPlugins());
	}

	return true;
}

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
	unregisterLogType(plugin.outputLogType);

	// Persiste após remoção — o plugin removido não vai mais aparecer
	saveCustomPlugins(getAllPlugins());
	return true;
}

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

// getPlugin, hasPlugin, getPluginLogTypes — sem mudança
export function getPlugin(id: string): IConverterPlugin | undefined {
	return _plugins.get(id);
}

export function hasPlugin(id: string): boolean {
	return _plugins.has(id);
}

export function getPluginLogTypes(): string[] {
	return Array.from(_plugins.values()).map((p) => p.outputLogType);
}
