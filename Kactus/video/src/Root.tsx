import React from 'react';
import {Composition} from 'remotion';
import {Filme} from './Filme';
import {FolhaCena} from './FolhaCena';
import {FPS, LINHA} from './linhaDoTempo';
import {TestePersonagens} from './TestePersonagens';
import './tema';

// O filme e o teste dos personagens. Os quadros do storyboard saem do próprio filme
// (scripts/storyboard.ts), no momento da fala principal de cada cena.
export const Root: React.FC = () => (
	<>
		<Composition id="ComoFuncionaKactus" component={Filme} durationInFrames={LINHA.total} fps={FPS} width={1920} height={1080} />
		{/* longa como o filme só para as Sequences do Filme congelado caberem; renderizar com `remotion still` (quadro 0) */}
		<Composition id="FolhaCena" component={FolhaCena} defaultProps={{cena: 1}} durationInFrames={LINHA.total} fps={FPS} width={1920} height={1080} />
		<Composition id="TestePersonagens" component={TestePersonagens} durationInFrames={150} fps={30} width={1920} height={1080} />
	</>
);
