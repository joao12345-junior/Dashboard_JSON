function FormatProviderName(name: string): string {
	return name.replace("Microsoft-Windows-", "") || "—";
}

export default FormatProviderName;
