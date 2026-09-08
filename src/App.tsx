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
	const [page, setPage] = useState<Page>("home");
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	const {
		files: logFiles,
		inputRef: fileInputRef,
		handleChange,
		openPicker,
	} = useFileUpload({ mode: "accumulate" });

	const { logs, staticLogs, manualLogs, progress, debug, reload } =
		useProgressiveLogs(logFiles, isAuthenticated);

	const siteData = useSiteData();
	const { hasNewData, dismiss, acknowledge } = useNewDataDetector();

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
		if (!progress.isDone) return;
		setToastMessage(
			`${debug.totalRecords.toLocaleString("pt-BR")} registros carregados em ${debug.elapsedSeconds}s`,
		);
	}, [progress.isDone]);

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
						reload();
					}}
					onDismiss={dismiss}
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
