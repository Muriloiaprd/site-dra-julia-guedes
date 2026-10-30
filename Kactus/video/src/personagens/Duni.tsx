import React from 'react';
import {COR, TRACO} from '../tema';

// Duni, a treinadora: o cacto rainha do Kactus (apps/web/public/duni/duni.svg) redesenhado
// no estilo do vídeo, com olhões iguais aos do Beto. Origem (0, 0) na base do vaso.
export const Duni: React.FC<{
	x: number;
	y: number;
	escala?: number;
	boca?: 'sorriso' | 'aberta' | 'sarcastica' | 'brava';
	olhar?: [number, number];
	piscar?: number;
	bracoDireito?: number; // rotação em graus (aceno)
	vaso?: boolean;
}> = ({x, y, escala = 1, boca = 'sorriso', olhar = [0, 0], piscar = 0, bracoDireito = 0, vaso = true}) => {
	const [ox, oy] = olhar;
	const olhoH = 30 * (1 - piscar * 0.92);
	return (
		<g transform={`translate(${x} ${y}) scale(${escala})`}>
			{/* braço esquerdo (para baixo) */}
			<path
				d="M -60 -150 L -96 -150 Q -112 -150 -112 -166 L -112 -228 Q -112 -246 -96 -246 Q -80 -246 -80 -228 L -80 -182 L -60 -182"
				fill={COR.cacto}
				{...TRACO}
			/>
			{/* braço direito (levantado, acena) */}
			<g transform={`rotate(${bracoDireito} 60 -200)`}>
				<path
					d="M 60 -186 L 96 -186 Q 112 -186 112 -202 L 112 -290 Q 112 -308 96 -308 Q 80 -308 80 -290 L 80 -218 L 60 -218"
					fill={COR.cacto}
					{...TRACO}
				/>
			</g>
			{/* corpo */}
			<rect x={-64} y={-340} width={128} height={340} rx={64} fill={COR.cacto} {...TRACO} />
			{/* nervuras */}
			<path d="M -22 -300 L -22 -20" stroke={COR.cactoEscuro} strokeWidth={5} strokeLinecap="round" />
			<path d="M 22 -300 L 22 -20" stroke={COR.cactoEscuro} strokeWidth={5} strokeLinecap="round" />
			{/* espinhos */}
			{[
				[-64, -260],
				[-62, -120],
				[64, -280],
				[62, -110],
				[-40, -60],
				[40, -40],
			].map(([sx, sy], i) => (
				<g key={i} stroke={COR.tinta} strokeWidth={3} strokeLinecap="round">
					<line x1={sx} y1={sy} x2={sx + (sx < 0 ? -14 : 14)} y2={sy - 8} />
					<line x1={sx} y1={sy} x2={sx + (sx < 0 ? -14 : 14)} y2={sy + 6} />
				</g>
			))}
			{/* rosto */}
			<ellipse cx={-26} cy={-250} rx={24} ry={olhoH} fill={COR.branco} {...TRACO} />
			<ellipse cx={26} cy={-250} rx={24} ry={olhoH} fill={COR.branco} {...TRACO} />
			{piscar < 0.6 ? (
				<>
					<circle cx={-23 + ox} cy={-245 + oy} r={10} fill={COR.tinta} />
					<circle cx={23 + ox} cy={-245 + oy} r={10} fill={COR.tinta} />
				</>
			) : null}
			{/* cílios de rainha */}
			<path d="M -46 -276 l -10 -8 M -36 -282 l -6 -10" {...TRACO} strokeWidth={3} />
			<path d="M 46 -276 l 10 -8 M 36 -282 l 6 -10" {...TRACO} strokeWidth={3} />
			<ellipse cx={-44} cy={-206} rx={13} ry={7} fill={COR.rosa} />
			<ellipse cx={44} cy={-206} rx={13} ry={7} fill={COR.rosa} />
			{boca === 'aberta' ? <ellipse cx={0} cy={-200} rx={15} ry={12} fill={COR.tinta} /> : null}
			{boca === 'sorriso' ? <path d="M -18 -206 q 18 20 36 0" fill="none" {...TRACO} /> : null}
			{boca === 'sarcastica' ? <path d="M -16 -200 q 18 4 32 -10" fill="none" {...TRACO} /> : null}
			{boca === 'brava' ? <path d="M -16 -196 q 16 -12 32 0" fill="none" {...TRACO} /> : null}
			{/* coroa */}
			<g transform="rotate(-10 0 -340)">
				<path
					d="M -46 -332 L -52 -392 L -26 -364 L 0 -404 L 26 -364 L 52 -392 L 46 -332 Z"
					fill={COR.ouro}
					{...TRACO}
				/>
				<circle cx={0} cy={-356} r={7} fill={COR.vermelho} stroke={COR.tinta} strokeWidth={3} />
			</g>
			{/* vaso */}
			{vaso ? (
				<path d="M -84 -12 L 84 -12 L 66 86 L -66 86 Z" fill={COR.vermelho} {...TRACO} />
			) : null}
			{vaso ? <rect x={-94} y={-26} width={188} height={30} rx={8} fill="#D9433A" {...TRACO} /> : null}
		</g>
	);
};
