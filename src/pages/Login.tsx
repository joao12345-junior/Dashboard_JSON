import { useAuth } from "../hooks/useAuth";
import React, { useState, useCallback } from "react";
import { ThemeToggleButton } from "../components/ThemeButton";

// ─── LoginPage ────────────────────────────────────────────────────────────────
export function LoginPage() {
	const { login } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = useCallback(async () => {
		if (!username.trim() || !password.trim()) {
			setError("Preencha todos os campos.");
			return;
		}
		setIsLoading(true);
		await new Promise((r) => setTimeout(r, 500));
		const success = login({
			username: username.trim(),
			password: password.trim(),
		});
		if (!success) {
			setError("Usuário ou senha inválidos.");
			setIsLoading(false);
		}
	}, [username, password, login]);

	const inputStyle: React.CSSProperties = {
		width: "100%",
		padding: "10px 14px",
		borderRadius: 7,
		border: "1px solid var(--border)",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: 14,
		fontFamily: "inherit",
		outline: "none",
		boxSizing: "border-box",
	};

	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "var(--background)",
				padding: 16,
			}}
		>
			<div
				style={{
					position: "fixed",
					inset: 0,
					pointerEvents: "none",
					backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
					backgroundSize: "40px 40px",
					opacity: 0.4,
				}}
			/>

			{/* Theme toggle no canto superior direito da tela de login */}
			<div style={{ position: "fixed", top: 16, right: 16, zIndex: 10 }}>
				<ThemeToggleButton />
			</div>

			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 380,
					padding: 40,
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 12,
					boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
				}}
			>
				<div style={{ textAlign: "center", marginBottom: 32 }}>
					<div
						style={{
							width: 52,
							height: 52,
							borderRadius: 12,
							backgroundColor: "var(--primary)",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--primary-foreground)",
							fontSize: 20,
							fontWeight: 900,
							marginBottom: 14,
						}}
					>
						L
					</div>
					<div
						style={{
							fontSize: 18,
							fontWeight: 800,
							color: "var(--foreground)",
							letterSpacing: "-0.04em",
						}}
					>
						LogDash
					</div>
					<div
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							marginTop: 4,
						}}
					>
						Acesso restrito ao painel
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					<div>
						<label
							style={{
								display: "block",
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								marginBottom: 6,
							}}
						>
							Usuário
						</label>
						<input
							type="text"
							value={username}
							placeholder="ADM"
							autoComplete="username"
							onChange={(e) => {
								setUsername(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							style={inputStyle}
						/>
					</div>
					<div>
						<label
							style={{
								display: "block",
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								marginBottom: 6,
							}}
						>
							Senha
						</label>
						<input
							type="password"
							value={password}
							placeholder="••••••••"
							autoComplete="current-password"
							onChange={(e) => {
								setPassword(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
							style={inputStyle}
						/>
					</div>
					{error && (
						<div
							style={{
								fontSize: 12,
								color: "var(--status-error)",
								textAlign: "center",
								padding: "8px 12px",
								backgroundColor: `color-mix(in oklch, var(--status-error) 8%, transparent)`,
								borderRadius: 6,
								border: `1px solid color-mix(in oklch, var(--status-error) 22%, transparent)`,
							}}
						>
							{error}
						</div>
					)}
					<button
						onClick={handleSubmit}
						disabled={isLoading}
						style={{
							marginTop: 4,
							padding: "11px 16px",
							borderRadius: 7,
							border: "none",
							backgroundColor: isLoading ? "var(--muted)" : "var(--primary)",
							color: isLoading
								? "var(--muted-foreground)"
								: "var(--primary-foreground)",
							fontSize: 14,
							fontWeight: 700,
							cursor: isLoading ? "not-allowed" : "pointer",
							fontFamily: "inherit",
						}}
					>
						{isLoading ? "Autenticando..." : "Entrar"}
					</button>
				</div>

				<div
					style={{
						marginTop: 24,
						textAlign: "center",
						fontSize: 11,
						color: "var(--muted-foreground)",
						padding: "10px 14px",
						backgroundColor: "var(--muted)",
						borderRadius: 6,
					}}
				>
					Usuário: <strong>ADM</strong> · Senha: <strong>admin123</strong>
				</div>
			</div>
		</div>
	);
}
