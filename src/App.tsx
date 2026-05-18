// src/App.tsx
import { useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import { LoginPage } from "./pages/Login";
import { useState } from "react";

// Importações das novas páginas — cada feature tem sua própria pasta
import { HomePage } from "./features/home/HomePage";
import { ProcessDashboard } from "./features/process/ProcessDashboard";
import { ProcessList } from "./features/process/ProcessList";
import { WindowsDashboard } from "./features/windows-event/WindowsDashboard";
import { WindowsList } from "./features/windows-event/WindowsList";

/**
 * União discriminada de páginas disponíveis.
 *
 * Por que exportar esse tipo?
 * Qualquer componente que precise de navegação (Sidebar, botões)
 * importa esse tipo — garantindo que só páginas válidas sejam usadas.
 * Se você adicionar "network-list" aqui, o TypeScript vai apontar
 * todos os lugares que precisam ser atualizados.
 */
export type Page =
	| "home"
	| "process-dashboard"
	| "process-list"
	| "windows-dashboard"
	| "windows-list";

function AppContent() {
	const { isAuthenticated } = useAuth();
	const [page, setPage] = useState<Page>("home");

	if (!isAuthenticated) return <LoginPage />;

	// Roteamento por objeto — mesma lógica do registry do mapper.
	// Adicionar uma página nova = adicionar uma linha aqui.
	const routes: Record<Page, React.ReactNode> = {
		home: <HomePage onNavigate={setPage} />,
		"process-dashboard": <ProcessDashboard onNavigate={setPage} />,
		"process-list": <ProcessList onNavigate={setPage} />,
		"windows-dashboard": <WindowsDashboard onNavigate={setPage} />,
		"windows-list": <WindowsList onNavigate={setPage} />,
	};

	return <>{routes[page]}</>;
}

export default function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</ThemeProvider>
	);
}
