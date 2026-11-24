// src/features/network/components/TopAppsCard.tsx
import React, { useState } from "react";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { useNetworkTopApps, type TopAppsPeriod } from "../hooks/useNetworkExtras";
import { formatBytes, formatSince } from "../format";

const PERIOD_OPTIONS: ReadonlyArray<{ value: TopAppsPeriod; label: string }> = [
	{ value: "hour", label: "1 h" },
	{ value: "day", label: "24 h" },
];

const muted: React.CSSProperties = { color: "var(--muted-foreground)" };

/// <summary>
/// "Principais aplicativos" do Rede > Painel, como no UniFi: os 10 aplicativos com
/// mais tráfego na última hora ou nas últimas 24 h. O ranking é calculado pelo próprio
/// UniFi (DPI); o poller do LogDash copia a cada ~5 min e põe os nomes do catálogo.
/// A barra é relativa ao 1º colocado, não ao total.
/// </summary>
export function TopAppsCard({ cardStyle }: { cardStyle: React.CSSProperties }) {
	const [period, setPeriod] = useState<TopAppsPeriod>("day");
	const { data, error } = useNetworkTopApps(period);
	const apps = data?.apps ?? [];
	const max = apps[0]?.bytes ?? 0;

	return (
		<section aria-label="Principais aplicativos" style={cardStyle}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
				<h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Principais aplicativos</h3>
				<SegmentedControl label="Período dos aplicativos" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
			</div>
			<span style={{ fontSize: 11, ...muted, marginTop: -6 }}>
				tráfego identificado pelo UniFi
				{data?.fetched_at ? ` · coletado ${formatSince(data.fetched_at)}` : ""}
			</span>

			{error && !data ? (
				<span style={{ fontSize: 13, ...muted }}>
					Indisponível. No servidor: migração 019 e reiniciar o <code>LogDashUnifiPoller</code>.
				</span>
			) : !data ? (
				<span style={{ fontSize: 13, ...muted }}>Carregando…</span>
			) : apps.length === 0 ? (
				<span style={{ fontSize: 13, ...muted }}>
					Sem ranking ainda. O poller busca a cada 5 min depois da migração 019.
				</span>
			) : (
				<ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
					{apps.map((app) => (
						<li key={app.rank} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
							<div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
								<span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									<span style={{ fontWeight: 600 }}>{app.name ?? `App ${app.application_id}`}</span>
									{app.category && <span style={muted}> · {app.category}</span>}
								</span>
								<span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatBytes(app.bytes)}</span>
							</div>
							<div
								aria-hidden="true"
								style={{ height: 4, borderRadius: 2, backgroundColor: "color-mix(in oklch, var(--muted-foreground) 15%, transparent)" }}
							>
								<div
									style={{
										height: "100%",
										width: `${max > 0 ? Math.max(2, (app.bytes / max) * 100) : 0}%`,
										borderRadius: 2,
										backgroundColor: "var(--chart-4)",
									}}
								/>
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
