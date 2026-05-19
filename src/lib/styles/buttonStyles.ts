// src/lib/styles/buttonStyles.ts
import React from "react";

export const btnPrimary: React.CSSProperties = {
	padding: "8px 16px",
	borderRadius: 8,
	border: "1px solid var(--border)",
	backgroundColor: "var(--primary)",
	color: "var(--primary-foreground)",
	fontSize: 13,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
};

export const btnSecondary: React.CSSProperties = {
	padding: "8px 16px",
	borderRadius: 8,
	border: "1px solid var(--border)",
	backgroundColor: "transparent",
	color: "var(--foreground)",
	fontSize: 13,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
};
