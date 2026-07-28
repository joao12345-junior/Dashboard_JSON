// src/components/AppTipoBadge.tsx
import { AppLog } from "../../../lib/types/Log";

// Mesmas cores já usadas na coluna Tipo do AppLogMapper — centralizado aqui
// pra não divergir entre os dois lugares que precisam desse badge.
const COLOR_BY_TIPO: Record<AppLog["tipo"], string> = {
	erro: "var(--destructive)",
	aviso: "var(--chart-5)",
	info: "var(--primary)",
	debug: "var(--muted-foreground)",
};

export function AppTypeBadge({ tipo }: { tipo: AppLog["tipo"] }) {
	const color = COLOR_BY_TIPO[tipo];

	return (
		<span
			style={{
				display: "inline-block",
				padding: "2px 10px",
				borderRadius: 999,
				backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
				color,
				fontSize: 11,
				fontWeight: 700,
				textTransform: "uppercase",
				whiteSpace: "nowrap",
			}}
		>
			{tipo}
		</span>
	);
}
