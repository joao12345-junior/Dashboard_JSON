// src/lib/plugins/evtxConverterPlugin.ts

import type { IConverterPlugin } from "./IConverterPlugin";
import { WindowsEventLogMapper } from "../data/mappers/WindowsEventLogMapper";

/**
 * Plugin que representa o evtx_converter_v2.py no sistema de plugins.
 *
 * ─── O que este arquivo NÃO faz ──────────────────────────────────────────────
 * Ele NÃO reimplementa a lógica de conversão Python.
 * O script `evtx_converter_v2.py` continua rodando no servidor, independente.
 *
 * ─── O que este arquivo FAZ ──────────────────────────────────────────────────
 * Ele "apresenta" o conversor existente ao sistema de plugins do LogDash.
 * É como um adaptador: o script Python não sabe que o sistema de plugins existe,
 * e o sistema de plugins não sabe como o Python funciona internamente.
 * Este arquivo faz a ponte entre os dois.
 *
 * ─── Padrão Adapter ──────────────────────────────────────────────────────────
 * Este é o padrão "Adapter" do Gang of Four (GoF).
 * Você tem uma interface existente (o conversor Python) e uma interface
 * esperada (IConverterPlugin). O Adapter traduz uma para a outra sem
 * modificar nenhuma das duas.
 *
 * Analogia: um adaptador de tomada de viagem. A tomada do país não muda,
 * o aparelho não muda — o adaptador no meio faz a compatibilidade.
 */
export const EvtxConverterPlugin: IConverterPlugin = {
	id: "evtx-v2",
	name: "Windows Event Log (.evtx)",
	description:
		"Converte arquivos .evtx do Windows Event Log para JSON estruturado. " +
		"Gera campos _enriched com descrição e criticidade de cada EventID. " +
		"Requer Python 3.8+ no servidor onde os arquivos .evtx estão armazenados.",
	inputExtensions: [".evtx"],
	serverCommand: "python evtx_converter_v2.py",
	version: "2.0",
	builtIn: true,
	outputLogType: "windows-event",

	// O mapper já existia — aqui apenas o referenciamos dentro do plugin
	// Isso garante que converter e mapper ficam juntos no mesmo lugar
	mapper: WindowsEventLogMapper,

	metadata: {
		requiresPython: "3.8+",
		outputFormat: "json-array",
		outputFields: "_enriched, EventID, Level, Provider, Computer, TimeCreated",
		documentation:
			"Veja evtx_converter_v2.py na raiz do projeto para configuração.",
	},
} as const;
