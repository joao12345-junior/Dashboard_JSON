// src/features/network/components/TopologyCanvas.tsx
import React, { useEffect, useRef, useState } from "react";
import { Globe, LocateFixed, Minus, Plus, Router, Wifi } from "lucide-react";
import type { NetworkClient } from "../hooks/useNetworkState";
import { clientTitle } from "../sortClients";
import { isWeakSignal } from "../format";
import { clientIcon } from "../topologyIcons";
import {
	NODE_ICON_HEIGHT,
	SLOT_WIDTH,
	linkStartY,
	pathToRoot,
	type TopologyLayout,
	type TopologyNode,
} from "../topologyLayout";

interface View {
	scale: number;
	x: number;
	y: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const WIRED = "color-mix(in oklch, var(--primary) 75%, transparent)";
const WIRELESS = "var(--chart-4)";
const HILITE = "var(--foreground)";

/** Enquadra o desenho inteiro no espaço disponível (sem ampliar além de 100%). */
function fitView(layout: TopologyLayout, w: number, h: number): View {
	if (w === 0 || h === 0) return { scale: 1, x: 0, y: 0 };
	const scale = clamp(Math.min(w / layout.width, h / layout.height, 1), MIN_SCALE, 1);
	return { scale, x: (w - layout.width * scale) / 2, y: Math.max(0, (h - layout.height * scale) / 2) };
}

interface TopologyCanvasProps {
	layout: TopologyLayout;
	/** Ids que casam com o filtro/busca; null = todos. Os demais ficam apagados. */
	matches: Set<string> | null;
	onOpenClient: (c: NetworkClient) => void;
}

/// <summary>
/// Desenho da topologia com arrastar (pan) e zoom (roda do mouse ou botões),
/// como o mapa do UniFi. Linhas em SVG; nós em HTML posicionados por cima.
/// Passar o mouse num nó destaca o caminho dele até a Internet.
/// </summary>
export function TopologyCanvas({ layout, matches, onOpenClient }: TopologyCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ w: 0, h: 0 });
	// null = "enquadrado": recalcula sozinho quando o tamanho ou os dados mudam.
	const [manualView, setManualView] = useState<View | null>(null);
	const [hovered, setHovered] = useState<string | null>(null);
	const drag = useRef<{ px: number; py: number; view: View; moved: boolean } | null>(null);

	const view = manualView ?? fitView(layout, size.w, size.h);
	// O listener da roda (registrado uma vez) precisa da vista atual.
	const viewRef = useRef(view);
	useEffect(() => {
		viewRef.current = view;
	});

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => {
			setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
		});
		observer.observe(el);
		// Zoom pela roda centrado no ponteiro. Listener nativo porque o do React é
		// passivo e não deixa cancelar a rolagem da página.
		function onWheel(e: WheelEvent) {
			e.preventDefault();
			const rect = el!.getBoundingClientRect();
			const v = viewRef.current;
			const scale = clamp(v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_SCALE, MAX_SCALE);
			const px = e.clientX - rect.left;
			const py = e.clientY - rect.top;
			setManualView({
				scale,
				x: px - ((px - v.x) * scale) / v.scale,
				y: py - ((py - v.y) * scale) / v.scale,
			});
		}
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			observer.disconnect();
			el.removeEventListener("wheel", onWheel);
		};
	}, []);

	function zoomBy(factor: number) {
		const v = view;
		const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
		const cx = size.w / 2;
		const cy = size.h / 2;
		setManualView({ scale, x: cx - ((cx - v.x) * scale) / v.scale, y: cy - ((cy - v.y) * scale) / v.scale });
	}

	function onPointerDown(e: React.PointerEvent) {
		if (e.button !== 0) return;
		drag.current = { px: e.clientX, py: e.clientY, view, moved: false };
	}
	function onPointerMove(e: React.PointerEvent) {
		const d = drag.current;
		if (!d) return;
		const dx = e.clientX - d.px;
		const dy = e.clientY - d.py;
		if (!d.moved && Math.hypot(dx, dy) < 4) return; // clique, não arrasto
		if (!d.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		d.moved = true;
		setManualView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
	}
	function onPointerUp() {
		drag.current = null;
	}

	const byId = new Map(layout.nodes.map((n) => [n.id, n]));
	const route = pathToRoot(layout.nodes, hovered);
	const dim = (id: string) => matches !== null && !matches.has(id);

	return (
		<div
			ref={containerRef}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			style={{
				position: "relative",
				flex: 1,
				minHeight: 420,
				overflow: "hidden",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				backgroundImage:
					"radial-gradient(color-mix(in oklch, var(--muted-foreground) 22%, transparent) 1px, transparent 1px)",
				backgroundSize: `${22 * view.scale}px ${22 * view.scale}px`,
				backgroundPosition: `${view.x}px ${view.y}px`,
				cursor: "grab",
				touchAction: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: layout.width,
					height: layout.height,
					transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
					transformOrigin: "0 0",
				}}
			>
				<svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
					<Links nodes={layout.nodes} byId={byId} route={route} dim={dim} />
				</svg>
				{layout.nodes.map((n) => (
					<NodeView
						key={n.id}
						node={n}
						dimmed={dim(n.id)}
						onHover={setHovered}
						onOpenClient={(c) => {
							if (!drag.current?.moved) onOpenClient(c);
						}}
					/>
				))}
			</div>

			<div
				onPointerDown={(e) => e.stopPropagation()}
				style={{
					position: "absolute",
					left: 12,
					bottom: 12,
					display: "flex",
					flexDirection: "column",
					borderRadius: 8,
					border: "1px solid var(--border)",
					backgroundColor: "var(--background)",
					overflow: "hidden",
				}}
			>
				<ToolButton label="Enquadrar tudo" onClick={() => setManualView(null)}>
					<LocateFixed size={16} />
				</ToolButton>
				<ToolButton label="Aproximar" onClick={() => zoomBy(1.25)}>
					<Plus size={16} />
				</ToolButton>
				<ToolButton label="Afastar" onClick={() => zoomBy(1 / 1.25)}>
					<Minus size={16} />
				</ToolButton>
			</div>
		</div>
	);
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			onClick={onClick}
			className="ld-link-btn"
			style={{
				all: "unset",
				cursor: "pointer",
				width: 34,
				height: 34,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "var(--foreground)",
			}}
		>
			{children}
		</button>
	);
}

interface LinksProps {
	nodes: TopologyNode[];
	byId: Map<string, TopologyNode>;
	route: Set<string>;
	dim: (id: string) => boolean;
}

/** Barramentos (um por pai) + descidas até cada filho; a rota destacada vai por cima. */
function Links({ nodes, byId, route, dim }: LinksProps) {
	const groups = new Map<string, TopologyNode[]>();
	for (const n of nodes) {
		if (!n.parentId) continue;
		groups.set(n.parentId, [...(groups.get(n.parentId) ?? []), n]);
	}

	const elements: React.ReactNode[] = [];
	for (const [parentId, children] of groups) {
		const parent = byId.get(parentId);
		if (!parent) continue;
		const busY = children[0].busY ?? 0;
		const parentBottom = linkStartY(parent);
		const xs = [parent.x, ...children.map((c) => c.x)];
		const allWireless = children.every((c) => c.dashed);
		const busColor = allWireless ? WIRELESS : WIRED;
		const dash = allWireless ? "5 4" : undefined;

		elements.push(
			<line key={`${parentId}-down`} x1={parent.x} y1={parentBottom} x2={parent.x} y2={busY} stroke={busColor} strokeWidth={1.5} strokeDasharray={dash} />,
		);
		if (children.length > 1 || children[0].x !== parent.x) {
			elements.push(
				<line key={`${parentId}-bus`} x1={Math.min(...xs)} y1={busY} x2={Math.max(...xs)} y2={busY} stroke={busColor} strokeWidth={1.5} strokeDasharray={dash} />,
			);
		}
		for (const c of children) {
			elements.push(
				<line
					key={`${c.id}-drop`}
					x1={c.x}
					y1={busY}
					x2={c.x}
					y2={c.y}
					stroke={c.dashed ? WIRELESS : WIRED}
					strokeWidth={1.5}
					strokeDasharray={c.dashed ? "5 4" : c.inferred ? "1 4" : undefined}
					opacity={dim(c.id) ? 0.25 : 1}
				/>,
			);
		}
		if (children.length > 1) {
			elements.push(<circle key={`${parentId}-dot`} cx={parent.x} cy={busY} r={5} fill={busColor} />);
		}
	}

	// Rota do nó em foco até a Internet.
	for (const id of route) {
		const n = byId.get(id);
		const parent = n?.parentId ? byId.get(n.parentId) : undefined;
		if (!n || !parent || n.busY === null) continue;
		const d = `M ${parent.x} ${linkStartY(parent)} V ${n.busY} H ${n.x} V ${n.y}`;
		elements.push(<path key={`${id}-route`} d={d} fill="none" stroke={HILITE} strokeWidth={2.5} strokeDasharray={n.dashed ? "6 4" : undefined} />);
	}
	return <>{elements}</>;
}

const labelStyle: React.CSSProperties = {
	marginTop: 6,
	fontSize: 11,
	fontWeight: 700,
	color: "var(--foreground)",
	textAlign: "center",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

const subLabelStyle: React.CSSProperties = {
	fontSize: 10,
	color: "var(--muted-foreground)",
	textAlign: "center",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	fontFamily: "monospace",
};

interface NodeViewProps {
	node: TopologyNode;
	dimmed: boolean;
	onHover: (id: string | null) => void;
	onOpenClient: (c: NetworkClient) => void;
}

function NodeView({ node: n, dimmed, onHover, onOpenClient }: NodeViewProps) {
	const width = n.kind === "gateway" ? 220 : SLOT_WIDTH - 12;
	const common: React.CSSProperties = {
		position: "absolute",
		left: n.x - width / 2,
		top: n.y,
		width,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		opacity: dimmed ? 0.25 : 1,
		transition: "opacity 120ms",
	};
	const hover = { onMouseEnter: () => onHover(n.id), onMouseLeave: () => onHover(null) };

	if (n.kind === "internet") {
		return (
			<div style={common} {...hover}>
				<IconCircle size={NODE_ICON_HEIGHT.internet}>
					<Globe size={20} />
				</IconCircle>
				<div style={labelStyle}>Internet</div>
			</div>
		);
	}

	if (n.kind === "gateway" && n.device) {
		const d = n.device;
		const online = d.state === "ONLINE";
		return (
			<div style={common} {...hover}>
				<div
					style={{
						boxSizing: "border-box",
						width: "100%",
						height: NODE_ICON_HEIGHT.gateway,
						padding: "8px 12px",
						borderRadius: 8,
						border: `1px solid ${online ? "var(--primary)" : "var(--destructive)"}`,
						backgroundColor: "var(--background)",
						display: "flex",
						alignItems: "center",
						gap: 10,
					}}
				>
					<Router size={22} style={{ flexShrink: 0, color: "var(--foreground)" }} />
					<div style={{ minWidth: 0, flex: 1 }}>
						<div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
							{d.name ?? d.mac}
						</div>
						<div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
							{[d.model, d.ip_address].filter(Boolean).join(" · ")}
						</div>
					</div>
					<div style={{ fontSize: 10, color: "var(--muted-foreground)", textAlign: "right", lineHeight: 1.5 }}>
						<div>CPU {d.cpu_pct === null ? "—" : `${Math.round(d.cpu_pct)}%`}</div>
						<div>Mem {d.memory_pct === null ? "—" : `${Math.round(d.memory_pct)}%`}</div>
					</div>
				</div>
			</div>
		);
	}

	if (n.kind === "device" && n.device) {
		const d = n.device;
		const online = d.state === "ONLINE";
		const ap = d.features.includes("accessPoint");
		return (
			<div style={common} {...hover} title={[d.model, d.ip_address].filter(Boolean).join(" · ")}>
				<IconCircle size={NODE_ICON_HEIGHT.device} filled border={online ? undefined : "var(--destructive)"}>
					{ap ? <Wifi size={20} /> : <Router size={20} />}
				</IconCircle>
				<div style={{ ...labelStyle, maxWidth: "100%" }}>{d.name ?? d.mac}</div>
				<div style={subLabelStyle}>{online ? d.ip_address ?? "" : "offline"}</div>
			</div>
		);
	}

	if (n.kind === "client" && n.client) {
		const c = n.client;
		// createElement: o ícone vem de uma tabela fixa, não é componente novo a cada render.
		const icon = React.createElement(clientIcon(c), { size: 20 });
		const weak = !c.is_wired && isWeakSignal(c.signal_dbm);
		return (
			<button
				type="button"
				onClick={() => onOpenClient(c)}
				onFocus={() => onHover(n.id)}
				onBlur={() => onHover(null)}
				{...hover}
				title={`${clientTitle(c)}${c.note ? ` — ${c.note}` : ""}\n${c.ip_address ?? "sem IP"} · ${c.is_wired ? "cabo" : `Wi-Fi${c.signal_dbm !== null ? ` ${c.signal_dbm} dBm` : ""}`}${n.inferred ? "\nLigação não identificada" : ""}`}
				className="ld-link-btn"
				style={{ ...common, background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
			>
				<div
					style={{
						width: 48,
						height: NODE_ICON_HEIGHT.client,
						borderRadius: 6,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "var(--background)",
						border: `1px solid ${weak ? "var(--warning-text)" : "var(--border)"}`,
						color: weak ? "var(--warning-text)" : "var(--foreground)",
					}}
				>
					{icon}
				</div>
				<div style={{ ...labelStyle, maxWidth: "100%" }}>{clientTitle(c)}</div>
				<div style={{ ...subLabelStyle, maxWidth: "100%", color: weak ? "var(--warning-text)" : subLabelStyle.color }}>
					{weak ? `${c.signal_dbm} dBm · fraco` : (c.ip_address ?? "")}
				</div>
			</button>
		);
	}
	return null;
}

function IconCircle({
	size,
	filled,
	border,
	children,
}: {
	size: number;
	filled?: boolean;
	border?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: filled ? "var(--foreground)" : "var(--background)",
				color: filled ? "var(--background)" : "var(--foreground)",
				border: `${border ? 2 : 1}px solid ${border ?? "var(--border)"}`,
			}}
		>
			{children}
		</div>
	);
}
