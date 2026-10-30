import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Cena01, Cena02, Cena03, Cena04} from './cenas/Cenas1a4';
import {Cena05, Cena06, Cena07, Cena08} from './cenas/Cenas5a8';
import {Cena09, Cena10, Cena11} from './cenas/Cenas9a11';
import {FalaProvider} from './FalaContexto';
import {falaNoQuadro, LINHA} from './linhaDoTempo';
import {Legenda} from './ui/Legenda';

const CENAS: React.FC[] = [Cena01, Cena02, Cena03, Cena04, Cena05, Cena06, Cena07, Cena08, Cena09, Cena10, Cena11];
export const NOMES: Record<string, string> = {beto: 'Beto', duni: 'Duni', tenis: 'Tênis', amigo: 'Amigo'};
const LEGENDA_FICA = 12; // quadros que a legenda fica depois do fim da voz

// O filme inteiro: cada cena numa Sequence com a duração vinda dos áudios, as vozes por cima
// e a legenda da fala atual embaixo.
export const Filme: React.FC = () => {
	const frame = useCurrentFrame();
	const {fala, abertura} = falaNoQuadro(frame);
	const cena = LINHA.cenas.find((c) => frame >= c.inicio && frame < c.inicio + c.duracao);
	const legenda = cena?.falas.filter((f) => frame >= f.inicio && frame < f.fimVoz + LEGENDA_FICA).at(-1);

	return (
		<AbsoluteFill style={{backgroundColor: '#F6F3EA'}}>
			<FalaProvider valor={{quem: fala?.quem ?? null, abertura}}>
				{LINHA.cenas.map((c, i) => {
					const Cena = CENAS[i];
					return (
						<Sequence key={c.n} from={c.inicio} durationInFrames={c.duracao} name={`Cena ${c.n} · ${c.nome}`}>
							<Cena />
						</Sequence>
					);
				})}
			</FalaProvider>
			{LINHA.cenas.flatMap((c) =>
				c.falas.map((f) => (
					<Sequence key={f.chave} from={f.inicio} durationInFrames={f.duracaoAudio} name={f.chave} layout="none">
						<Html5Audio src={staticFile(f.arquivo)} />
					</Sequence>
				)),
			)}
			{legenda ? <Legenda texto={legenda.texto} quem={NOMES[legenda.quem]} tamanho={34} /> : null}
		</AbsoluteFill>
	);
};
