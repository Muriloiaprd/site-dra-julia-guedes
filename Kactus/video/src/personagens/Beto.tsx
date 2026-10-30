import React from 'react';
import {COR, TRACO} from '../tema';

// Beto, o corredor. Origem (0, 0) no quadril; a cabeça fica em y = -290.
// Braços: cotovelo (e) e mão (m) relativos ao ombro.
type Braco = {e: [number, number]; m: [number, number]};
export type PoseBeto =
	| 'parado'
	| 'relogio'
	| 'desespero'
	| 'arremesso'
	| 'apontar'
	| 'abraco'
	| 'susto'
	| 'segurando'
	| 'tchau';
export type BocaBeto = 'neutra' | 'sorriso' | 'aberta' | 'dor' | 'preocupada' | 'o';

const POSES: Record<PoseBeto, {l: Braco; r: Braco}> = {
	parado: {l: {e: [-30, 75], m: [-42, 155]}, r: {e: [30, 75], m: [42, 155]}},
	relogio: {l: {e: [-30, 75], m: [-42, 155]}, r: {e: [70, 95], m: [-25, 45]}},
	desespero: {l: {e: [-85, -35], m: [-40, -120]}, r: {e: [85, -35], m: [40, -120]}},
	arremesso: {l: {e: [-75, 10], m: [-135, -10]}, r: {e: [55, -85], m: [40, -180]}},
	apontar: {l: {e: [-30, 75], m: [-42, 155]}, r: {e: [85, -5], m: [180, -35]}},
	abraco: {l: {e: [70, 40], m: [175, 15]}, r: {e: [95, 25], m: [185, 0]}},
	susto: {l: {e: [-75, -60], m: [-115, -135]}, r: {e: [75, -60], m: [115, -135]}},
	segurando: {l: {e: [-45, 85], m: [15, 55]}, r: {e: [45, 85], m: [-10, 50]}},
	tchau: {l: {e: [-30, 75], m: [-42, 155]}, r: {e: [80, -40], m: [95, -140]}},
};

export const Beto: React.FC<{
	x: number;
	y: number;
	escala?: number;
	pose?: PoseBeto;
	boca?: BocaBeto;
	olhar?: [number, number];
	sentado?: boolean;
	suor?: boolean;
	relogio?: boolean;
	sobrancelha?: 'triste' | 'brava' | 'alta';
	piscar?: number; // 0 aberto, 1 fechado
	espelhar?: boolean;
	children?: React.ReactNode; // objeto na mão direita (desenhado na posição da mão)
}> = ({
	x,
	y,
	escala = 1,
	pose = 'parado',
	boca = 'neutra',
	olhar = [0, 0],
	sentado = false,
	suor = false,
	relogio = false,
	sobrancelha,
	piscar = 0,
	espelhar = false,
	children,
}) => {
	const {l, r} = POSES[pose];
	const ombroL: [number, number] = [-46, -185];
	const ombroR: [number, number] = [46, -185];
	const mao = (o: [number, number], b: Braco): [number, number] => [o[0] + b.m[0], o[1] + b.m[1]];
	const cot = (o: [number, number], b: Braco): [number, number] => [o[0] + b.e[0], o[1] + b.e[1]];
	const braco = (o: [number, number], b: Braco) => {
		const [ex, ey] = cot(o, b);
		const [mx, my] = mao(o, b);
		return `M ${o[0]} ${o[1]} Q ${ex} ${ey} ${mx} ${my}`;
	};
	const mR = mao(ombroR, r);
	const mL = mao(ombroL, l);

	const pernas = sentado
		? ['M -24 0 Q -44 40 -46 150', 'M 24 0 Q 44 40 46 150']
		: ['M -24 0 Q -36 95 -38 190', 'M 24 0 Q 36 95 38 190'];
	const pe = sentado ? 150 : 190;
	const olhoH = 38 * (1 - piscar * 0.92);
	const [ox, oy] = olhar;

	return (
		<g transform={`translate(${x} ${y}) scale(${espelhar ? -escala : escala} ${escala})`}>
			{/* pernas */}
			{pernas.map((d, i) => (
				<path key={i} d={d} fill="none" {...TRACO} strokeWidth={6} />
			))}
			<ellipse cx={-50} cy={pe + 4} rx={22} ry={11} fill={COR.tinta} />
			<ellipse cx={50} cy={pe + 4} rx={22} ry={11} fill={COR.tinta} />
			{/* short */}
			<path d="M -56 -30 L 56 -30 L 60 38 L 6 38 L 0 14 L -6 38 L -60 38 Z" fill={COR.short} {...TRACO} />
			{/* tronco (camiseta) */}
			<rect x={-58} y={-212} width={116} height={196} rx={34} fill={COR.camiseta} {...TRACO} />
			<path d="M -22 -150 q 22 16 44 0" fill="none" stroke={COR.tinta} strokeWidth={3} opacity={0.35} />
			{/* braços */}
			<path d={braco(ombroL, l)} fill="none" {...TRACO} strokeWidth={6} />
			<path d={braco(ombroR, r)} fill="none" {...TRACO} strokeWidth={6} />
			<circle cx={mL[0]} cy={mL[1]} r={9} fill={COR.pele} {...TRACO} strokeWidth={4} />
			<circle cx={mR[0]} cy={mR[1]} r={9} fill={COR.pele} {...TRACO} strokeWidth={4} />
			{relogio ? (
				<g transform={`translate(${mR[0] + 14} ${mR[1] + 10}) rotate(-20)`}>
					<rect x={-17} y={-13} width={34} height={26} rx={7} fill={COR.tinta} />
					<rect x={-12} y={-8} width={24} height={16} rx={4} fill={COR.neon} />
				</g>
			) : null}
			{children ? <g transform={`translate(${mR[0]} ${mR[1]})`}>{children}</g> : null}
			{/* cabeça */}
			<circle cx={0} cy={-290} r={88} fill={COR.pele} {...TRACO} />
			{/* olhos */}
			<ellipse cx={-32} cy={-302} rx={30} ry={olhoH} fill={COR.branco} {...TRACO} />
			<ellipse cx={34} cy={-302} rx={30} ry={olhoH} fill={COR.branco} {...TRACO} />
			{piscar < 0.6 ? (
				<>
					<circle cx={-28 + ox} cy={-296 + oy} r={12} fill={COR.tinta} />
					<circle cx={30 + ox} cy={-296 + oy} r={12} fill={COR.tinta} />
				</>
			) : null}
			{sobrancelha === 'triste' ? (
				<>
					<path d="M -56 -346 L -16 -356" {...TRACO} strokeWidth={6} />
					<path d="M 58 -346 L 18 -356" {...TRACO} strokeWidth={6} />
				</>
			) : null}
			{sobrancelha === 'brava' ? (
				<>
					<path d="M -56 -358 L -14 -344" {...TRACO} strokeWidth={6} />
					<path d="M 58 -358 L 16 -344" {...TRACO} strokeWidth={6} />
				</>
			) : null}
			{sobrancelha === 'alta' ? (
				<>
					<path d="M -54 -360 q 20 -12 40 0" fill="none" {...TRACO} strokeWidth={6} />
					<path d="M 16 -360 q 20 -12 40 0" fill="none" {...TRACO} strokeWidth={6} />
				</>
			) : null}
			<BocaDesenho tipo={boca} />
			{suor ? (
				<g fill={COR.azul} stroke={COR.tinta} strokeWidth={3}>
					<path d="M -98 -330 q -12 20 0 26 q 12 -6 0 -26 Z" />
					<path d="M 104 -300 q -10 17 0 22 q 10 -5 0 -22 Z" />
					<path d="M 92 -360 q -8 13 0 17 q 8 -4 0 -17 Z" />
				</g>
			) : null}
		</g>
	);
};

const BocaDesenho: React.FC<{tipo: BocaBeto}> = ({tipo}) => {
	switch (tipo) {
		case 'sorriso':
			return <path d="M -20 -244 q 22 22 44 0" fill="none" {...TRACO} />;
		case 'aberta':
			return <ellipse cx={2} cy={-240} rx={16} ry={14} fill={COR.tinta} />;
		case 'o':
			return <circle cx={2} cy={-242} r={8} fill={COR.tinta} />;
		case 'dor':
			return <path d="M -22 -240 l 9 -8 l 9 8 l 9 -8 l 9 8 l 9 -8" fill="none" {...TRACO} strokeWidth={4} />;
		case 'preocupada':
			return <path d="M -20 -238 q 11 -10 22 0 q 11 10 22 0" fill="none" {...TRACO} strokeWidth={4} />;
		default:
			return <path d="M -12 -242 L 16 -242" {...TRACO} />;
	}
};
