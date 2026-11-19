// src/lib/parseTimestamp.ts

/**
 * Separa um timestamp ISO 8601 em data e hora "de relógio" (sem fuso).
 *
 * Entrada típica vem de `datetime.isoformat()` do Python (colunas TIMESTAMPTZ):
 *   "2026-09-17T19:12:14.123456+00:00" → { date: "2026-09-17", time: "19:12:14" }
 *   "2026-09-17T19:12:14-03:00"        → { date: "2026-09-17", time: "19:12:14" }
 *   "2026-09-17T19:12:14Z"             → { date: "2026-09-17", time: "19:12:14" }
 *
 * Por que existe: o `isoformat()` do Python OMITE a fração de segundo quando
 * os microssegundos são 0. Sem fração, o sufixo de fuso ("-03:00") não era
 * removido por quem cortava só no ".", e a hora aparecia como "19:12:14-03:00"
 * (e quebrava a ordenação por `${date}T${time}`). Aqui o corte é no primeiro
 * "." / "Z" / "+" / "-" da parte da hora, então qualquer combinação funciona.
 *
 * Decisão consciente: NÃO converte de fuso. Mantém os dígitos que vieram do
 * banco, exatamente como o código fazia antes (a tela já mostra os horários
 * certos). Converter aqui deslocaria horários que hoje estão corretos.
 */
export function parseTimestamp(timestamp: string): {
	date: string;
	time: string;
} {
	const [datePart = "", timePart = ""] = timestamp.split("T");
	const time = timePart.split(/[.Zz+-]/)[0];
	return { date: datePart, time };
}
