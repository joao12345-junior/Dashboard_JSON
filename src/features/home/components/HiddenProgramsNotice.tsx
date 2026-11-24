// src/features/home/components/HiddenProgramsNotice.tsx
import type { ClassifiedProgram } from "../../app-logs/programRegistry";
import { HomeNotice } from "./HomeNotice";

interface HiddenProgramsNoticeProps {
	/** Programas ocultos à mão que receberam logs nas últimas 24 h. */
	programs: ClassifiedProgram[];
	onOpenSettings: () => void;
}

const MAX_NAMES = 3;

/// <summary>
/// Aviso da Home: um programa oculto continua gravando logs, mas as telas não
/// mostram nada dele — sem este aviso, um programa oculto que passa a errar
/// ficaria invisível sem ninguém perceber. Não renderiza nada se a lista vem vazia.
/// </summary>
export function HiddenProgramsNotice({ programs, onOpenSettings }: HiddenProgramsNoticeProps) {
	if (programs.length === 0) return null;

	const shown = programs.slice(0, MAX_NAMES);
	const extra = programs.length - shown.length;
	const names =
		shown.map((p) => `${p.programa} (${p.logs_24h.toLocaleString("pt-BR")})`).join(", ") +
		(extra > 0 ? ` e mais ${extra}` : "");

	return (
		<HomeNotice tone="warn" actionLabel="Revisar nos Ajustes" onAction={onOpenSettings}>
			{programs.length === 1 ? "1 programa oculto recebeu" : `${programs.length} programas ocultos receberam`}{" "}
			logs nas últimas 24 h e não aparece
			{programs.length === 1 ? "" : "m"} nas telas: {names}.
		</HomeNotice>
	);
}
