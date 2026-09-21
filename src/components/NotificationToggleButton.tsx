// src/components/NotificationToggleButton.tsx

import { useNotificationPreferenceContext } from "../context/NotificationPreferenceContext";

// ─── NotificationToggleButton ──────────────────────────────────────────────
export function NotificationToggleButton() {
	const { enabled, toggle } = useNotificationPreferenceContext();
	return (
		<button
			onClick={toggle}
			title={enabled ? "Desativar notificações" : "Ativar notificações"}
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
			{enabled ? "🔔" : "🔕"}
		</button>
	);
}
