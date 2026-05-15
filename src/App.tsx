// src/App.tsx
import { useAuth } from "./hooks/useAuth";
import { Dashboard } from "./pages/Dashboard";
import { LogsTable } from "./pages/LogsTable";
import { LoginPage } from "./pages/Login";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import { useState } from "react";

export type Page = "dashboard" | "logs";

function AppContent() {
	const { isAuthenticated } = useAuth();
	const [page, setPage] = useState<Page>("dashboard");

	if (!isAuthenticated) return <LoginPage />;
	return page === "dashboard" ? (
		<Dashboard onNavigate={setPage} />
	) : (
		<LogsTable onNavigate={setPage} />
	);
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
