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

/**
 * Cor da faixa lateral de cada linha. Info e debug usam um cinza discreto:
 * eles são a maioria dos registros, e uma faixa colorida em todas as linhas
 * esconde justamente o que importa (erros e avisos).
 */
export const BAR_COLOR_BY_TIPO: Record<AppLog["tipo"], string> = {
	erro: "var(--destructive)",
	aviso: "var(--chart-4)",
	info: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)",
	debug: "color-mix(in oklch, var(--muted-foreground) 25%, transparent)",
};

/**
 * Cor do TEXTO de cada tipo (badge, contagens). Erro e aviso usam tokens
 * próprios (ver style.css) para passar de 4,5:1 nos dois temas.
 */
export const TEXT_COLOR_BY_TIPO: Record<AppLog["tipo"], string> = {
	erro: "var(--destructive-text)",
	aviso: "var(--warning-text)",
	info: "var(--primary)",
	debug: "var(--muted-foreground)",
};
