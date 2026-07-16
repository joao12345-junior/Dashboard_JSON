import { type SVGProps } from "react";

interface LogDashLogoProps extends SVGProps<SVGSVGElement> {
	className?: string;
}

export function LogDashLogo({ className, style, ...props }: LogDashLogoProps) {
	return (
		<svg
			viewBox="0 0 128 128"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="LogDash Logo: A tech dome with log charts inside a rounded panel"
			// Estilos inline de alta segurança:
			style={{
				flexShrink: 0, // IMPEDE o Flexbox de esmagar o ícone para 0px
				display: "inline-block",
				...style, // Permite que você mude o tamanho externamente se quiser
			}}
			// Caso use Tailwind, as classes abaixo são aplicadas
			className={`select-none ${className || ""}`}
			{...props}
		>
			<defs>
				{/* Definições de cores e gradientes */}
				<linearGradient id="ld-pill-light" x1="0" y1="1" x2="1" y2="0">
					<stop offset="50%" stopColor="#00F0FF" />
					<stop offset="50%" stopColor="#002C5B" />
				</linearGradient>

				<linearGradient id="ld-pill-dark" x1="0" y1="1" x2="1" y2="0">
					<stop offset="50%" stopColor="#00F0FF" />
					<stop offset="50%" stopColor="#0A2540" />
				</linearGradient>

				{/* Efeito Glow para o Modo Escuro */}
				<filter id="ld-glow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="2" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* ================= MODO CLARO ================= */}
			<g className="block dark:hidden">
				{/* Moldura externa azul escuro */}
				<rect x="12" y="12" width="104" height="104" rx="28" fill="#002C5B" />

				{/* Fundo interno branco */}
				<rect x="22" y="22" width="84" height="84" rx="18" fill="#FFFFFF" />

				{/* Cúpula/Domo central */}
				<path d="M 34 100 C 34 36, 94 36, 94 100 Z" fill="#002C5B" />

				{/* Barras de Logs (Ciano) */}
				<rect x="52" y="80" width="3.5" height="20" rx="1.75" fill="#00F0FF" />
				<rect
					x="58.5"
					y="72"
					width="3.5"
					height="28"
					rx="1.75"
					fill="#00F0FF"
				/>
				<rect x="65" y="76" width="3.5" height="24" rx="1.75" fill="#00F0FF" />
				<rect
					x="71.5"
					y="56"
					width="3.5"
					height="44"
					rx="1.75"
					fill="#00F0FF"
				/>
				<rect x="78" y="46" width="3.5" height="54" rx="1.75" fill="#00F0FF" />
				<rect
					x="84.5"
					y="52"
					width="3.5"
					height="48"
					rx="1.75"
					fill="#00F0FF"
				/>

				{/* Pílula de detalhe superior direito */}
				<g transform="translate(90, 38) rotate(-45)">
					<rect
						x="-3"
						y="-6"
						width="6"
						height="12"
						rx="3"
						fill="url(#ld-pill-light)"
					/>
				</g>
			</g>

			{/* ================= MODO ESCURO ================= */}
			<g className="hidden dark:block">
				{/* Moldura externa com borda sutilmente brilhante */}
				<rect
					x="12"
					y="12"
					width="104"
					height="104"
					rx="28"
					fill="#002C5B"
					stroke="#00F0FF"
					strokeWidth="1"
				/>

				{/* Fundo interno azul escuro espacial */}
				<rect x="22" y="22" width="84" height="84" rx="18" fill="#050B14" />

				{/* Cúpula/Domo central */}
				<path d="M 34 100 C 34 36, 94 36, 94 100 Z" fill="#0A2540" />

				{/* Barras de Logs brilhantes (Glow) */}
				<g filter="url(#ld-glow)">
					<rect
						x="52"
						y="80"
						width="3.5"
						height="20"
						rx="1.75"
						fill="#00F0FF"
					/>
					<rect
						x="58.5"
						y="72"
						width="3.5"
						height="28"
						rx="1.75"
						fill="#00F0FF"
					/>
					<rect
						x="65"
						y="76"
						width="3.5"
						height="24"
						rx="1.75"
						fill="#00F0FF"
					/>
					<rect
						x="71.5"
						y="56"
						width="3.5"
						height="44"
						rx="1.75"
						fill="#00F0FF"
					/>
					<rect
						x="78"
						y="46"
						width="3.5"
						height="54"
						rx="1.75"
						fill="#00F0FF"
					/>
					<rect
						x="84.5"
						y="52"
						width="3.5"
						height="48"
						rx="1.75"
						fill="#00F0FF"
					/>
				</g>

				{/* Pílula de detalhe superior direito brilhante */}
				<g transform="translate(90, 38) rotate(-45)" filter="url(#ld-glow)">
					<rect
						x="-3"
						y="-6"
						width="6"
						height="12"
						rx="3"
						fill="url(#ld-pill-dark)"
					/>
				</g>
			</g>
		</svg>
	);
}

export default LogDashLogo;
