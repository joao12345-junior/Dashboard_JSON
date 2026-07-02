// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync, spawn } from "child_process";
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
		const pythonPath = path.resolve(
			__dirname,
			"api",
			".venv",
			"Scripts",
			"python.exe",
		);

		if (!fs.existsSync(scriptPath)) {
			console.warn("[generate_index] generate_index.py não encontrado.");
			return;
		}

		if (!fs.existsSync(pythonPath)) {
			console.warn(
				"[generate_index] Python não encontrado em api/.venv/Scripts/python.exe",
			);
			return;
		}

		try {
			console.log("[generate_index] Gerando index.json...");
			execSync(`"${pythonPath}" generate_index.py`, {
				cwd: __dirname,
				stdio: "inherit",
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

function startFlaskApiPlugin() {
	return {
		name: "start-flask-api",
		configureServer() {
			const pythonPath = path.resolve(
				__dirname,
				"api",
				".venv",
				"Scripts",
				"python.exe",
			);
			const appPath = path.resolve(__dirname, "api", "app.py");

			if (!fs.existsSync(appPath)) {
				console.warn("[flask-api] api/app.py não encontrado.");
				return;
			}

			try {
				console.log("[flask-api] Iniciando Flask API na porta 8765...");
				// spawn em vez de execSync — não bloqueia o Vite

				spawn(pythonPath, [appPath], {
					cwd: path.resolve(__dirname, "api"),
					stdio: "inherit",
					detached: false,
				});
			} catch (err) {
				console.error("[flask-api] Erro ao iniciar Flask API:", err);
			}
		},
	};
}

export default defineConfig({
	plugins: [react(), generateIndexPlugin(), startFlaskApiPlugin()],
	server: {
		host: true,
		port: 5173,
	},
});
