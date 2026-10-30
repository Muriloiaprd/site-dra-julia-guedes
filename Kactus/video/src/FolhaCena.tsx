import React from 'react';
import {AbsoluteFill, Freeze} from 'remotion';
import {Filme} from './Filme';
import {LINHA} from './linhaDoTempo';
import {FONTE} from './tema';

// Folha de conferência: 6 momentos de uma cena do filme lado a lado (3 × 2), com o quadro de cada um.
// npx remotion still src/index.ts FolhaCena out/folha-03.png --props='{"cena":3}'
export const FolhaCena: React.FC<{cena: number}> = ({cena}) => {
	const c = LINHA.cenas.find((x) => x.n === cena) ?? LINHA.cenas[0];
	const momentos = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92].map((p) => Math.round(c.inicio + c.duracao * p));
	return (
		<AbsoluteFill style={{backgroundColor: '#111', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', fontFamily: FONTE}}>
			{momentos.map((q) => (
				<div key={q} style={{width: 640, height: 360, position: 'relative', overflow: 'hidden', outline: '2px solid #111'}}>
					<div style={{width: 1920, height: 1080, transform: 'scale(0.3333)', transformOrigin: 'top left', position: 'absolute'}}>
						<Freeze frame={q}>
							<Filme />
						</Freeze>
					</div>
					<div style={{position: 'absolute', top: 6, left: 8, background: '#000', color: '#0F6', fontSize: 18, fontWeight: 700, padding: '2px 8px'}}>
						cena {c.n} · quadro {q}
					</div>
				</div>
			))}
		</AbsoluteFill>
	);
};
