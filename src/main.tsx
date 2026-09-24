import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App.js";
import { NotificationPreferenceProvider } from "./context/NotificationPreferenceContext";
import { BannerPreferenceProvider } from "./context/BannerPreferenceContext";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<NotificationPreferenceProvider>
			<BannerPreferenceProvider>
				<App />
			</BannerPreferenceProvider>
		</NotificationPreferenceProvider>
	</StrictMode>,
);
