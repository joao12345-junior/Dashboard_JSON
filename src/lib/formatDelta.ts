// src/lib/formatDelta.ts

export interface DeltaText {
	/** Símbolo decorativo (aria-hidden na tela): o texto já diz "a mais"/"a menos". */
	symbol: "▲" | "▼" | "=";
	text: string;
	/** true quando hoje está pior que ontem (mais erros/avisos). */
	worse: boolean;
}

/**
 * Variação de hoje contra "ontem até a mesma hora" (comparação justa: hoje é um
 * dia em andamento). Mesma frase no painel de erros e nos cartões de resumo.
 *
 *   describeDelta(-39, "17:51") → "39 a menos que ontem até 17:51"
 *   describeDelta(0, "17:51")   → "igual a ontem até 17:51"
 */
export function describeDelta(delta: number, hour: string): DeltaText {
	if (delta === 0) {
		return { symbol: "=", text: `igual a ontem até ${hour}`, worse: false };
	}
	const worse = delta > 0;
	const amount = Math.abs(delta).toLocaleString("pt-BR");
	return {
		symbol: worse ? "▲" : "▼",
		text: `${amount} a ${worse ? "mais" : "menos"} que ontem até ${hour}`,
		worse,
	};
}
