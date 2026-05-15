import { useAuth } from "./hooks/useAuth";
import { LogsTable } from "./pages/LogsTable";
import { LoginPage } from "./pages/Login";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";

// ══════════════════════════════════════════════════════════════════════════════
// MAPA DA ARQUITETURA
//  Domain       → constantes puras (START_STATUS, ADMIN_CREDENTIALS…)
//  Data         → LogMapper (Adapter) + LogRepository (Repository)
//  Application  → hooks (useTheme, useAuth, useLogs, useLogFilters, useWindowSize)
//  UI           → componentes React
// ══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════
// UI LAYER
// ═══════════════════════════════════════

function AppContent() {
	const { isAuthenticated } = useAuth();
	return isAuthenticated ? <LogsTable /> : <LoginPage />;
}

// ═══════════════════════════════════════
// ROOT
// ═══════════════════════════════════════
export default function App() {
	return (
		<>
			<ThemeProvider>
				<AuthProvider>
					<AppContent />
				</AuthProvider>
			</ThemeProvider>
		</>
	);
}
