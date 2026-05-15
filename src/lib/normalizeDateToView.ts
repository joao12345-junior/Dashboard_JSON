export function normalizeDateToView(date: string): string {
	return date.split("-").reverse().join("/");
}
