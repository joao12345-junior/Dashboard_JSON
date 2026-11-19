// src/features/app-logs/appTypeColors.ts
import type { AppLog } from "../../lib/types/Log";

/**
 * Cor de cada tipo de log geral. Fica fora do componente do badge porque é
 * compartilhada com a lista (faixa lateral) e o react-refresh exige que
 * arquivos de componente exportem só componentes.
 */
export const COLOR_BY_TIPO: Record<AppLog["tipo"], string> = {
	erro: "var(--destructive)",
	aviso: "var(--chart-4)",
	info: "var(--primary)",
	debug: "var(--muted-foreground)",
};
