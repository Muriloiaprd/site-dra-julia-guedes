import React from 'react';
import {staticFile} from 'remotion';
import {COR, FONTE, TRACO} from '../tema';

// Objetos de cena reaproveitados: telas (PC e celular), cartões do app, tênis, olhos de objeto.

export const Monitor: React.FC<{x: number; y: number; w: number; h: number; children?: React.ReactNode}> = ({
	x,
	y,
	w,
	h,
	children,
}) => (
	<g>
		<rect x={x + w / 2 - 50} y={y + h + 10} width={100} height={70} fill="#3A3A3A" {...TRACO} />
		<rect x={x + w / 2 - 150} y={y + h + 74} width={300} height={22} rx={10} fill="#3A3A3A" {...TRACO} />
		<rect x={x - 22} y={y - 22} width={w + 44} height={h + 44} rx={26} fill="#2E2E2E" {...TRACO} />
		<svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
			<rect width={w} height={h} fill={COR.tela} />
			{children}
		</svg>
		<rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={COR.tinta} strokeWidth={3} />
	</g>
);

export const Celular: React.FC<{x: number; y: number; w: number; h: number; rot?: number; children?: React.ReactNode}> = ({
	x,
	y,
	w,
	h,
	rot = 0,
	children,
}) => (
	<g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
		<rect x={x - 14} y={y - 14} width={w + 28} height={h + 28} rx={w * 0.16} fill="#2E2E2E" {...TRACO} />
		<svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
			<rect width={w} height={h} rx={w * 0.12} fill={COR.tela} />
			{children}
		</svg>
		<rect x={x + w / 2 - w * 0.17} y={y + 10} width={w * 0.34} height={Math.max(14, w * 0.07)} rx={10} fill="#000" />
	</g>
);

// Cartão escuro, igual aos do app (título pequeno cinza, valor grande).
export const Cartao: React.FC<{
	x: number;
	y: number;
	w: number;
	h: number;
	titulo: string;
	valor: string;
	cor?: string;
	tamanho?: number;
}> = ({x, y, w, h, titulo, valor, cor = COR.neon, tamanho = 54}) => (
	<g>
		<rect x={x} y={y} width={w} height={h} rx={18} fill={COR.telaCartao} stroke={COR.telaBorda} strokeWidth={3} />
		<text x={x + 24} y={y + 46} fontFamily={FONTE} fontWeight={700} fontSize={26} fill={COR.textoTelaFraco}>
			{titulo}
		</text>
		<text x={x + 24} y={y + 46 + tamanho * 1.15} fontFamily={FONTE} fontWeight={900} fontSize={tamanho} fill={cor}>
			{valor}
		</text>
	</g>
);

// Plaquinha clara (as que "saltam" do app), levemente torta.
export const Plaquinha: React.FC<{
	x: number;
	y: number;
	texto: string;
	sub?: string;
	rot?: number;
	cor?: string;
	tamanho?: number;
}> = ({x, y, texto, sub, rot = 0, cor = COR.amarelo, tamanho = 40}) => {
	const w = Math.max(texto.length, (sub ?? '').length * 0.8) * tamanho * 0.62 + 60;
	const h = sub ? tamanho * 2.6 : tamanho * 1.8;
	return (
		<g transform={`rotate(${rot} ${x} ${y})`}>
			<rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={18} fill={cor} {...TRACO} />
			<text
				x={x}
				y={sub ? y - tamanho * 0.15 : y + tamanho * 0.35}
				textAnchor="middle"
				fontFamily={FONTE}
				fontWeight={900}
				fontSize={tamanho}
				fill={COR.tinta}
			>
				{texto}
			</text>
			{sub ? (
				<text x={x} y={y + tamanho * 0.85} textAnchor="middle" fontFamily={FONTE} fontWeight={700} fontSize={tamanho * 0.62} fill={COR.tinta}>
					{sub}
				</text>
			) : null}
		</g>
	);
};

// Par de olhos com sobrancelha, para dar cara aos objetos.
export const OlhosObjeto: React.FC<{x: number; y: number; r?: number; bravo?: boolean; olhar?: [number, number]}> = ({
	x,
	y,
	r = 16,
	bravo = false,
	olhar = [0, 0],
}) => (
	<g>
		{[-1, 1].map((lado) => (
			<g key={lado}>
				<ellipse cx={x + lado * r * 1.15} cy={y} rx={r} ry={r * 1.2} fill={COR.branco} {...TRACO} strokeWidth={4} />
				<circle cx={x + lado * r * 1.15 + olhar[0]} cy={y + 3 + olhar[1]} r={r * 0.4} fill={COR.tinta} />
				{bravo ? (
					<path
						d={`M ${x + lado * r * 2.2} ${y - r * 1.6} L ${x + lado * r * 0.3} ${y - r * 1.0}`}
						{...TRACO}
						strokeWidth={5}
					/>
				) : null}
			</g>
		))}
	</g>
);

// Tênis de lado. Origem no meio da sola.
export const Tenis: React.FC<{x: number; y: number; escala?: number; velho?: boolean; espelhar?: boolean}> = ({
	x,
	y,
	escala = 1,
	velho = false,
	espelhar = false,
}) => (
	<g transform={`translate(${x} ${y}) scale(${espelhar ? -escala : escala} ${escala})`}>
		<path
			d="M -150 -22 L -150 -100 Q -150 -128 -120 -128 L -50 -128 Q 20 -125 52 -64 L 140 -46 Q 168 -38 160 -22 Z"
			fill={velho ? '#B9A48A' : COR.azul}
			{...TRACO}
		/>
		<rect x={-158} y={-24} width={326} height={26} rx={12} fill={velho ? '#E8E0D0' : COR.branco} {...TRACO} />
		<path d="M -20 -112 l 30 12 M -6 -98 l 30 12 M 8 -84 l 30 12" {...TRACO} strokeWidth={4} />
		{velho ? (
			<>
				<rect x={-130} y={-96} width={50} height={40} fill="#E06C5A" {...TRACO} strokeWidth={4} transform="rotate(-8 -105 -76)" />
				<path d="M -128 -92 l 8 6 M -116 -96 l 8 6 M -104 -100 l 8 6" stroke={COR.tinta} strokeWidth={2} />
				<rect x={70} y={-58} width={40} height={30} fill="#5A9BE0" {...TRACO} strokeWidth={4} transform="rotate(10 90 -43)" />
				<circle cx={-40} cy={-50} r={10} fill={COR.tinta} />
				<path d="M 120 2 l 10 10 M 140 2 l 6 12" {...TRACO} strokeWidth={3} />
			</>
		) : (
			<path d="M -120 -60 L 40 -60" stroke={COR.branco} strokeWidth={10} strokeLinecap="round" />
		)}
	</g>
);

export const LogoKactus: React.FC<{x: number; y: number; w: number; simbolo?: boolean}> = ({x, y, w, simbolo = false}) =>
	simbolo ? (
		<image href={staticFile('brand/kactus-simbolo.png')} x={x} y={y} width={w} height={w * (255 / 240)} />
	) : (
		<image href={staticFile('brand/kactus-wordmark.png')} x={x} y={y} width={w} height={w * (160 / 734)} />
	);

export const Brilho: React.FC<{x: number; y: number; r?: number; cor?: string}> = ({x, y, r = 22, cor = COR.amarelo}) => (
	<path
		d={`M ${x} ${y - r} Q ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y} Q ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r} Q ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y} Q ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r} Z`}
		fill={cor}
		stroke={COR.tinta}
		strokeWidth={3}
	/>
);
