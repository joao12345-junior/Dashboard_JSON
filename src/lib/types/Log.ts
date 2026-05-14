// src/lib/types/Log.ts
export interface Log {
	message: string;
	date: string;
	time: string; // ← estava faltando
	status: number;
	length?: number;
}
