// src/components/SegmentedControl.tsx

interface SegmentedControlProps<T extends string> {
	/** Nome do grupo para leitores de tela ("Filtrar por fonte", "Ordenar por"). */
	label: string;
	options: ReadonlyArray<{ value: T; label: string; title?: string }>;
	value: T;
	onChange: (value: T) => void;
}

/**
 * Grupo de botões "um ativo por vez" (filtro por fonte, ordenação).
 * Cada botão é um toggle com `aria-pressed`; o estado não depende só de cor
 * (o ativo também fica em negrito e com fundo de cartão).
 */
export function SegmentedControl<T extends string>({
	label,
	options,
	value,
	onChange,
}: SegmentedControlProps<T>) {
	return (
		<div
			role="group"
			aria-label={label}
			style={{
				display: "flex",
				gap: 4,
				padding: 3,
				backgroundColor: "var(--muted)",
				borderRadius: 6,
			}}
		>
			{options.map((option) => {
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						className="ld-chip"
						aria-pressed={active}
						title={option.title}
						onClick={() => onChange(option.value)}
						style={{
							padding: "3px 10px",
							borderRadius: 4,
							border: "none",
							backgroundColor: active ? "var(--card)" : "transparent",
							color: active ? "var(--foreground)" : "var(--muted-foreground)",
							fontSize: 11,
							fontWeight: active ? 700 : 500,
							cursor: "pointer",
							fontFamily: "inherit",
							boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
						}}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
