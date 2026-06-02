// src/lib/plugins/pluginSetup.ts
import { registerPlugin } from "./converterRegistry";
import { EvtxConverterPlugin } from "./evtxConverterPlugin";
import { loadCustomPlugins } from "../storage/logPaths"; // ← import novo

/**
 * Inicializa todos os plugins do sistema.
 * Deve ser chamado em main.tsx ANTES de renderizar o React.
 *
 * Ordem importa:
 * 1. Built-ins primeiro — sempre presentes, definidos em código
 * 2. Customizados depois — restaurados do localStorage
 *
 * Por que a ordem importa?
 * registerPlugin protege built-ins de serem sobrescritos.
 * Se um plugin customizado tiver o mesmo ID de um built-in
 * (situação de dados corrompidos), o built-in vence.
 */
export function setupPlugins(): void {
	// 1. Built-ins — sempre registrados, independente do localStorage
	registerPlugin(EvtxConverterPlugin);

	// 2. Customizados — restaurados do localStorage
	// mapper será null (JSON não serializa funções) — comportamento esperado
	for (const plugin of loadCustomPlugins()) {
		registerPlugin(plugin);
	}
}
