import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COR, FONTE} from '../tema';

// Legenda grande embaixo (para quem assiste sem som) e, no storyboard, a etiqueta da cena.
export const Legenda: React.FC<{texto: string; quem?: string; etiqueta?: string; tamanho?: number}> = ({
	texto,
	quem,
	etiqueta,
	tamanho = 40,
}) => (
	<AbsoluteFill style={{fontFamily: FONTE, pointerEvents: 'none'}}>
		{etiqueta ? (
			<div
				style={{
					position: 'absolute',
					top: 28,
					left: 32,
					background: COR.tinta,
					color: COR.neon,
					fontWeight: 700,
					fontSize: 30,
					padding: '8px 20px',
					borderRadius: 14,
				}}
			>
				{etiqueta}
			</div>
		) : null}
		<div style={{position: 'absolute', bottom: 34, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
			<div
				style={{
					maxWidth: 1500,
					background: 'rgba(27,27,27,0.86)',
					color: COR.branco,
					fontWeight: 700,
					fontSize: tamanho,
					lineHeight: 1.25,
					padding: '14px 30px',
					borderRadius: 18,
					textAlign: 'center',
				}}
			>
				{quem ? <span style={{color: quem === 'Duni' ? COR.lima : COR.neon}}>{quem}: </span> : null}
				{texto}
			</div>
		</div>
	</AbsoluteFill>
);
