// src/features/home/components/GlobalKpiRow.tsx
import type { Page } from "../../../App";
import type { HomeStats } from "../usehomeStats";
import {
	describeLastSeen,
	formatAverage,
	type DayKpi,
	type DayOverview,
} from "../../../lib/dayOverview";
import { describeDelta } from "../../../lib/formatDelta";

interface GlobalKpiRowProps {
	errors: DayKpi;
	warnings: DayKpi;
	lastSeen: DayOverview["lastSeen"];
	byType: HomeStats["byType"];
	/** "AAAA-MM-DD" de hoje e "HH:MM" agora (vêm do mesmo relógio do painel de erros). */
	todayIso: string;
	nowTime: string;
	/** Dados ainda chegando: marca a lista como ocupada para leitores de tela. */
	loading?: boolean;
	onNavigate: (page: Page) => void;
}

/** Rótulo pequeno em caixa alta, igual ao do painel de erros. */
const eyebrowStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
	marginBottom: 8,
};

const detailStyle: React.CSSProperties = {
	fontSize: 11,
	color: "var(--muted-foreground)",
	marginTop: 6,
};

/** Estilo comum dos cartões. O fundo e o hover ficam em style.css (.kpi-card). */
function cardStyle(accentColor: string): React.CSSProperties {
	return {
		border: "1px solid var(--border)",
		borderLeft: `3px solid ${accentColor}`,
		borderRadius: 10,
		padding: "18px clamp(14px, 2vw, 24px)",
		boxSizing: "border-box",
		height: "100%",
	};
}

function bigNumber(value: number, color: string): React.ReactNode {
	return (
		<div
			style={{
				fontSize: 32,
				fontWeight: 800,
				color,
				lineHeight: 1,
				fontVariantNumeric: "tabular-nums",
			}}
		>
			{value.toLocaleString("pt-BR")}
		</div>
	);
}

/**
 * Cartão de "hoje": o número do dia, contra ontem (até a mesma hora) e contra a
 * média da semana. Sem o contexto, "5 erros" não diz se é muito ou pouco.
 */
function DayCard({
	label,
	kpi,
	accentColor,
	worseColor,
	nowTime,
}: {
	label: string;
	kpi: DayKpi;
	accentColor: string;
	/** Cor do texto da variação quando piora (token com contraste de texto). */
	worseColor: string;
	nowTime: string;
}) {
	const delta = describeDelta(kpi.today - kpi.yesterdayUntilNow, nowTime);
	return (
		<div className="kpi-card" style={cardStyle(accentColor)}>
			<div style={eyebrowStyle}>{label}</div>
			{bigNumber(kpi.today, accentColor)}
			<div
				title={`Até ${nowTime}: ontem houve ${kpi.yesterdayUntilNow.toLocaleString("pt-BR")}; hoje, ${kpi.today.toLocaleString("pt-BR")}.`}
				style={{
					...detailStyle,
					fontWeight: 700,
					color: delta.worse ? worseColor : "var(--foreground)",
				}}
			>
				<span aria-hidden="true">{delta.symbol} </span>
				{delta.text}
			</div>
			<div style={{ ...detailStyle, marginTop: 2 }}>
				{kpi.weekAverage === null
					? "sem histórico nos últimos 7 dias"
					: `média dos últimos 7 dias: ${formatAverage(kpi.weekAverage)}/dia`}
			</div>
		</div>
	);
}

/**
 * Cartão de uma fonte de logs: total carregado, quando ela registrou algo pela
 * última vez e atalho para a lista. Em monitoramento, silêncio nem sempre é
 * saúde: "último registro há 2 dias" avisa que a coleta pode ter parado.
 */
function SourceCard({
	label,
	total,
	accentColor,
	lastSeenText,
	onOpen,
}: {
	label: string;
	total: number;
	accentColor: string;
	lastSeenText: string;
	onOpen: () => void;
}) {
	return (
		<button
			type="button"
			className="kpi-card kpi-card--link"
			onClick={onOpen}
			style={cardStyle(accentColor)}
		>
			<div style={eyebrowStyle}>{label}</div>
			{/* Contagem neutra: a cor fica na borda (o --chart-2, por exemplo, quase some no tema escuro). */}
			{bigNumber(total, "var(--foreground)")}
			<div style={detailStyle}>{lastSeenText}</div>
			<div style={{ ...detailStyle, marginTop: 2 }}>Ver registros →</div>
		</button>
	);
}

export function GlobalKpiRow({
	errors,
	warnings,
	lastSeen,
	byType,
	todayIso,
	nowTime,
	loading = false,
	onNavigate,
}: GlobalKpiRowProps) {
	const sources: Array<{
		label: string;
		total: number;
		accentColor: string;
		stamp: DayOverview["lastSeen"]["process"];
		page: Page;
	}> = [
		{
			label: "Logs de Backup",
			total: byType.process.total,
			accentColor: "var(--primary)",
			stamp: lastSeen.process,
			page: "process-list",
		},
		{
			label: "Windows Event Logs",
			total: byType.windowsEvent.total,
			accentColor: "var(--chart-4)",
			stamp: lastSeen.windows,
			page: "windows-list",
		},
		{
			label: "Logs Gerais",
			total: byType.app.total,
			accentColor: "var(--chart-2)",
			stamp: lastSeen.app,
			page: "app-list",
		},
	];

	return (
		<ul
			aria-busy={loading}
			aria-label="Resumo de hoje e das fontes de logs"
			style={{
				listStyle: "none",
				margin: 0,
				padding: 0,
				display: "grid",
				// auto-fit: no desktop cabem os 5 cartões; no celular ficam 2 por linha
				// (um por linha empilhava ~800px antes do painel de erros).
				gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
				gap: 16,
			}}
		>
			<li>
				<DayCard
					label="Erros hoje"
					kpi={errors}
					accentColor="var(--destructive)"
					worseColor="var(--destructive-text)"
					nowTime={nowTime}
				/>
			</li>
			<li>
				<DayCard
					label="Avisos hoje"
					kpi={warnings}
					accentColor="var(--chart-5)"
					worseColor="var(--warning-text)"
					nowTime={nowTime}
				/>
			</li>
			{sources.map((source) => (
				<li key={source.label}>
					<SourceCard
						label={source.label}
						total={source.total}
						accentColor={source.accentColor}
						lastSeenText={describeLastSeen(source.stamp, todayIso, nowTime)}
						onOpen={() => onNavigate(source.page)}
					/>
				</li>
			))}
		</ul>
	);
}
