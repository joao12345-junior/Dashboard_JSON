// src/components/AppTipoBadge.tsx
import { AppLog } from "../../../lib/types/Log";
import { COLOR_BY_TIPO } from "../appTypeColors";

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
