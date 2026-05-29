// src/features/settings/menuLocationPastas.tsx
import { useState, useRef, useEffect } from "react";
import { Modal } from "./modal";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";

interface MenuProps {
	id?: number;
	existingPaths?: string[];
	onSave?: (paths: string[]) => void;
	onRemove?: (path: string) => void;
}

export function MenuLocationPastas({
	existingPaths = [],
	onSave,
	onRemove,
}: MenuProps) {
	const [open, setOpen] = useState(false);
	const [logPath, setLogPath] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (open) {
			const t = setTimeout(() => inputRef.current?.focus(), 50);
			return () => clearTimeout(t);
		}
	}, [open]);

	function handleSave() {
		const trimmed = logPath.trim();
		if (!trimmed) return;
		const next = Array.from(new Set([trimmed, ...existingPaths]));
		if (onSave) onSave(next);
		setLogPath("");
		setOpen(false);
	}

	return (
		<>
			<button style={btnPrimary} onClick={() => setOpen(true)}>
				Adicionar Caminho
			</button>

			<Modal
				isOpen={open}
				onClose={() => setOpen(false)}
				title="Configurações de Pastas"
			>
				<p
					style={{
						color: "var(--color-muted-foreground, var(--muted-foreground))",
						marginTop: 0,
					}}
				>
					Aqui você pode configurar os caminhos das pastas onde os logs estão
					armazenados.
				</p>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSave();
					}}
				>
					<label style={{ display: "block", marginBottom: 12 }}>
						Caminho da Pasta de Logs:
						<input
							ref={inputRef}
							type="text"
							placeholder="Digite o caminho da pasta de logs"
							value={logPath}
							onChange={(e) => setLogPath(e.target.value)}
							style={{
								marginTop: 8,
								width: "100%",
								padding: "8px 10px",
								borderRadius: "6px",
								border: "1px solid var(--color-border, var(--border))",
								background: "var(--color-input, var(--input))",
								color:
									"var(--color-popover-foreground, var(--popover-foreground))",
							}}
						/>
					</label>

					<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
						<button type="submit" style={btnPrimary}>
							Salvar Configurações
						</button>
						<button
							style={btnSecondary}
							type="button"
							onClick={() => setOpen(false)}
						>
							Cancelar
						</button>
					</div>
				</form>

				{existingPaths.length > 0 && (
					<section style={{ marginTop: 16 }}>
						<h4 style={{ margin: "8px 0" }}>Caminhos salvos</h4>
						<ul
							style={{
								padding: 0,
								margin: 0,
								listStyle: "none",
								display: "grid",
								gap: 8,
							}}
						>
							{existingPaths.map((p) => (
								<li
									key={p}
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 8,
										padding: "8px",
										borderRadius: 6,
										background: "var(--color-card, var(--card))",
										color:
											"var(--color-card-foreground, var(--card-foreground))",
										border: "1px solid var(--color-border, var(--border))",
									}}
								>
									<span
										style={{
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											flex: 1,
										}}
									>
										{p}
									</span>
									<div style={{ display: "flex", gap: 8 }}>
										<button
											type="button"
											onClick={() => {
												if (onRemove) onRemove(p);
											}}
											style={btnSecondary}
											title="Remover"
										>
											Remover
										</button>
									</div>
								</li>
							))}
						</ul>
					</section>
				)}
			</Modal>
		</>
	);
}
