// src/features/network/severity.ts

/** Faixa de gravidade de um evento de rede (escala CEF 0–10). */
export type SeverityTone = "high" | "medium" | "low" | "unknown";

/// <summary>
/// Converte a gravidade CEF (0–10, ou null) numa faixa. 0–3 baixa, 4–6 média,
/// 7–10 alta. Os limites seguem a convenção do CEF; o UniFi usa valores baixos
/// (1–2 nos eventos vistos até agora).
/// </summary>
export function severityTone(severity: number | null): SeverityTone {
	if (severity === null) return "unknown";
	if (severity >= 7) return "high";
	if (severity >= 4) return "medium";
	return "low";
}

const LABELS: Record<SeverityTone, string> = {
	high: "Alta",
	medium: "Média",
	low: "Baixa",
	unknown: "—",
};

/**
 * Cor da faixa lateral da linha. Baixa/desconhecida ficam num cinza discreto:
 * são a maioria, e uma faixa colorida em todas esconde o que importa.
 */
export function severityBarColor(severity: number | null): string {
	switch (severityTone(severity)) {
		case "high":
			return "var(--destructive)";
		case "medium":
			return "var(--chart-4)";
		default:
			return "color-mix(in oklch, var(--muted-foreground) 40%, transparent)";
	}
}

/**
 * Valor de `data-tipo` da linha: reaproveita o fundo de erro/aviso da lista de
 * Logs Gerais (style.css). Baixa e desconhecida ficam sem tom.
 */
export function severityRowTipo(severity: number | null): "erro" | "aviso" | undefined {
	const tone = severityTone(severity);
	if (tone === "high") return "erro";
	if (tone === "medium") return "aviso";
	return undefined;
}

/** Rótulo em português da faixa de gravidade. */
export function severityLabel(severity: number | null): string {
	return LABELS[severityTone(severity)];
}

/** Opções do filtro "Gravidade": valor = gravidade mínima (null = todas). */
export const SEVERITY_FILTER_OPTIONS: ReadonlyArray<{
	value: number | null;
	label: string;
}> = [
	{ value: null, label: "Todas" },
	{ value: 4, label: "Média ou maior" },
	{ value: 7, label: "Alta" },
];
