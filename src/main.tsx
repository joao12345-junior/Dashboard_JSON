import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App.js";
import { NotificationPreferenceProvider } from "./context/NotificationPreferenceContext";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<NotificationPreferenceProvider>
			<App />
		</NotificationPreferenceProvider>
	</StrictMode>,
);
