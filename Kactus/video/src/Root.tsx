import React from 'react';
import {AbsoluteFill, Composition, Still} from 'remotion';
import falas from '../roteiro/falas.json';
import {Cena01, Cena02, Cena03, Cena04} from './cenas/Cenas1a4';
import {Cena05, Cena06, Cena07, Cena08} from './cenas/Cenas5a8';
import {Cena09, Cena10, Cena11} from './cenas/Cenas9a11';
import {TestePersonagens} from './TestePersonagens';
import {Legenda} from './ui/Legenda';
import './tema';

const NOMES: Record<string, string> = {beto: 'Beto', duni: 'Duni', tenis: 'Tênis', amigo: 'Amigo'};

// Quadro do storyboard: a cena parada + a fala principal como legenda.
const cenas: {comp: React.FC; fala: number}[] = [
	{comp: Cena01, fala: 1},
	{comp: Cena02, fala: 0},
	{comp: Cena03, fala: 1},
	{comp: Cena04, fala: 0},
	{comp: Cena05, fala: 1},
	{comp: Cena06, fala: 1},
	{comp: Cena07, fala: 3},
	{comp: Cena08, fala: 1},
	{comp: Cena09, fala: 1},
	{comp: Cena10, fala: 1},
	{comp: Cena11, fala: 0},
];

const Quadro: React.FC<{i: number}> = ({i}) => {
	const {comp: Comp, fala} = cenas[i];
	const cena = falas.cenas[i];
	const f = cena.falas[fala];
	return (
		<AbsoluteFill>
			<Comp />
			<Legenda texto={f.texto} quem={NOMES[f.quem]} etiqueta={`Cena ${cena.n} · ${cena.nome}`} />
		</AbsoluteFill>
	);
};

// Folha do storyboard: as 11 cenas em miniatura (4 por linha), com a fala embaixo de cada uma.
const Folha: React.FC = () => (
	<AbsoluteFill style={{backgroundColor: '#1B1B1B', fontFamily: 'Poppins, sans-serif', padding: 30}}>
		<div style={{color: '#00FF66', fontWeight: 900, fontSize: 44, marginBottom: 20}}>Como funciona o Kactus · storyboard</div>
		<div style={{display: 'flex', flexWrap: 'wrap', gap: 24}}>
			{cenas.map(({comp: Comp, fala}, i) => {
				const cena = falas.cenas[i];
				return (
					<div key={i} style={{width: 444}}>
						<div style={{width: 444, height: 250, overflow: 'hidden', borderRadius: 12, position: 'relative'}}>
							<div style={{width: 1920, height: 1080, transform: 'scale(0.23125)', transformOrigin: 'top left', position: 'absolute'}}>
								<Comp />
							</div>
						</div>
						<div style={{color: '#FFF', fontSize: 19, fontWeight: 700, marginTop: 8, lineHeight: 1.3}}>
							<span style={{color: '#C6FF00'}}>{cena.n}. {cena.nome} · </span>
							{cena.falas[fala].texto}
						</div>
					</div>
				);
			})}
		</div>
	</AbsoluteFill>
);

export const Root: React.FC = () => (
	<>
		<Composition id="TestePersonagens" component={TestePersonagens} durationInFrames={150} fps={30} width={1920} height={1080} />
		<Still id="Folha" component={Folha} width={1920} height={1200} />
		{cenas.map((_, i) => (
			<Still
				key={i}
				id={`Cena${String(i + 1).padStart(2, '0')}`}
				component={Quadro}
				defaultProps={{i}}
				width={1920}
				height={1080}
			/>
		))}
	</>
);
