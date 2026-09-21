// src/lib/subscribeToEventsStream.ts

import { authorizedFetch } from "../hooks/useAuth";

export interface StreamDataText {
	readonly app: number;
	readonly process: number;
	readonly "windows-event": number;
}

export async function subscribeToEventsStream(
	url: string,
	onMessage: (data: StreamDataText) => void,
	signal?: AbortSignal,
): Promise<void> {
	const response = await authorizedFetch(url, { signal });
	const reader = response.body!.getReader();

	const decoder = new TextDecoder();

	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const text = decoder.decode(value, { stream: true });
		buffer += text;

		const parts = buffer.split("\n\n");
		buffer = parts.pop() ?? "";

		parts
			.filter((s) => s.includes("data: "))
			.forEach((s) =>
				onMessage(JSON.parse(s.slice(s.indexOf(":") + 1).trim())),
			);
	}
}
