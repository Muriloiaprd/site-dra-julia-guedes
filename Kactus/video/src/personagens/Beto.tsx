import React from 'react';
import {useBoca} from '../FalaContexto';
import {COR, TRACO} from '../tema';

// Beto, o corredor. Origem (0, 0) no quadril; a cabeça fica em y = -290.
// Braços: cotovelo (e) e mão (m) relativos ao ombro.
export type Braco = {e: [number, number]; m: [number, number]};
export type Bracos = {l: Braco; r: Braco};
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

export const POSES: Record<PoseBeto, Bracos> = {
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

// Mistura duas poses (t = 0 → a, t = 1 → b), para os braços irem de uma pose à outra.
export function misturarPoses(a: PoseBeto | Bracos, b: PoseBeto | Bracos, t: number): Bracos {
	const pa = typeof a === 'string' ? POSES[a] : a;
	const pb = typeof b === 'string' ? POSES[b] : b;
	const lerp = (u: [number, number], v: [number, number]): [number, number] => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
	const br = (u: Braco, v: Braco): Braco => ({e: lerp(u.e, v.e), m: lerp(u.m, v.m)});
	return {l: br(pa.l, pb.l), r: br(pa.r, pb.r)};
}

// Braços balançando ao andar, em oposição às pernas (mesma fase do `andar`).
export function bracosAndando(fase: number, forca = 1): Bracos {
	const s = Math.sin(fase) * forca;
	return {
		l: {e: [-30 + s * 14, 75], m: [-42 + s * 40, 150]},
		r: {e: [30 - s * 14, 75], m: [42 - s * 40, 150]},
	};
}

export const Beto: React.FC<{
	x: number;
	y: number;
	escala?: number;
	pose?: PoseBeto | Bracos;
	boca?: BocaBeto;
	fala?: number; // abertura da boca falando, 0..1 (substitui `boca` quando definida)
	andar?: number; // fase do passo em radianos (pernas balançam)
	andarForca?: number; // 0..1, para o passo começar e parar suave
	respiro?: number; // deslocamento vertical do tronco e da cabeça
	inclinar?: number; // graus, gira o corpo em torno do quadril
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
	fala,
	andar,
	andarForca = 1,
	respiro = 0,
	inclinar = 0,
	olhar = [0, 0],
	sentado = false,
	suor = false,
	relogio = false,
	sobrancelha,
	piscar = 0,
	espelhar = false,
	children,
}) => {
	const falaVoz = useBoca('beto');
	const abertura = fala ?? falaVoz;
	const {l, r} = typeof pose === 'string' ? POSES[pose] : pose;
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

	// passo: cada pé vai para frente e para trás em oposição, levantando um pouco
	const passo = (lado: number) => {
		if (andar === undefined) return {dx: 0, sobe: 0};
		const s = Math.sin(andar + (lado > 0 ? Math.PI : 0));
		return {dx: s * 38 * andarForca, sobe: Math.max(0, Math.cos(andar + (lado > 0 ? Math.PI : 0))) * 22 * andarForca};
	};
	const pL = passo(-1);
	const pR = passo(1);
	const pernas = sentado
		? ['M -24 0 Q -44 40 -46 150', 'M 24 0 Q 44 40 46 150']
		: [
				`M -24 0 Q ${-36 + pL.dx / 2} 95 ${-38 + pL.dx} ${190 - pL.sobe}`,
				`M 24 0 Q ${36 + pR.dx / 2} 95 ${38 + pR.dx} ${190 - pR.sobe}`,
			];
	const pe = sentado ? 150 : 190;
	const pes = sentado
		? [{x: -50, y: pe + 4}, {x: 50, y: pe + 4}]
		: [{x: -50 + pL.dx, y: pe + 4 - pL.sobe}, {x: 50 + pR.dx, y: pe + 4 - pR.sobe}];
	const olhoH = 38 * (1 - piscar * 0.92);
	const [ox, oy] = olhar;

	return (
		<g transform={`translate(${x} ${y}) scale(${espelhar ? -escala : escala} ${escala}) rotate(${inclinar} 0 ${sentado ? 150 : 190})`}>
			{/* pernas */}
			{pernas.map((d, i) => (
				<path key={i} d={d} fill="none" {...TRACO} strokeWidth={6} />
			))}
			{pes.map((p, i) => (
				<ellipse key={i} cx={p.x} cy={p.y} rx={22} ry={11} fill={COR.tinta} />
			))}
			{/* short */}
			<path d="M -56 -30 L 56 -30 L 60 38 L 6 38 L 0 14 L -6 38 L -60 38 Z" fill={COR.short} {...TRACO} />
			<g transform={`translate(0 ${respiro})`}>
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
			{abertura !== undefined ? <BocaFala abertura={abertura} /> : <BocaDesenho tipo={boca} />}
			{suor ? (
				<g fill={COR.azul} stroke={COR.tinta} strokeWidth={3}>
					<path d="M -98 -330 q -12 20 0 26 q 12 -6 0 -26 Z" />
					<path d="M 104 -300 q -10 17 0 22 q 10 -5 0 -22 Z" />
					<path d="M 92 -360 q -8 13 0 17 q 8 -4 0 -17 Z" />
				</g>
			) : null}
			</g>
		</g>
	);
};

const BocaFala: React.FC<{abertura: number}> = ({abertura}) =>
	abertura < 0.08 ? (
		<path d="M -12 -242 L 16 -242" {...TRACO} />
	) : (
		<ellipse cx={2} cy={-242} rx={14 + abertura * 4} ry={3 + abertura * 13} fill={COR.tinta} />
	);

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
