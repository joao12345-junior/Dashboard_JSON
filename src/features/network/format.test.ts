// src/features/network/format.test.ts
import { describe, expect, it } from "vitest";
import {
	formatBitrate,
	formatBytes,
	formatSince,
	formatUptime,
	isPollerStale,
	isWeakSignal,
	signalQuality,
} from "./format";

describe("formatBytes / formatBitrate", () => {
	it("null vira travessão", () => {
		expect(formatBytes(null)).toBe("—");
		expect(formatBitrate(null)).toBe("—");
	});

	it("bytes usam base 1024", () => {
		expect(formatBytes(0)).toBe("0 B");
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1536)).toBe("1,5 KB");
	});

	it("bits por segundo usam base 1000", () => {
		expect(formatBitrate(834_328)).toBe("834,3 kbps");
		expect(formatBitrate(1_500_000)).toBe("1,5 Mbps");
	});
});

describe("formatUptime", () => {
	it("escolhe a maior unidade útil", () => {
		expect(formatUptime(null)).toBe("—");
		expect(formatUptime(59)).toBe("< 1 min");
		expect(formatUptime(3 * 3600 + 12 * 60)).toBe("3 h 12 min");
		expect(formatUptime(50 * 86400 + 5 * 3600)).toBe("50 d 5 h");
	});
});

describe("formatSince", () => {
	const now = new Date("2026-11-24T15:00:00Z");
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

	it("cobre cada faixa", () => {
		expect(formatSince(null, now)).toBe("—");
		expect(formatSince(ago(30), now)).toBe("agora há pouco");
		expect(formatSince(ago(5 * 60), now)).toBe("há 5 min");
		expect(formatSince(ago(3 * 3600), now)).toBe("há 3 h");
		expect(formatSince(ago(47 * 3600), now)).toBe("há 47 h");
		expect(formatSince(ago(72 * 3600), now)).toBe("há 3 d");
	});

	it("data no futuro (relógio desencontrado) não vira número negativo", () => {
		expect(formatSince(ago(-120), now)).toBe("agora há pouco");
	});
});

describe("isPollerStale", () => {
	const now = new Date("2026-11-24T15:00:00Z");
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

	it("sem dado ainda não é considerado velho", () => {
		expect(isPollerStale(null, now)).toBe(false);
	});

	it("velho só passando de 3 minutos", () => {
		expect(isPollerStale(ago(120), now)).toBe(false);
		expect(isPollerStale(ago(180), now)).toBe(false);
		expect(isPollerStale(ago(181), now)).toBe(true);
	});
});

describe("sinal Wi-Fi", () => {
	it("fraco a partir de -75 dBm", () => {
		expect(isWeakSignal(-75)).toBe(true);
		expect(isWeakSignal(-74)).toBe(false);
		expect(isWeakSignal(null)).toBe(false);
	});

	it("qualidade por faixa", () => {
		expect(signalQuality(null)).toBe("—");
		expect(signalQuality(-60)).toBe("ótimo");
		expect(signalQuality(-61)).toBe("bom");
		expect(signalQuality(-70)).toBe("bom");
		expect(signalQuality(-71)).toBe("razoável");
		expect(signalQuality(-74)).toBe("razoável");
		expect(signalQuality(-75)).toBe("fraco");
	});
});
