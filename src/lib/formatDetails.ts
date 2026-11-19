// src/lib/formatDetails.ts

/**
 * Resultado de <see cref="formatDetails"/>.
 * `isJson` = o texto original era JSON válido e `text` é a versão indentada.
 */
export interface FormattedDetails {
	text: string;
	isJson: boolean;
}

/** Quebra de linha + indentação de 2 espaços por nível. */
function newline(depth: number): string {
	return "\n" + "  ".repeat(depth);
}

/**
 * Indenta JSON <b>sem reescrever os valores</b>.
 *
 * Por que não `JSON.stringify(JSON.parse(x), null, 2)`? Porque o parse converte
 * números para double: ids de 64 bits (ex.: 9007199254740993) saem alterados.
 * Num visualizador de logs isso seria mudar a evidência. Aqui só inserimos
 * espaços/quebras entre os tokens, fora de strings.
 *
 * Se o texto não for JSON válido, devolve o original e `isJson: false`.
 */
export function formatDetails(raw: string): FormattedDetails {
	const source = raw.trim();
	if (!(source.startsWith("{") || source.startsWith("["))) {
		return { text: raw, isJson: false };
	}
	try {
		// Só valida; o resultado do parse é descartado de propósito.
		JSON.parse(source);
	} catch {
		return { text: raw, isJson: false };
	}

	let out = "";
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < source.length; i++) {
		const ch = source[i];

		if (inString) {
			out += ch;
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}

		switch (ch) {
			case '"':
				inString = true;
				out += ch;
				break;
			case "{":
			case "[": {
				const closing = ch === "{" ? "}" : "]";
				// Objeto/array vazio fica compacto: {} e []
				let j = i + 1;
				while (j < source.length && /\s/.test(source[j])) j++;
				if (source[j] === closing) {
					out += ch + closing;
					i = j;
				} else {
					depth++;
					out += ch + newline(depth);
				}
				break;
			}
			case "}":
			case "]":
				depth--;
				out += newline(depth) + ch;
				break;
			case ",":
				out += "," + newline(depth);
				break;
			case ":":
				out += ": ";
				break;
			default:
				if (!/\s/.test(ch)) out += ch;
		}
	}
	return { text: out, isJson: true };
}
