// src/lib/exportCsv.ts

/**
 * Escapa uma célula de CSV.
 *  - Aspas, vírgula, ponto e vírgula e quebra de linha: cercado por aspas, aspas dobradas.
 *  - Começando com = + - @ (ou tab/CR): prefixo `'` para o Excel não executar como fórmula
 *    (mensagens de log vêm de fora e podem começar assim).
 */
export function escapeCsvCell(value: string): string {
	let cell = value;
	if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
	if (/[",;\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
	return cell;
}

/** Monta o texto CSV (separador ";" — o Excel em pt-BR abre direto em colunas). */
export function toCsv(header: string[], rows: string[][]): string {
	return [header, ...rows]
		.map((row) => row.map(escapeCsvCell).join(";"))
		.join("\r\n");
}

/** Baixa o texto como arquivo no navegador (BOM UTF-8 para acentos no Excel). */
export function downloadCsv(fileName: string, csv: string): void {
	const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
