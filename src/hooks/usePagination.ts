// src/hooks/usePagination.ts

import { useState, useMemo } from "react";

interface UsePaginationResult<T> {
	pageItems: T[];
	currentPage: number;
	totalPages: number;
	totalConsidered: number;
	setPage: (page: number) => void;
}

/**
 * @param items     Já filtrado e ordenado (mais recente primeiro) — o hook não filtra nem ordena.
 * @param pageSize  Registros por página.
 * @param maxPages  Teto de páginas — além disso, os mais antigos são ignorados.
 * @param resetKey  Referência que, ao mudar, volta pra página 1. Passar o objeto
 *                  de filtro (ex.: appFilters) — NÃO passar `items`, senão reseta
 *                  a cada log novo que chega pela stream, não só quando o filtro muda.
 */

export function usePagination<T>(
	items: T[],
	pageSize: number,
	maxPages: number,
	resetKey: unknown,
): UsePaginationResult<T> {
	const [currentPage, setCurrentPage] = useState(1);

	// Reset durante o render (nao em useEffect) quando resetKey muda -- padrao
	// oficial do React pra "ajustar estado quando uma prop muda" sem o
	// re-render extra que um effect causaria (react-hooks/set-state-in-effect).
	// Ver: https://react.dev/learn/you-might-not-need-an-effect
	const [prevResetKey, setPrevResetKey] = useState(resetKey);
	if (resetKey !== prevResetKey) {
		setPrevResetKey(resetKey);
		setCurrentPage(1);
	}

	return useMemo(() => {
		const capped = items.slice(0, pageSize * maxPages);
		const totalPages = Math.max(1, Math.ceil(capped.length / pageSize));
		const safePage = Math.min(currentPage, totalPages);
		const pageItems = capped.slice(
			(safePage - 1) * pageSize,
			safePage * pageSize,
		);

		return {
			pageItems,
			currentPage: safePage,
			totalPages,
			totalConsidered: capped.length,
			setPage: setCurrentPage,
		};
	}, [items, pageSize, maxPages, currentPage]);
}
