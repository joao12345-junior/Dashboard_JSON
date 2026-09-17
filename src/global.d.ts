// src/global.d.ts
// Augmentação de tipos para atributos HTML não-padronizados usados no projeto.
// webkitdirectory permite selecionar uma pasta inteira no input de arquivo.
import "react";

declare module "react" {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T precisa existir pra bater com a assinatura original de InputHTMLAttributes<T> (merge de interface)
	interface InputHTMLAttributes<T> {
		webkitdirectory?: string;
	}
}
