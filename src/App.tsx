import { Dashboard } from "./pages/Dashboard";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/Login";

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
	return isAuthenticated ? <Dashboard /> : <LoginPage />;
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
