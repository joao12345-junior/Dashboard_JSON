// src/features/home/components/CriticalEventsFeed.tsx
import { Log } from "../../../lib/types/Log";
import { StatusBadge } from "../../../components/StatusBadge";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { Page } from "../../../App";

interface CriticalEventsFeedProps {
	events: Log[];
	onNavigate: (page: Page) => void;
}

export function CriticalEventsFeed({
	events,
	onNavigate,
}: CriticalEventsFeedProps) {
	if (events.length === 0) {
		return (
			<div
				style={{
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: "40px 24px",
					textAlign: "center",
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Nenhum evento crítico encontrado. Carregue arquivos de log para começar.
			</div>
		);
	}

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				overflow: "hidden",
			}}
		>
			{/* Cabeçalho da seção */}
			<div
				style={{
					padding: "16px 24px",
					borderBottom: "1px solid var(--border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<div>
					<div
						style={{
							fontSize: 14,
							fontWeight: 700,
							color: "var(--foreground)",
						}}
					>
						Eventos Críticos Recentes
					</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							marginTop: 2,
						}}
					>
						Últimos {events.length} eventos que requerem atenção
					</div>
				</div>
			</div>

			{/* Lista de eventos */}
			<div>
				{events.map((log, i) => (
					<div
						key={`${log.date}-${log.time}-${i}`}
						onClick={() =>
							onNavigate(
								log.logType === "windows-event"
									? "windows-list"
									: "process-list",
							)
						}
						style={{
							padding: "14px 24px",
							borderBottom:
								i < events.length - 1 ? "1px solid var(--border)" : "none",
							display: "flex",
							alignItems: "center",
							gap: 16,
							cursor: "pointer",
							transition: "background-color 0.12s",
						}}
						onMouseEnter={(e) =>
							(e.currentTarget.style.backgroundColor = "var(--accent)")
						}
						onMouseLeave={(e) =>
							(e.currentTarget.style.backgroundColor = "transparent")
						}
					>
						{/* Badge — a união discriminada decide qual renderizar */}
						<div style={{ flexShrink: 0 }}>
							{log.logType === "windows-event" ? (
								<CriticalityBadge
									criticality={log.criticality}
									levelLabel={log.levelLabel}
								/>
							) : (
								<StatusBadge status={log.status} />
							)}
						</div>

						{/* Descrição do evento */}
						<div style={{ flex: 1, minWidth: 0 }}>
							<div
								style={{
									fontSize: 13,
									fontWeight: 500,
									color: "var(--foreground)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{log.message}
							</div>
							<div
								style={{
									fontSize: 11,
									color: "var(--muted-foreground)",
									marginTop: 3,
								}}
							>
								{log.logType === "windows-event"
									? `${log.computer} · ${log.channel}`
									: `${log.date} ${log.time}`}
							</div>
						</div>

						{/* Timestamp */}
						<div
							style={{
								fontSize: 11,
								color: "var(--muted-foreground)",
								flexShrink: 0,
								fontFamily: "var(--font-mono)",
							}}
						>
							{log.date.split("-").reverse().join("/")} {log.time}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
