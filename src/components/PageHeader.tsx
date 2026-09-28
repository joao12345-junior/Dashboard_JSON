// src/components/PageHeader.tsx

import type { ReactNode } from "react";
import { ThemeToggleButton } from "./ThemeButton";
import { NotificationToggleButton } from "./NotificationToggleButton";
import { ProgressBar } from "./ProgressBar";

interface HeaderProgressState {
	isLoading: boolean;
	percentComplete: number;
}

interface PageHeaderProps {
	/** Título da página. Ignorado quando `titleArea` é passado. */
	title?: ReactNode;
	/** Texto abaixo do título. Ignorado quando `titleArea` é passado. */
	subtitle?: ReactNode;
	/**
	 * Escape hatch: substitui título+subtítulo padrão por qualquer JSX.
	 * Usado pelas páginas de Site, que têm uma faixa de acento antes do
	 * h1 e um layout de subtítulo diferente (margem à esquerda, não em cima).
	 */
	titleArea?: ReactNode;
	/**
	 * "dense" = marginBottom: 32 (dashboards, cabeçalho solto no topo).
	 * "compact" = flexShrink: 0 (páginas de lista, dentro de um <main> flex-column).
	 */
	spacing: "dense" | "compact";
	/** Alinhamento vertical do container — "flex-start" usado pelas páginas de Site (título de 2 linhas). */
	align?: "center" | "flex-start";
	/** Permite quebra de linha do cabeçalho em telas estreitas (usado pela página de Configurações). */
	wrap?: boolean;
	/** Controles extras renderizados ANTES do ThemeToggleButton (ex.: select de URL monitorada). */
	leadingControls?: ReactNode;
	/** Botões/controles extras do lado direito, depois do ThemeToggleButton — específicos de cada página. */
	children?: ReactNode;
	/** Progresso do carregamento de arquivos estáticos (índice local). */
	staticProgress?: HeaderProgressState;
	/**
	 * Progresso do carregamento via API. Quando os dois carregamentos
	 * estão ativos ao mesmo tempo, apiProgress tem prioridade — só uma
	 * barra aparece por vez, nunca as duas empilhadas.
	 */
	apiProgress?: HeaderProgressState;
}

/**
 * Cabeçalho compartilhado por todas as páginas do dashboard (exceto Login,
 * que tem layout próprio sem sidebar).
 *
 * Extraído porque cada página duplicava o mesmo bloco de título + botão de
 * tema inline — praticamente o mesmo JSX copiado em 10 arquivos. Cada
 * página continua dona dos próprios botões de ação (upload, recarregar,
 * navegação, select de site), passados via `children`/`leadingControls`,
 * porque dependem de handlers e estado específicos de cada página —
 * o PageHeader não precisa saber nada sobre eles.
 *
 * A barra de progresso segue o mesmo raciocínio: cada página repetia
 * `{progress.isLoading && <ProgressBar percent={...} />}` por conta
 * própria. Centralizado aqui, com a prioridade entre os dois
 * carregamentos (estático vs. API) decidida num lugar só, em vez de
 * cada página reimplementar essa regra.
 */
export function PageHeader({
	title,
	subtitle,
	titleArea,
	spacing,
	align = "center",
	wrap = false,
	leadingControls,
	children,
	staticProgress,
	apiProgress,
}: PageHeaderProps) {
	// apiProgress tem prioridade -- se os dois estiverem ativos ao mesmo
	// tempo, só a barra da API aparece.
	const activeProgress = apiProgress?.isLoading
		? apiProgress
		: staticProgress?.isLoading
			? staticProgress
			: null;

	return (
		<div>
			<div
				style={{
					display: "flex",
					alignItems: align,
					justifyContent: "space-between",
					...(spacing === "dense" ? { marginBottom: 32 } : { flexShrink: 0 }),
					...(wrap ? { flexWrap: "wrap", gap: 12 } : {}),
				}}
			>
				{titleArea ?? (
					<div>
						<h1
							style={{
								fontSize: 22,
								fontWeight: 800,
								color: "var(--foreground)",
								margin: 0,
							}}
						>
							{title}
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							{subtitle}
						</p>
					</div>
				)}
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					{leadingControls}
					<ThemeToggleButton />
					<NotificationToggleButton />
					{children}
				</div>
			</div>
			{activeProgress && (
				<ProgressBar
					percent={activeProgress.percentComplete}
					marginBottom={spacing === "compact" ? 0 : 24}
				/>
			)}
		</div>
	);
}
