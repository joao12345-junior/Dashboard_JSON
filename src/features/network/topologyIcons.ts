// src/features/network/topologyIcons.ts
import {
	AirVent,
	Camera,
	HardDrive,
	Laptop,
	Monitor,
	Printer,
	Server,
	Smartphone,
	Tablet,
	Tv,
	type LucideIcon,
} from "lucide-react";
import type { NetworkClient } from "./hooks/useNetworkState";
import { clientTitle } from "./sortClients";

/** Palavra-chave (nome, hostname ou fabricante) → ícone. A primeira regra que casa vence. */
const RULES: ReadonlyArray<[RegExp, LucideIcon]> = [
	[/(\btv\b|webos|smart ?tv|chromecast|roku|plex)/i, Tv],
	[/\b(servidor|server|backup|nas|asustor|synology|qnap|serv|srv)\b/i, Server],
	[/\b(impressora|printer|epson|brother|hp ?inc|canon|ricoh)\b/i, Printer],
	[/\b(c[aâ]mera|cam|hikvision|intelbras|dahua)\b/i, Camera],
	[/\b(ar|ar-condicionado|split|midea|daikin|fujitsu general)\b/i, AirVent],
	[/\b(ipad|tablet|tab)\b/i, Tablet],
	[/\b(iphone|android|galaxy|samsung|xiaomi|motorola|apple)\b/i, Smartphone],
	[/\b(storage|disk|hd)\b/i, HardDrive],
];

/// <summary>
/// Escolhe o ícone do cliente por heurística (o UniFi tem um banco de "fingerprints";
/// aqui é só palavra-chave). Sem pista: cabo = monitor (desktop), Wi-Fi = notebook.
/// </summary>
export function clientIcon(c: NetworkClient): LucideIcon {
	const text = [clientTitle(c), c.hostname, c.vendor, c.note].filter(Boolean).join(" ");
	for (const [pattern, icon] of RULES) {
		if (pattern.test(text)) return icon;
	}
	return c.is_wired ? Monitor : Laptop;
}
