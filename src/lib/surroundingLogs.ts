// src/lib/surroundingLogs.ts

type ContextLog = { id: number; date: string; time: string; programa: string | null };

/**
 * Registros do MESMO programa logo antes e logo depois de `target`, mais o
 * próprio `target`, do mais novo para o mais antigo ("eventos ao redor" do
 * Datadog / "log context" do Grafana). Ignora os filtros da tela de propósito:
 * contexto é o que aconteceu em volta, não só o que casa com a busca.
 */
export function surroundingLogs<T extends ContextLog>(
	all: T[],
	target: T,
	before = 5,
	after = 5,
): T[] {
	const sameProgram = all
		.filter((log) => log.programa === target.programa)
		.sort(
			(a, b) =>
				`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.id - b.id,
		);
	const index = sameProgram.findIndex((log) => log.id === target.id);
	if (index === -1) return [target];
	// ascendente: [mais antigos ... target ... mais novos] → inverte para novo→antigo
	return sameProgram.slice(Math.max(0, index - before), index + after + 1).reverse();
}
