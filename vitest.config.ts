// vitest.config.ts
import { defineConfig } from "vitest/config";

/**
 * Config SEPARADA da do Vite de propósito: o vite.config.ts tem plugins que
 * rodam o indexador Python e SOBEM o Flask (configureServer/buildStart).
 * Se o Vitest carregasse aquela config, cada `npm test` iniciaria a API.
 * Aqui só testamos funções puras (regras de negócio sem React nem rede),
 * então o ambiente é Node simples e nenhum plugin é necessário.
 */
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
