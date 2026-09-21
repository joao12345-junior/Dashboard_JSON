// src/App.tsx
import { useState, useEffect } from "react";
import { useAuth, AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { LoginPage } from "./pages/Login";
import { useProgressiveLogs } from "./hooks/useProgressiveLogs";
import { useFileUpload } from "./hooks/useFileUpload";
import { Toast } from "./components/Toast";
import { useSiteData } from "./features/site/hooks/useSiteData";
import { useNewDataDetector } from "./hooks/useNewDataDetector";
import { NewDataBanner } from "./components/NewDataBanner";
import { useNotificationPreferenceContext } from "./context/NotificationPreferenceContext";
import { notifyNewLogs } from "./lib/notifyNewLogs";

import { HomePage } from "./features/home/HomePage";
import { ProcessDashboard } from "./features/backup/BackupDashboard";
import { ProcessList } from "./features/backup/BackupList";
import { WindowsDashboard } from "./features/windows-event/WindowsDashboard";
import { WindowsList } from "./features/windows-event/WindowsList";
import { SiteDashboard } from "./features/site/SiteDashboard";
import { SiteList } from "./features/site/SiteList";
import { Settings } from "./features/settings/settingsPage";
import { AppDashboard } from "./features/app-logs/AppDashboard";
import { AppList } from "./features/app-logs/AppList";

import type { LoadProgress, DebugInfo } from "./hooks/useProgressiveLogs";
import type { Log } from "./lib/types/Log";
import { START_STATUS } from "./lib/Variables";
import type { SiteData } from "./features/site/hooks/useSiteData";

import { LoadingState } from "./components/Loading";
import { Sidebar } from "./components/Sidebar";
import { useWindowSize } from "./hooks/useWindowSize";

export type Page =
	| "home"
	| "process-dashboard"
	| "process-list"
	| "windows-dashboard"
	| "windows-list"
	| "site-dashboard"
	| "site-list"
	| "app-dashboard"
	| "app-list"
	| "settings";

// ── Persistencia da pagina atual ─────────────────────────────────────────────
//
// O navegador/SO pode descartar a aba (Chrome tab discarding sob pressao de
// memoria) ou suspender o notebook depois de muito tempo parado numa pagina.
// Isso remonta o App do zero, e sem isso o useState<Page> abaixo voltaria
// sempre pra "home" -- de fora parece que "o sistema perdeu a pagina sozinho".
// Guardamos a ultima pagina em sessionStorage (dura so a aba, some ao fechar)
// e restauramos no mount.
const PAGE_STORAGE_KEY = "logdash:lastPage";

const VALID_PAGES: readonly Page[] = [
	"home",
	"process-dashboard",
	"process-list",
	"windows-dashboard",
	"windows-list",
	"site-dashboard",
	"site-list",
	"app-dashboard",
	"app-list",
	"settings",
];

function isValidPage(value: string | null): value is Page {
	return value !== null && (VALID_PAGES as readonly string[]).includes(value);
}

function readStoredPage(): Page {
	try {
		const saved = sessionStorage.getItem(PAGE_STORAGE_KEY);
		return isValidPage(saved) ? saved : "home";
	} catch {
		// sessionStorage indisponivel (aba anonima com storage bloqueado, etc.)
		return "home";
	}
}

export interface ProcessFilterState {
	message: string;
	date: string;
	start: string;
}

export interface WindowsFilterState {
	message: string;
	date: string;
	criticality: "all" | "High" | "Medium" | "Low";
	provider: string;
	levelLabel: string;
}

export interface AppFilterState {
	message: string;
	date: string;
	tipo: "all" | "debug" | "info" | "aviso" | "erro";
	classe: string;
	programa: string;
}

export interface SharedPageProps {
	logs: Log[];
	staticLogs: Log[];
	manualLogs: Log[];
	siteData: SiteData;
	progress: LoadProgress;
	debug: DebugInfo;
	reload: () => void;

	/** Calculado uma vez em App.tsx — evita um listener de resize por página. */
	isMobile: boolean;

	fileInputRef: React.RefObject<HTMLInputElement | null>;
	handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	openPicker: () => void;

	onNavigate: (page: Page) => void;

	processFilters: ProcessFilterState;
	onProcessFilterUpdate: (key: keyof ProcessFilterState, value: string) => void;
	onProcessFilterReset: () => void;

	windowsFilters: WindowsFilterState;
	onWindowsFilterUpdate: (key: keyof WindowsFilterState, value: string) => void;
	onWindowsFilterReset: () => void;

	appFilters: AppFilterState;
	onAppFilterUpdate: (key: keyof AppFilterState, value: string) => void;
	onAppFilterReset: () => void;
}

const INITIAL_PROCESS_FILTERS: ProcessFilterState = {
	message: "",
	date: "",
	start: START_STATUS.ALL,
};

const INITIAL_WINDOWS_FILTERS: WindowsFilterState = {
	message: "",
	date: "",
	criticality: "all",
	provider: "",
	levelLabel: "",
};

const INITIAL_APP_FILTERS: AppFilterState = {
	message: "",
	date: "",
	tipo: "all",
	classe: "",
	programa: "all",
};

function AppContent() {
	const { isAuthenticated, isInitializing } = useAuth();
	const [page, setPage] = useState<Page>(readStoredPage);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	const {
		files: logFiles,
		inputRef: fileInputRef,
		handleChange,
		openPicker,
	} = useFileUpload({ mode: "accumulate" });

	const {
		logs,
		staticLogs,
		manualLogs,
		progress,
		debug,
		reload,
		fetchNewData,
	} = useProgressiveLogs(logFiles, isAuthenticated);

	const siteData = useSiteData();
	const { hasNewData, dismiss, acknowledge, counts } = useNewDataDetector();
	const { enabled: notificationsEnabled } = useNotificationPreferenceContext();

	// Dispara notificação nativa quando chega dado novo e o usuário optou por
	// receber notificações. Não dispara no reset (dismiss/acknowledge zera
	// counts para null) por causa do guard `if (!counts) return`.
	useEffect(() => {
		if (!notificationsEnabled) return;
		if (!counts) return;
		if (!Object.values(counts).some((n) => n > 0)) return;

		notifyNewLogs(counts);
	}, [counts, notificationsEnabled]);

	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [processFilters, setProcessFilters] = useState<ProcessFilterState>(
		INITIAL_PROCESS_FILTERS,
	);
	const [windowsFilters, setWindowsFilters] = useState<WindowsFilterState>(
		INITIAL_WINDOWS_FILTERS,
	);
	const [appFilters, setAppFilters] =
		useState<AppFilterState>(INITIAL_APP_FILTERS);

	useEffect(() => {
		try {
			sessionStorage.setItem(PAGE_STORAGE_KEY, page);
		} catch {
			// sessionStorage indisponivel -- degrada graciosamente, sem persistencia
		}
	}, [page]);

	useEffect(() => {
		if (!progress.isDone) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- toast e notificacao de conclusao de um evento externo (carregamento assincrono terminou), nao estado derivavel durante o render
		setToastMessage(
			`${debug.totalRecords.toLocaleString("pt-BR")} registros carregados em ${debug.elapsedSeconds}s`,
		);
	}, [progress.isDone, debug.elapsedSeconds, debug.totalRecords]);

	if (isInitializing) return <LoadingState />;
	if (!isAuthenticated) return <LoginPage />;

	const sharedProps: SharedPageProps = {
		logs,
		staticLogs,
		manualLogs,
		siteData,
		progress,
		debug,
		reload,
		isMobile,
		fileInputRef,
		handleChange,
		openPicker,
		onNavigate: setPage,

		processFilters,
		onProcessFilterUpdate: (key, value) =>
			setProcessFilters((prev) => ({ ...prev, [key]: value })),
		onProcessFilterReset: () => setProcessFilters(INITIAL_PROCESS_FILTERS),

		windowsFilters,
		onWindowsFilterUpdate: (key, value) =>
			setWindowsFilters((prev) => ({ ...prev, [key]: value })),
		onWindowsFilterReset: () => setWindowsFilters(INITIAL_WINDOWS_FILTERS),

		appFilters,
		onAppFilterUpdate: (key, value) =>
			setAppFilters((prev) =>
				key === "programa"
					? { ...prev, programa: value, classe: "" }
					: { ...prev, [key]: value },
			),
		onAppFilterReset: () => setAppFilters(INITIAL_APP_FILTERS),
	};

	function renderPage() {
		switch (page) {
			case "home":
				return <HomePage {...sharedProps} />;
			case "process-dashboard":
				return <ProcessDashboard {...sharedProps} />;
			case "process-list":
				return <ProcessList {...sharedProps} />;
			case "windows-dashboard":
				return <WindowsDashboard {...sharedProps} />;
			case "windows-list":
				return <WindowsList {...sharedProps} />;
			case "site-dashboard":
				return <SiteDashboard {...sharedProps} />;
			case "site-list":
				return <SiteList {...sharedProps} />;
			case "app-dashboard":
				return <AppDashboard {...sharedProps} />;
			case "app-list":
				return <AppList {...sharedProps} />;
			case "settings":
				return <Settings {...sharedProps} />;
		}
	}

	return (
		<>
			<div
				style={{
					display: "flex",
					height: "100vh",
					overflow: "hidden",
					backgroundColor: "var(--background)",
				}}
			>
				<Sidebar isMobile={isMobile} currentPage={page} onNavigate={setPage} />
				{renderPage()}
			</div>
			<Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
			{hasNewData && (
				<NewDataBanner
					onRefresh={() => {
						acknowledge();
						fetchNewData();
					}}
					onDismiss={dismiss}
					counts={counts}
				/>
			)}
		</>
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
