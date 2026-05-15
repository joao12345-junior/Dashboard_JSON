// src/global.d.ts
// Augmentação de tipos para atributos HTML não-padronizados usados no projeto.
// webkitdirectory permite selecionar uma pasta inteira no input de arquivo.
import "react";

declare module "react" {
	interface InputHTMLAttributes<T> {
		webkitdirectory?: string;
	}
}
