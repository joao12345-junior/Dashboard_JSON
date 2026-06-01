// src/lib/plugins/pluginSetup.ts

import { registerPlugin } from "./converterRegistry";
import { EvtxConverterPlugin } from "./evtxConverterPlugin";

/**
 * Inicializa todos os plugins built-in do sistema.
 *
 * ─── Onde este arquivo é chamado? ────────────────────────────────────────────
 * Em src/main.tsx, ANTES de renderizar o React:
 *
 *   import { setupPlugins } from "./lib/plugins/pluginSetup";
 *   setupPlugins();
 *   ReactDOM.createRoot(...).render(<App />);
 *
 * Por que antes do React?
 * Porque quando a settings page renderizar pela primeira vez,
 * ela vai chamar getAllPlugins() — e precisa encontrar os built-ins já
 * registrados. Se chamar depois do React, há uma janela onde a UI
 * renderiza antes dos plugins estarem prontos.
 *
 * ─── Padrão: Composition Root ────────────────────────────────────────────────
 * Este arquivo é o "Composition Root" da Clean Architecture.
 * É o único lugar do sistema onde todas as dependências são montadas juntas.
 * O resto do código não sabe como os plugins são criados — só sabe usá-los.
 *
 * Analogia: a planta elétrica de um prédio. Cada apartamento usa energia
 * sem saber de onde vem. A central elétrica (Composition Root) é o único
 * lugar que conecta tudo.
 *
 * ─── Como adicionar um novo plugin no futuro ─────────────────────────────────
 * 1. Crie o arquivo: src/lib/plugins/SyslogConverterPlugin.ts
 *    (implementando IConverterPlugin)
 * 2. Importe e registre aqui:
 *    import { SyslogConverterPlugin } from "./SyslogConverterPlugin";
 *    registerPlugin(SyslogConverterPlugin);
 * 3. Pronto. A settings page, o select de tipos, o LogRepository —
 *    tudo passa a suportar o novo formato automaticamente.
 */
export function setupPlugins(): void {
	registerPlugin(EvtxConverterPlugin);

	// Registre novos plugins aqui quando criados:
	// registerPlugin(SyslogConverterPlugin);
	// registerPlugin(CsvConverterPlugin);
	// registerPlugin(IisAccessLogPlugin);
}
