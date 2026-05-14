import { useTheme } from "../hooks/useTheme";

// ─── ThemeToggleButton ────────────────────────────────────────────────────────
export function ThemeToggleButton() {
	const { isDark, toggle } = useTheme();
	return (
		<button
			onClick={toggle}
			title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
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
			{isDark ? "☀️" : "🌙"}
		</button>
	);
}
