// src/components/StatRow.tsx

interface StatRowProps {
	label: string;
	value: number;
}

/**
 * Componente presentacional — exibe um par label/valor em linha.
 * Sem estado, sem efeitos, sem lógica. Só renderização.
 *
 * Por que separar isso num componente?
 * Se o estilo mudar (cor, fonte, espaçamento), você muda em um lugar
 * e todas as instâncias na Sidebar atualizam automaticamente.
 */
export function StatRow({ label, value }: StatRowProps) {
	return (
		<div
			style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "4px 0",
			}}
		>
			<span
				style={{
					fontSize: 12,
					color: "var(--muted-foreground)",
				}}
			>
				{label}
			</span>
			<span
				style={{
					fontSize: 12,
					fontWeight: 700,
					color: "var(--foreground)",
					fontVariantNumeric: "tabular-nums", // números alinhados mesmo com dígitos diferentes
				}}
			>
				{value}
			</span>
		</div>
	);
}
