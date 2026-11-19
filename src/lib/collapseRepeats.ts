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

/** Troca sequências de dígitos por "#": "chamado 142 → 200" e "chamado 143 → 200" viram o mesmo padrão. */
export function maskNumbers(text: string): string {
	return text.replace(/\d+/g, "#");
}
