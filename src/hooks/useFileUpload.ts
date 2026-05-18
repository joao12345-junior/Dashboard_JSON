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
export function useFileUpload() {
	const [files, setFiles] = useState<File[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	// useCallback garante referência estável — não recria a função a cada render
	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = Array.from(e.target.files ?? []).filter((f) =>
			f.name.endsWith(".json"),
		);
		if (selected.length) setFiles(selected);
		// Limpa o input para permitir recarregar o mesmo arquivo
		e.target.value = "";
	}, []);

	const openPicker = useCallback(() => {
		inputRef.current?.click();
	}, []);

	return { files, inputRef, handleChange, openPicker };
}
