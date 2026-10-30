import React from 'react';
import {COR, FONTE, TRACO} from '../tema';

// Balão de fala desenhado em SVG. (x, y) é o canto superior esquerdo; (px, py) é a ponta do rabinho.
export const Balao: React.FC<{
	x: number;
	y: number;
	w: number;
	linhas: string[];
	px: number;
	py: number;
	tamanho?: number;
	cor?: string;
	corTexto?: string;
	grito?: boolean;
}> = ({x, y, w, linhas, px, py, tamanho = 40, cor = COR.branco, corTexto = COR.tinta, grito = false}) => {
	const altLinha = tamanho * 1.25;
	const h = linhas.length * altLinha + tamanho * 1.1;
	const cx = x + w / 2;
	const cy = y + h / 2;
	// base do rabinho: ponto da borda mais próximo da ponta
	const bx = Math.max(x + 40, Math.min(x + w - 40, px));
	const embaixo = py > cy;
	const by = embaixo ? y + h - 4 : y + 4;
	const rabo = `M ${bx - 26} ${by} L ${px} ${py} L ${bx + 26} ${by}`;
	return (
		<g>
			<path d={rabo} fill={cor} {...TRACO} />
			{grito ? (
				<polygon points={espinhos(cx, cy, w / 2 + 30, h / 2 + 30)} fill={cor} {...TRACO} />
			) : (
				<rect x={x} y={y} width={w} height={h} rx={Math.min(46, h / 2)} fill={cor} {...TRACO} />
			)}
			{/* cobre a junção do rabinho com a borda */}
			<path d={`M ${bx - 22} ${by} L ${bx + 22} ${by}`} stroke={cor} strokeWidth={8} />
			{linhas.map((l, i) => (
				<text
					key={i}
					x={cx}
					y={y + tamanho * 0.55 + altLinha * (i + 0.8)}
					textAnchor="middle"
					fontFamily={FONTE}
					fontWeight={700}
					fontSize={tamanho}
					fill={corTexto}
				>
					{l}
				</text>
			))}
		</g>
	);
};

function espinhos(cx: number, cy: number, rx: number, ry: number) {
	const pts: string[] = [];
	const n = 18;
	for (let i = 0; i < n * 2; i++) {
		const a = (Math.PI * i) / n;
		const f = i % 2 === 0 ? 1 : 0.82;
		pts.push(`${cx + Math.cos(a) * rx * f},${cy + Math.sin(a) * ry * f}`);
	}
	return pts.join(' ');
}
