import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {entre, mola} from '../anim';
import {Balao} from './Balao';

// Balão que salta no quadro `de` e some no quadro `ate`, crescendo a partir da ponta do rabinho.
export const BalaoAnimado: React.FC<React.ComponentProps<typeof Balao> & {de: number; ate: number}> = ({de, ate, ...balao}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = mola(frame, fps, de, 180) * (1 - entre(frame, ate, ate + 6, 0, 1));
	if (s < 0.01) return null;
	return (
		<g transform={`translate(${balao.px} ${balao.py}) scale(${s}) translate(${-balao.px} ${-balao.py})`}>
			<Balao {...balao} />
		</g>
	);
};

// Faz o conteúdo saltar (escala com mola) a partir do quadro `de`, em torno de (x, y).
export const Salta: React.FC<{de: number; x: number; y: number; ate?: number; children: React.ReactNode}> = ({
	de,
	x,
	y,
	ate,
	children,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = mola(frame, fps, de, 160) * (ate === undefined ? 1 : 1 - entre(frame, ate, ate + 6, 0, 1));
	if (s < 0.01) return null;
	return <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>{children}</g>;
};

// Câmera: centraliza o ponto (x, y) na tela com o zoom pedido.
export const Camera: React.FC<{x: number; y: number; zoom: number; children: React.ReactNode}> = ({x, y, zoom, children}) => (
	<g transform={`translate(960 540) scale(${zoom}) translate(${-x} ${-y})`}>{children}</g>
);

// Ponto numa curva quadrática (para trajetórias de objetos arremessados).
export function naCurva(a: [number, number], c: [number, number], b: [number, number], t: number): [number, number] {
	const u = 1 - t;
	return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}
