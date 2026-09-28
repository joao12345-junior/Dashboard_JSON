// src/components/Pagination.tsx
import { useEffect, useRef, useState } from "react";
import { btnSecondary } from "../lib/styles/buttonStyles";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

// Quantos botoes de numero ficam visiveis ao mesmo tempo. Com 30 paginas
// possiveis (MAX_PAGES), mostrar todo mundo de uma vez nao cabe -- a janela
// desliza acompanhando a pagina atual em vez disso.
const VISIBLE_WINDOW = 5;

// Quanto tempo o destaque leva pra trocar de botao antes da janela (re)
// centralizar de verdade -- unica fonte da verdade pra essa duracao, tanto
// pro setTimeout abaixo quanto pra transicao/animacao no CSS (repassada via
// custom property --pagination-transition-ms). Antes disso existir, mudar
// a duracao exigia lembrar de trocar o numero em dois arquivos -- exatamente
// o tipo de descompasso que ja causou bug noutros pontos do projeto
// (KEEPALIVE_INTERVAL_SECONDS, POLL_INTERVAL_SECONDS).
const PAGE_CHANGE_TRANSITION_MS = 100;

/**
 * Calcula quais numeros de pagina mostrar, centralizando a janela na pagina
 * atual e "colando" nas bordas (1 e totalPages) em vez de deixar a janela
 * sair do intervalo valido. Recalculado do zero a cada render -- de
 * proposito (decisao do Joao): a janela sempre se recentraliza em torno da
 * pagina atual, mesmo clicando num numero que ja estava visivel.
 *
 * Exemplo com totalPages=30, windowSize=5:
 *   currentPage=1  -> [1,2,3,4,5]      (colado na borda esquerda)
 *   currentPage=15 -> [13,14,15,16,17] (centralizado)
 *   currentPage=30 -> [26,27,28,29,30] (colado na borda direita)
 */
function getVisiblePages(
	currentPage: number,
	totalPages: number,
	windowSize: number,
): number[] {
	if (totalPages <= windowSize) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const half = Math.floor(windowSize / 2);
	let start = currentPage - half;
	let end = start + windowSize - 1;

	if (start < 1) {
		start = 1;
		end = windowSize;
	} else if (end > totalPages) {
		end = totalPages;
		start = end - windowSize + 1;
	}

	return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Botao numerado: hover via classe CSS (.pagination-page-btn, em style.css),
// nao onMouseEnter/onMouseLeave em JS -- CSS reflete a posicao real do
// cursor a cada repaint, sem depender de estado JS que pode ficar defasado.
// A pagina "ativa visualmente" (isActive) pode ser diferente da pagina real
// (currentPage) por um instante -- ver comentario em requestPageChange.
function PageNumberButton({
	page,
	isActive,
	onClick,
}: {
	page: number;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-current={isActive ? "page" : undefined}
			className={
				isActive
					? "pagination-page-btn pagination-page-btn--active"
					: "pagination-page-btn"
			}
		>
			{page}
		</button>
	);
}

// Lista com 1 pagina so (ou vazia, totalPages sempre >= 1) nao precisa de
// navegacao nenhuma -- some da tela em vez de mostrar um unico botao "1"
// desabilitado, sem serventia.
export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationProps) {
	// pendingPage: pagina que o usuario acabou de clicar, mas cujo
	// onPageChange (a troca de verdade -- que muda os dados da tabela e
	// recentraliza a janela) ainda nao foi disparado. Existe pra separar
	// duas coisas que antes aconteciam juntas e brigavam visualmente:
	//   1) o destaque mudando de botao (rapido, so' precisa da transicao de cor)
	//   2) a janela recentralizando (reflow, precisa acontecer DEPOIS do 1)
	// Enquanto pendingPage != null, o destaque (isActive) usa esse valor;
	// a janela visivel continua calculada a partir do currentPage de
	// verdade, que so' muda quando o timeout abaixo dispara onPageChange.
	const [pendingPage, setPendingPage] = useState<number | null>(null);
	const timeoutRef = useRef<number | null>(null);

	// Se currentPage mudar por qualquer motivo -- o proprio timeout
	// resolvendo, ou um reset externo (troca de filtro, via usePagination) --
	// limpa o estado pendente. Sem isso, um reset de filtro no meio de uma
	// transicao deixaria o destaque preso numa pagina que nao existe mais
	// nesse contexto.
	//
	// Reset durante o render (nao em useEffect) -- mesmo padrao usado em
	// usePagination.ts pro resetKey. Ver comentario la' pro motivo
	// (react-hooks/set-state-in-effect).
	const [prevCurrentPage, setPrevCurrentPage] = useState(currentPage);
	if (currentPage !== prevCurrentPage) {
		setPrevCurrentPage(currentPage);
		setPendingPage(null);
	}

	// Limpa o timeout se o componente desmontar no meio da espera (troca de
	// pagina do app, por exemplo) -- sem isso, o onPageChange dispararia
	// depois pra um componente que nao existe mais.
	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
		};
	}, []);

	function requestPageChange(page: number) {
		// Mesmo padrao de lock single-flight do fetchNewData (useProgressiveLogs):
		// clicar de novo enquanto ja' tem uma troca em voo so' e' ignorado, nao
		// enfileira uma segunda -- evita dois timeouts correndo ao mesmo tempo
		// e resolvendo fora de ordem.
		if (page === currentPage || pendingPage !== null) return;
		setPendingPage(page);
		timeoutRef.current = window.setTimeout(() => {
			onPageChange(page);
		}, PAGE_CHANGE_TRANSITION_MS);
	}

	if (totalPages <= 1) return null;

	const displayedActivePage = pendingPage ?? currentPage;
	const isFirstPage = currentPage === 1;
	const isLastPage = currentPage === totalPages;
	const visiblePages = getVisiblePages(currentPage, totalPages, VISIBLE_WINDOW);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				flexShrink: 0,
				padding: "4px 0",
				// Repassa a duracao pro CSS via custom property -- ver comentario
				// em PAGE_CHANGE_TRANSITION_MS.
				["--pagination-transition-ms" as string]: `${PAGE_CHANGE_TRANSITION_MS}ms`,
			}}
		>
			<button
				type="button"
				onClick={() => requestPageChange(currentPage - 1)}
				disabled={isFirstPage}
				style={{
					...btnSecondary,
					opacity: isFirstPage ? 0.4 : 1,
					cursor: isFirstPage ? "default" : "pointer",
				}}
			>
				← Anterior
			</button>

			<div style={{ display: "flex", gap: 4 }}>
				{visiblePages.map((page) => (
					<PageNumberButton
						key={page}
						page={page}
						isActive={page === displayedActivePage}
						onClick={() => requestPageChange(page)}
					/>
				))}
			</div>

			<button
				type="button"
				onClick={() => requestPageChange(currentPage + 1)}
				disabled={isLastPage}
				style={{
					...btnSecondary,
					opacity: isLastPage ? 0.4 : 1,
					cursor: isLastPage ? "default" : "pointer",
				}}
			>
				Próxima →
			</button>
		</div>
	);
}
