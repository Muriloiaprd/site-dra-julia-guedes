import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COR, FONTE} from '../tema';

// Fundo de papel + filtro de "traço tremido": a semente do ruído muda a cada 3 quadros,
// então os contornos fervem de leve, como desenho feito quadro a quadro.
export const Papel: React.FC<{
	children: React.ReactNode;
	limpo?: React.ReactNode;
	sons?: React.ReactNode; // efeitos sonoros da cena (<Som>), fora do SVG
	fundo?: string;
	tremido?: number;
}> = ({children, limpo, sons, fundo = COR.papel, tremido = 2.6}) => {
	const frame = useCurrentFrame();
	const semente = Math.floor(frame / 3) % 7;
	return (
		<AbsoluteFill style={{backgroundColor: fundo}}>
			<svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{fontFamily: FONTE}}>
				<defs>
					<filter id="tremido" x="-5%" y="-5%" width="110%" height="110%">
						<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={semente} result="ruido" />
						<feDisplacementMap in="SourceGraphic" in2="ruido" scale={tremido} xChannelSelector="R" yChannelSelector="G" />
					</filter>
				</defs>
				<g filter="url(#tremido)">{children}</g>
				{limpo}
			</svg>
			{sons}
		</AbsoluteFill>
	);
};
