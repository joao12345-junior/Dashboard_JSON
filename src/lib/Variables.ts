// src/lib/Variables.ts

export const START_STATUS = Object.freeze({
	ALL: "all",
	STARTED: "started",
	FINISHED: "finished",
	ERRO: "erro",
});
export const INITIAL_FILTERS = Object.freeze({
	message: "",
	date: "",
	start: START_STATUS.ALL,
});
export const PAGE_SIZE = 100;
export const MAX_PAGES = 30;
