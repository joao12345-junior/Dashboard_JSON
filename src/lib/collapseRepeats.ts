// src/lib/collapseRepeats.ts

/** Um item da lista: o registro mais recente + os repetidos logo em seguida. */
export interface CollapsedEntry<T> {
	head: T;
	rest: T[];
}

/**
 * Agrupa registros CONSECUTIVOS com a mesma "assinatura". A lista já vem
 * ordenada; só junta quem está colado, então não esconde nada entre eles.
 *
 * É só apresentação: nenhum registro é removido nem alterado (o contador
 * "×N" mostra quantos foram juntados). Mesma ideia da deduplicação por
 * assinatura do Grafana e dos "patterns" do Datadog.
 */
export function collapseRepeats<T>(
	items: T[],
	signatureOf: (item: T) => string,
): CollapsedEntry<T>[] {
	const entries: CollapsedEntry<T>[] = [];
	let lastSignature: string | null = null;

	for (const item of items) {
		const signature = signatureOf(item);
		const last = entries[entries.length - 1];
		if (last && signature === lastSignature) {
			last.rest.push(item);
		} else {
			entries.push({ head: item, rest: [] });
			lastSignature = signature;
		}
	}
	return entries;
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HEX_PREFIXED = /\b0x[0-9a-f]+\b/gi;
// Sequência hexadecimal longa (hash, id curto) com pelo menos um dígito, para não pegar palavras ("defaced").
const LONG_HEX = /\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b/gi;

/**
 * Tira de uma mensagem as partes que mudam a cada ocorrência, para "o mesmo erro"
 * ter sempre o mesmo texto:
 *   - GUID/UUID  → "<id>"   ("envio cdcbbaa1-5a75-…" e "envio 0f3e9a2b-77c1-…" são iguais)
 *   - 0x… e hex longo (hash) → "<hex>"
 *   - qualquer sequência de dígitos → "#"   ("chamado 142 → 200" = "chamado 143 → 200")
 *
 * Só serve para comparar/agrupar; o texto exibido nunca é alterado.
 * (Nome mantido por compatibilidade; antes só tratava números.)
 */
export function maskNumbers(text: string): string {
	return text
		.replace(UUID, "<id>")
		.replace(HEX_PREFIXED, "<hex>")
		.replace(LONG_HEX, "<hex>")
		.replace(/\d+/g, "#");
}
