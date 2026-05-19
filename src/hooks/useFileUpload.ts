// src/hooks/useFileUpload.ts
import { useState, useRef, useCallback } from "react";

/**
 * Encapsula estado e handlers de upload de arquivos JSON.
 *
 * Por que um hook separado?
 * Repository Pattern: o hook é o "port" entre a UI e o sistema de arquivos.
 * Qualquer mudança de comportamento (validação de tamanho, múltiplos formatos)
 * acontece aqui — e todas as páginas herdam automaticamente.
 */
// src/hooks/useFileUpload.ts
interface UseFileUploadOptions {
	mode?: "replace" | "accumulate"; // padrão: replace
}

export function useFileUpload({ mode = "replace" }: UseFileUploadOptions = {}) {
	const [files, setFiles] = useState<File[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const selected = Array.from(e.target.files ?? []).filter((f) =>
				f.name.endsWith(".json"),
			);

			if (selected.length) {
				// Aqui está a decisão consciente: substitui ou acumula
				if (mode === "accumulate") {
					setFiles((prev) => [...prev, ...selected]);
				} else {
					setFiles(selected);
				}
			}

			e.target.value = "";
		},
		[mode],
	);

	const openPicker = useCallback(() => {
		inputRef.current?.click();
	}, []);

	return { files, inputRef, handleChange, openPicker };
}
