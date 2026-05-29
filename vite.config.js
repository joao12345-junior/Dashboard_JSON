// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Plugin que gera o index.json automaticamente ao iniciar o servidor.
 *
 * Por que um plugin do Vite e não um script separado?
 * O operador não precisa lembrar de rodar dois comandos.
 * Um único `npm run dev` cuida de tudo.
 *
 * configureServer: hook chamado quando o servidor de desenvolvimento sobe.
 * buildStart: hook chamado no início do build de produção.
 * Usamos os dois para garantir que o índice existe em qualquer cenário.
 */
function generateIndexPlugin() {
	function runIndexer() {
		const scriptPath = path.resolve(__dirname, "generate_index.py");

		if (!fs.existsSync(scriptPath)) {
			console.warn(
				"[generate_index] generate_index.py não encontrado na raiz do projeto.",
			);
			return;
		}

		try {
			console.log("[generate_index] Gerando index.json...");
			execSync("python generate_index.py", {
				cwd: __dirname,
				stdio: "inherit", // mostra a saída do Python no terminal do Vite
			});
			console.log("[generate_index] index.json gerado com sucesso.");
		} catch (err) {
			console.error("[generate_index] Erro ao gerar index.json:", err);
		}
	}

	return {
		name: "generate-index",
		// Roda no servidor de desenvolvimento
		configureServer() {
			runIndexer();
		},
		// Roda no build de produção
		buildStart() {
			runIndexer();
		},
	};
}

export default defineConfig({
	plugins: [react(), generateIndexPlugin()],
	server: {
		host: true,
		port: 5173,
	},
});
