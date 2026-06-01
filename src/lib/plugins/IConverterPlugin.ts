// src/lib/plugins/IConverterPlugin.ts

import type { LogMapperContract } from "../data/LogMapperRegistry";

/**
 * Contrato que todo conversor de log deve implementar.
 *
 * ─── Por que uma interface em vez de uma classe abstrata? ────────────────────
 * Em TypeScript, interfaces definem CONTRATOS — elas dizem "o que" um objeto
 * precisa ter, sem dizer "como" implementar. Classes abstratas também definem
 * contratos, mas forçam herança — e herança cria acoplamento forte.
 *
 * Interfaces permitem que cada plugin seja independente. Um plugin pode ser
 * uma classe, um objeto literal, ou qualquer estrutura — desde que implemente
 * todos os campos definidos aqui.
 *
 * ─── Analogia ────────────────────────────────────────────────────────────────
 * Pense em uma tomada elétrica. A especificação da tomada (tensão, frequência,
 * formato dos pinos) é o contrato. Qualquer aparelho que respeita essa
 * especificação funciona — não importa o que ele faz internamente.
 * Esta interface é a especificação da "tomada" do LogDash.
 *
 * ─── Plugin Architecture ─────────────────────────────────────────────────────
 * Este é o padrão "Plugin" da Clean Architecture (Uncle Bob).
 * O sistema central (LogDash) não depende dos plugins — os plugins dependem
 * do sistema central. A direção da dependência é sempre do plugin para o core.
 */
export interface IConverterPlugin {
	/**
	 * Identificador único do plugin.
	 * Usado como chave no registry e no localStorage.
	 * Convenção: kebab-case, ex: "evtx-v2", "syslog-rfc5424"
	 */
	readonly id: string;

	/** Nome legível para exibição na UI */
	readonly name: string;

	/** Descrição do que o conversor faz e qual formato processa */
	readonly description: string;

	/**
	 * Extensões de arquivo que este conversor aceita.
	 * Array porque um conversor pode aceitar múltiplas variantes.
	 * Exemplos: [".evtx"], [".log", ".txt"], [".csv"]
	 */
	readonly inputExtensions: string[];

	/**
	 * Comando para executar o script no servidor.
	 * Apenas informativo — o LogDash não executa scripts.
	 * Serve como documentação para o operador.
	 * Exemplo: "python evtx_converter_v2.py --input ./logs/"
	 */
	readonly serverCommand: string;

	/** Versão do conversor — exibida na UI para referência */
	readonly version: string;

	/**
	 * Se true, é um plugin embutido no sistema.
	 * Built-ins não podem ser removidos pelo usuário — apenas visualizados.
	 */
	readonly builtIn: boolean;

	/**
	 * O mapper TypeScript que sabe ler o JSON gerado por este conversor.
	 *
	 * ─── Por que o plugin carrega seu próprio mapper? ────────────────────────
	 * Porque converter e mapper são duas faces do mesmo formato.
	 * Se você tem um conversor para Syslog, você inevitavelmente tem
	 * um mapper para o JSON que ele gera. Manter os dois juntos no mesmo
	 * plugin garante que eles nunca fiquem dessincronizados.
	 *
	 * Isso é coesão: coisas que mudam juntas ficam juntas.
	 *
	 * Pode ser null para plugins registrados pela UI (conversores externos
	 * que o usuário cadastra manualmente) — nesse caso o sistema usa
	 * o mapper padrão correspondente ao logType.
	 */
	readonly mapper: LogMapperContract | null;

	/**
	 * Chave do logType que este plugin produz.
	 * Deve corresponder a uma chave no LogMapperRegistry.
	 * O sistema usa esse valor para registrar o mapper automaticamente.
	 */
	readonly outputLogType: string;

	/**
	 * Metadados extras — campo livre para informações adicionais.
	 * Exemplos de uso:
	 *   { "requiresPython": "3.8+", "outputFormat": "json-array" }
	 *   { "documentation": "https://..." }
	 */
	readonly metadata?: Record<string, string>;
}
