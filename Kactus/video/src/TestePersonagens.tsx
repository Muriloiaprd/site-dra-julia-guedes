import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {bocaFalando, entre, mola, piscar, respirar} from './anim';
import {Beto, bracosAndando, misturarPoses} from './personagens/Beto';
import {Duni} from './personagens/Duni';
import {COR, TRACO} from './tema';
import {Balao} from './ui/Balao';
import {Papel} from './ui/Papel';

// Teste de 5 s da Fase 2: o Beto entra andando, acena e fala; a Duni brota do chão, quica e fala.
export const TestePersonagens: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Beto anda até o meio-esquerdo e para
	const forca = 1 - entre(frame, 42, 54, 0, 1);
	const betoX = entre(frame, 0, 54, -220, 640);
	const passo = frame * 0.42;
	const quique = -Math.abs(Math.sin(passo)) * 14 * forca;

	// braço: parado → tchau, depois balança a mão
	const tAceno = entre(frame, 58, 68, 0, 1) * (1 - entre(frame, 100, 110, 0, 1));
	const aceno = misturarPoses(bracosAndando(passo, forca), 'tchau', tAceno);
	const balanco = Math.sin(frame * 0.6) * 30 * tAceno;
	const bracos = {l: aceno.l, r: {e: aceno.r.e, m: [aceno.r.m[0] + balanco, aceno.r.m[1]] as [number, number]}};

	const betoFala = frame >= 62 && frame < 96;
	const olharBeto: [number, number] = frame > 92 ? [10, -2] : [2, 0];

	// Duni brota do chão com mola e quica
	const mDuni = mola(frame, fps, 88);
	const duniY = 1500 - mDuni * 600;
	const pulo = frame < 88 ? 0 : Math.sin((frame - 88) / 4) * Math.max(0, 1 - (frame - 88) / 30) + respirar(frame, 0.15, 3);
	const duniFala = frame >= 108 && frame < 146;

	const bBeto = mola(frame, fps, 60) * (1 - entre(frame, 98, 104, 0, 1));
	const bDuni = mola(frame, fps, 106);

	return (
		<Papel
			limpo={
				<>
					{bBeto > 0.01 ? (
						<g transform={`translate(500 300) scale(${bBeto}) translate(-500 -300)`}>
							<Balao x={300} y={130} w={460} linhas={['Oi! Eu sou o Beto.']} px={560} py={330} tamanho={42} />
						</g>
					) : null}
					{bDuni > 0.01 ? (
						<g transform={`translate(1360 250) scale(${bDuni}) translate(-1360 -250)`}>
							<Balao
								x={1050}
								y={90}
								w={640}
								linhas={['E eu sou a Duni,', 'sua treinadora.']}
								px={1250}
								py={360}
								tamanho={42}
								cor={COR.lima}
							/>
						</g>
					) : null}
				</>
			}
		>
			<rect x={0} y={0} width={1920} height={1080} fill={COR.parede} />
			<rect x={0} y={900} width={1920} height={180} fill="#E3D9C3" />
			<path d="M 0 900 L 1920 900" {...TRACO} />
			<Beto
				x={betoX}
				y={710 + quique}
				pose={bracos}
				andar={passo}
				andarForca={forca}
				inclinar={4 * forca}
				respiro={respirar(frame, 3) * (1 - forca)}
				fala={betoFala ? bocaFalando(frame) : undefined}
				boca={frame > 96 ? 'sorriso' : 'neutra'}
				olhar={olharBeto}
				piscar={piscar(frame, 1)}
				sobrancelha={frame > 96 ? 'alta' : undefined}
			/>
			<defs>
				<clipPath id="chao-duni">
					<rect x={0} y={0} width={1920} height={995} />
				</clipPath>
			</defs>
			<g clipPath="url(#chao-duni)">
			<Duni
				x={1300}
				y={duniY}
				pulo={pulo}
				fala={duniFala ? bocaFalando(frame, 5) : undefined}
				boca="sarcastica"
				olhar={[-10, 0]}
				piscar={piscar(frame, 4)}
				bracoDireito={frame > 92 ? Math.sin(frame * 0.35) * 14 : 0}
			/>
			</g>
		</Papel>
	);
};
