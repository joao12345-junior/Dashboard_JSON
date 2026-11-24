// src/features/system/SystemHealthList.tsx
import { CircleCheck, CircleHelp, CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatAge, LEVEL_LABEL, type HealthItem, type HealthLevel } from "./healthStatus";
import type { SystemHealthState } from "./useSystemHealth";

const LEVEL_STYLE: Record<HealthLevel, { color: string; icon: LucideIcon }> = {
	ok: { color: "var(--muted-foreground)", icon: CircleCheck },
	warn: { color: "var(--warning-text)", icon: TriangleAlert },
	stale: { color: "var(--destructive-text)", icon: CircleX },
	unknown: { color: "var(--muted-foreground)", icon: CircleHelp },
};

/// <summary>
/// Lista de saúde dos Ajustes. O estado vai por ícone + texto (não só cor), e os
/// serviços aparecem antes das fontes de logs.
/// </summary>
export function SystemHealthList({ items, loading, error }: SystemHealthState) {
	if (loading) return <Message text="Verificando…" />;
	if (error && items.length === 0) return <Message text={error} tone="error" />;

	const ordered = [...items].sort((a, b) => Number(b.kind === "service") - Number(a.kind === "service"));

	return (
		<>
			{ordered.map((item) => (
				<Row key={item.key} item={item} />
			))}
			{error && <Message text={`Última consulta falhou: ${error}`} tone="error" />}
		</>
	);
}

function Row({ item }: { item: HealthItem }) {
	const { color, icon } = LEVEL_STYLE[item.level];
	const Icon = icon;
	const isAlert = item.level === "warn" || item.level === "stale";

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 14px",
				border: "1px solid var(--border)",
				borderLeft: `3px solid ${isAlert ? color : "var(--border)"}`,
				borderRadius: 8,
				backgroundColor: "var(--background)",
			}}
		>
			<Icon size={18} color={color} aria-hidden="true" style={{ flexShrink: 0 }} />
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{item.label}</span>
					<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
						{item.kind === "service" ? "serviço" : "origem de logs"}
					</span>
				</div>
				<div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
					{item.hint}
				</div>
			</div>
			<div style={{ textAlign: "right", flexShrink: 0 }}>
				<div style={{ fontSize: 13, fontWeight: 600, color }}>{LEVEL_LABEL[item.level]}</div>
				<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
					último dado {formatAge(item.ageMs)}
				</div>
			</div>
		</div>
	);
}

function Message({ text, tone }: { text: string; tone?: "error" }) {
	return (
		<div
			style={{
				fontSize: 13,
				color: tone === "error" ? "var(--destructive-text)" : "var(--muted-foreground)",
				padding: "8px 0",
			}}
		>
			{text}
		</div>
	);
}
