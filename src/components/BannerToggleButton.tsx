// src/components/BannerToggleButton.tsx

import { useBannerPreferenceContext } from "../context/BannerPreferenceContext";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";

export function BannerToggleButton() {
	const { enabled, toggle } = useBannerPreferenceContext();
	return (
		<button
			onClick={toggle}
			title={enabled ? "Desativar banner" : "Ativar banner"}
			style={{
				width: 32,
				height: 32,
				borderRadius: 6,
				border: "1px solid var(--border)",
				backgroundColor: "transparent",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: 15,
				color: "var(--muted-foreground)",
				transition: "background-color 0.15s",
			}}
			onMouseEnter={(e) =>
				(e.currentTarget.style.backgroundColor = "var(--accent)")
			}
			onMouseLeave={(e) =>
				(e.currentTarget.style.backgroundColor = "transparent")
			}
		>
			{enabled ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
		</button>
	);
}
