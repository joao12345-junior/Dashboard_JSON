import { Log } from "./Log";
import { ReactNode } from "react";

/**
 * Define como uma coluna deve ser exibida na tabela.
 * Cada mapper declara suas próprias colunas extras.
 */
export interface ColumnDefinition {
	// Chave do campo no objeto Log (em `payload` ou nos campos base)
	key: string;
	// Texto exibido no cabeçalho
	label: string;
	// Largura opcional da coluna em pixels
	width?: number;
	// Função que recebe o Log e retorna o valor a exibir
	// Isso permite formatar o valor antes de mostrar (ex: moeda, datas)
	render: (log: Log) => React.ReactNode;

	// Flags de estilo — cada coluna declara como quer ser renderizada
	mono?: boolean; // usa fonte monospace (bom para mensagens e horas)
	muted?: boolean; // texto em cor secundária (bom para data e hora)
	noWrap?: boolean; // impede quebra de linha (bom para data e hora)
	numeric?: boolean; // alinha números em colunas (bom para valores)
	hideOnMobile?: boolean;
}
