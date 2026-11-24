// src/features/app-logs/programRegistry.test.ts
import { describe, expect, it } from "vitest";
import type { Log } from "../../lib/types/Log";
import {
	classifyPrograms,
	filterHiddenPrograms,
	hiddenButLogging,
	hiddenProgramNames,
	latestLogByProgram,
	type ProgramRecord,
	type ProgramVisibility,
} from "./programRegistry";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-24T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

function record(
	programa: string,
	visibility: ProgramVisibility,
	silentDays: number | null,
	logs24h = 0,
): ProgramRecord {
	return {
		programa,
		visibility,
		visibility_changed_at: null,
		last_log_at: silentDays === null ? null : daysAgo(silentDays),
		log_count: 5,
		logs_24h: logs24h,
	};
}

function appLog(programa: string | null, id: number, date = "2026-11-24", time = "10:00:00"): Log {
	return { logType: "app", id, message: "m", date, time, classe: "C", programa, tipo: "erro" };
}

describe("classifyPrograms", () => {
	const status = (r: ProgramRecord, latest = new Map<string, number>()) =>
		classifyPrograms([r], latest, NOW)[0].status;

	it("automático com log recente é ativo", () => {
		expect(status(record("a", "auto", 1))).toBe("active");
	});

	it("automático no limite exato de 5 dias ainda é ativo; passou disso é inativo", () => {
		expect(status(record("a", "auto", 5))).toBe("active");
		expect(status(record("a", "auto", 5.01))).toBe("inactive");
	});

	it("automático sem nenhum log conhecido é inativo", () => {
		expect(status(record("a", "auto", null))).toBe("inactive");
	});

	it("sempre visível ignora a inatividade", () => {
		expect(status(record("a", "shown", 30))).toBe("active");
	});

	it("oculto continua oculto mesmo recebendo logs agora", () => {
		expect(status(record("a", "hidden", 0, 37))).toBe("hidden");
	});

	it("log novo já carregado no navegador reativa programa que o servidor ainda vê como parado", () => {
		const latest = new Map([["a", NOW - 1000]]);
		expect(status(record("a", "auto", 9), latest)).toBe("active");
	});

	it("usa o mais recente entre servidor e navegador, nunca o mais antigo", () => {
		const latest = new Map([["a", NOW - 20 * DAY]]);
		expect(status(record("a", "auto", 1), latest)).toBe("active");
	});

	it("calcula dias de silêncio e nunca devolve valor negativo (relógio adiantado)", () => {
		const [p] = classifyPrograms([record("a", "auto", -1)], new Map(), NOW);
		expect(p.daysSilent).toBe(0);
	});

	it("respeita um limite diferente do padrão", () => {
		const [p] = classifyPrograms([record("a", "auto", 2)], new Map(), NOW, 1);
		expect(p.status).toBe("inactive");
	});
});

describe("hiddenProgramNames / hiddenButLogging", () => {
	const classified = classifyPrograms(
		[
			record("ativo", "auto", 1),
			record("parado", "auto", 6),
			record("fixo", "shown", 30),
			record("oculto", "hidden", 0, 37),
			record("oculto-quieto", "hidden", 8, 0),
		],
		new Map(),
		NOW,
	);

	it("esconde ocultos e inativos, não os ativos nem os sempre visíveis", () => {
		expect([...hiddenProgramNames(classified)].sort()).toEqual(["oculto", "oculto-quieto", "parado"]);
	});

	it("avisa só dos ocultos à mão que recebem logs (inativo não entra)", () => {
		expect(hiddenButLogging(classified).map((p) => p.programa)).toEqual(["oculto"]);
	});
});

describe("filterHiddenPrograms", () => {
	const win = { logType: "windows-event", id: 99 } as unknown as Log;
	const logs: Log[] = [appLog("parado", 1), appLog("ativo", 2), appLog(null, 3), win, appLog("novo", 4)];

	it("tira só os logs de programas escondidos", () => {
		const out = filterHiddenPrograms(logs, new Set(["parado"]));
		expect(out.map((l) => l.id)).toEqual([2, 3, 99, 4]);
	});

	it("logs sem programa e programas que o registro não conhece continuam visíveis", () => {
		const out = filterHiddenPrograms(logs, new Set(["inexistente"]));
		expect(out).toHaveLength(logs.length);
	});

	it("devolve a MESMA lista quando nada é escondido (não invalida useMemo)", () => {
		expect(filterHiddenPrograms(logs, new Set())).toBe(logs);
	});
});

describe("latestLogByProgram", () => {
	it("guarda o log mais recente de cada programa e ignora o que não é app", () => {
		const win = { logType: "windows-event", id: 99 } as unknown as Log;
		const latest = latestLogByProgram([
			appLog("a", 1, "2026-11-20", "09:00:00"),
			appLog("a", 2, "2026-11-22", "08:00:00"),
			appLog("b", 3, "2026-11-21", "08:00:00"),
			win,
		]);
		expect(latest.get("a")).toBe(Date.parse("2026-11-22T08:00:00"));
		expect(latest.get("b")).toBe(Date.parse("2026-11-21T08:00:00"));
		expect(latest.size).toBe(2);
	});

	it("ignora data inválida e programa vazio", () => {
		const latest = latestLogByProgram([appLog("a", 1, "lixo", "x"), appLog(null, 2), appLog("", 3)]);
		expect(latest.size).toBe(0);
	});
});
