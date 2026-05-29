import { btnSecondary } from "../../lib/styles/buttonStyles";

interface Menu {
	id: number;
	onClick: () => void;
}

export function MenuLocationPastas({ onClick }: Menu) {
	onClick = () => {
		console.log("MenuLocationPastas clicked");
		<section>
			<h2>Configurações de Pastas</h2>
			<p>
				Aqui você pode configurar os caminhos das pastas onde os logs estão
				armazenados.
			</p>
			{/* Formulário para configurar os caminhos das pastas */}
			<form>
				<label>
					Caminho da Pasta de Logs:
					<input type="text" placeholder="Digite o caminho da pasta de logs" />
				</label>
				<button type="submit" style={btnSecondary}>
					Salvar Configurações
				</button>
			</form>
		</section>;
	};
	return (
		<button style={btnSecondary} onClick={onClick}>
			Adicionar Caminho
		</button>
	);
}
