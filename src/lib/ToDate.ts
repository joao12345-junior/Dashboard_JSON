export function toDate(data: string) {
	return data.split("/").reverse().join("-");
}
