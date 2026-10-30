import React from 'react';
import {Html5Audio, Sequence, staticFile} from 'remotion';

// Efeitos sonoros gerados por scripts/gerar_efeitos.py (public/sfx).
export type NomeSom =
	| 'pop'
	| 'boing'
	| 'whoosh'
	| 'queda'
	| 'gota'
	| 'fogo'
	| 'clique'
	| 'liga'
	| 'toing'
	| 'plim'
	| 'aplausos'
	| 'sobe'
	| 'alarme';

// Toca o efeito `nome` no quadro `de` (relativo à cena). O volume fica abaixo da voz por padrão.
export const Som: React.FC<{de: number; nome: NomeSom; volume?: number}> = ({de, nome, volume = 0.35}) => (
	<Sequence from={Math.max(0, Math.round(de))} layout="none" name={`som ${nome}`}>
		<Html5Audio src={staticFile(`sfx/${nome}.wav`)} volume={volume} />
	</Sequence>
);
