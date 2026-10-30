import React from 'react';
import {AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Cena01, Cena02, Cena03, Cena04} from './cenas/Cenas1a4';
import {Cena05, Cena06, Cena07, Cena08} from './cenas/Cenas5a8';
import {Cena09, Cena10, Cena11} from './cenas/Cenas9a11';
import {FalaProvider} from './FalaContexto';
import {falaNoQuadro, LINHA} from './linhaDoTempo';
import {COR, TRACO} from './tema';
import {Legenda} from './ui/Legenda';
import {LogoKactus} from './ui/Objetos';
import {Som} from './ui/Som';

const CENAS: React.FC[] = [Cena01, Cena02, Cena03, Cena04, Cena05, Cena06, Cena07, Cena08, Cena09, Cena10, Cena11];
export const NOMES: Record<string, string> = {beto: 'Beto', duni: 'Duni', tenis: 'Tênis', amigo: 'Amigo'};
const LEGENDA_FICA = 12; // quadros que a legenda fica depois do fim da voz
const MEIA_TRANSICAO = 9; // quadros de cada lado do corte entre cenas
const TRILHA_VOLUME = 0.12;
const TRILHA_NA_FALA = 0.05; // a trilha abaixa quando alguém fala

// Quadros com voz (com folga), para abaixar a trilha nas falas.
const comVoz = new Uint8Array(LINHA.total);
for (const c of LINHA.cenas) {
	for (const f of c.falas) {
		for (let q = Math.max(0, f.inicio - 6); q < Math.min(LINHA.total, f.fimVoz + 6); q++) comVoz[q] = 1;
	}
}
const volumeTrilha = (q: number) => {
	const entra = interpolate(q, [0, 20], [0, 1], {extrapolateRight: 'clamp'});
	const sai = interpolate(q, [LINHA.total - 45, LINHA.total - 1], [1, 0], {extrapolateLeft: 'clamp'});
	return (comVoz[q] ? TRILHA_NA_FALA : TRILHA_VOLUME) * entra * sai;
};

// Faixa verde inclinada com a logo que varre a tela e esconde o corte de uma cena para a outra.
const Transicao: React.FC<{frame: number}> = ({frame}) => {
	const corte = LINHA.cenas.slice(1).find((c) => Math.abs(frame - c.inicio) <= MEIA_TRANSICAO);
	if (!corte) return null;
	const p = (frame - (corte.inicio - MEIA_TRANSICAO)) / (2 * MEIA_TRANSICAO);
	const o = interpolate(p, [0, 1], [2120, -2900]);
	return (
		<AbsoluteFill>
			<svg viewBox="0 0 1920 1080" width="100%" height="100%">
				<polygon points={`${o + 300},0 ${o + 2900},0 ${o + 2600},1080 ${o},1080`} fill={COR.camiseta} {...TRACO} strokeWidth={8} />
				<circle cx={o + 1450} cy={540} r={120} fill={COR.tela} {...TRACO} strokeWidth={8} />
				<LogoKactus x={o + 1450 - 70} y={540 - 75} w={140} simbolo />
			</svg>
		</AbsoluteFill>
	);
};

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
			<Transicao frame={frame} />
			{LINHA.cenas.slice(1).map((c) => (
				<Som key={c.n} de={c.inicio - MEIA_TRANSICAO} nome="whoosh" volume={0.3} />
			))}
			<Html5Audio src={staticFile('sfx/trilha.wav')} loop volume={volumeTrilha} />
		</AbsoluteFill>
	);
};
