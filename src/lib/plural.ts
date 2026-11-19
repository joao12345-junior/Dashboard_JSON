// src/lib/plural.ts

/**
 * "1 erro", "5 erros", "0 erros" — com separador de milhar pt-BR.
 * Troca os "erro(s)" soltos pela forma correta.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
	return `${count.toLocaleString("pt-BR")} ${count === 1 ? singular : pluralForm}`;
}
