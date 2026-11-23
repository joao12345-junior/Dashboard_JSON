// src/components/DataGate.tsx
import type { ReactNode } from "react";
import { ErrorState } from "./Error";
import { LoadingNotice } from "./LoadingNotice";
import { LoadingState } from "./Loading";
import type { DataState } from "../lib/loadStatus";

interface DataGateProps {
	/** Estado já resolvido por `getDataStatus` (carregando / pronto / erro). */
	dataState: DataState;
	/** 0–100, mostrado no aviso "carregando". */
	percent: number;
	/** Mensagem de erro de qualquer fonte, ou null. */
	error: string | null;
	/**
	 * Já chegou ao menos um registro desta fonte? Decide se dá para mostrar
	 * números parciais (com aviso) ou se ainda não há nada de verdadeiro a mostrar.
	 */
	hasData: boolean;
	/** Tentar de novo (recarregar da API). */
	onRetry: () => void;
	/**
	 * Mostrado quando terminou de carregar e não veio nenhum registro.
	 * Se omitido, o conteúdo aparece mesmo assim (zeros reais, não de carga).
	 */
	emptyMessage?: ReactNode;
	children: ReactNode;
}

/**
 * Porteiro do conteúdo dos dashboards.
 *
 * Antes, cada dashboard desenhava KPIs e gráficos direto: durante a carga
 * apareciam zeros (e em Logs Gerais até "nenhum log registrado ainda"), e um
 * erro da API era ignorado porque só o erro da fonte estática era olhado.
 *
 * Regras:
 *  - carregando e sem nenhum registro → só o spinner (zeros seriam mentira);
 *  - carregando com registros parciais → aviso "totais incompletos" + conteúdo;
 *  - erro → banner com "Tentar de novo"; o conteúdo continua visível se já
 *    havia registros (o banner diz que pode estar incompleto);
 *  - pronto e vazio → `emptyMessage`, se houver.
 *
 * Não decide NADA sobre os dados: recebe o estado pronto de `getDataStatus`
 * (camada de dados) e só escolhe o que mostrar (camada de apresentação).
 */
export function DataGate({
	dataState,
	percent,
	error,
	hasData,
	onRetry,
	emptyMessage,
	children,
}: DataGateProps) {
	const loading = dataState === "loading";
	const failed = dataState === "error";

	let body: ReactNode = children;
	if (loading && !hasData) {
		body = <LoadingState label="Carregando registros…" />;
	} else if (failed && !hasData) {
		body = null;
	} else if (dataState === "ready" && !hasData && emptyMessage) {
		body = emptyMessage;
	}

	return (
		<div
			aria-busy={loading}
			style={{ display: "flex", flexDirection: "column", gap: 24 }}
		>
			{failed && (
				<ErrorState
					message={error ?? "Falha ao carregar os registros."}
					onRetry={onRetry}
				/>
			)}
			{loading && hasData && <LoadingNotice percent={percent} />}
			{body}
		</div>
	);
}
