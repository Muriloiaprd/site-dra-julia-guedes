import falas from '../roteiro/falas.json';
import vozes from '../public/audio/vozes.json';

// Linha do tempo do filme, calculada a partir dos áudios gerados por scripts/gerar_vozes.py:
// cada cena dura o tempo das suas falas mais as pausas. Tudo em quadros (30 por segundo).
export const FPS = 30;
const ANTES_PADRAO = 0.7; // s de respiro no começo de cada cena
const DEPOIS_PADRAO = 0.9; // s depois da última fala
const ENTRE_FALAS = 0.35; // s entre uma fala e a seguinte

type Voz = {arquivo: string; quem: string; duracao: number; volume: number[]; palavras: {inicio: number; duracao: number; texto: string}[]};
type FalaRoteiro = {quem: string; texto: string; pausaAntes?: number};
type CenaRoteiro = {n: number; nome: string; acao: string; falas: FalaRoteiro[]; antes?: number; depois?: number};

export type FalaNoTempo = {
	chave: string;
	quem: string;
	texto: string;
	arquivo: string;
	inicio: number; // quadro absoluto em que a voz começa
	fimVoz: number; // quadro absoluto em que a voz termina de verdade (sem o silêncio do fim do MP3)
	duracaoAudio: number; // quadros do MP3 inteiro
	volume: number[];
};
export type CenaNoTempo = {n: number; nome: string; inicio: number; duracao: number; falas: FalaNoTempo[]};

const s2q = (s: number) => Math.round(s * FPS);
const indice = vozes as unknown as Record<string, Voz>;

function montar(): {cenas: CenaNoTempo[]; total: number} {
	const cenas: CenaNoTempo[] = [];
	let t = 0;
	for (const cena of falas.cenas as CenaRoteiro[]) {
		const inicioCena = t;
		let cursor = t + s2q(cena.antes ?? ANTES_PADRAO);
		const lista: FalaNoTempo[] = [];
		cena.falas.forEach((fala, i) => {
			const chave = `c${String(cena.n).padStart(2, '0')}_f${i}`;
			const voz = indice[chave];
			if (!voz) throw new Error(`Falta o áudio ${chave}: rode scripts/gerar_vozes.py`);
			if (i > 0) cursor += s2q(ENTRE_FALAS + (fala.pausaAntes ?? 0));
			else cursor += s2q(fala.pausaAntes ?? 0);
			let ultimo = voz.volume.length - 1;
			while (ultimo > 0 && voz.volume[ultimo] < 0.03) ultimo--;
			const fimVoz = cursor + ultimo + 3;
			lista.push({
				chave,
				quem: fala.quem,
				texto: fala.texto,
				arquivo: voz.arquivo,
				inicio: cursor,
				fimVoz,
				duracaoAudio: s2q(voz.duracao),
				volume: voz.volume,
			});
			cursor = fimVoz;
		});
		t = cursor + s2q(cena.depois ?? DEPOIS_PADRAO);
		cenas.push({n: cena.n, nome: cena.nome, inicio: inicioCena, duracao: t - inicioCena, falas: lista});
	}
	return {cenas, total: t};
}

export const LINHA = montar();

// Quem está falando no quadro (absoluto) e quanto a boca abre (0..1).
export function falaNoQuadro(frame: number): {fala: FalaNoTempo | null; abertura: number} {
	for (const cena of LINHA.cenas) {
		if (frame < cena.inicio || frame >= cena.inicio + cena.duracao) continue;
		for (const fala of cena.falas) {
			if (frame >= fala.inicio && frame < fala.fimVoz) {
				const i = frame - fala.inicio;
				// média com o quadro vizinho deixa a boca menos nervosa
				const v = ((fala.volume[i] ?? 0) + (fala.volume[i + 1] ?? 0)) / 2;
				return {fala, abertura: v < 0.12 ? 0 : Math.min(1, v * 1.1)};
			}
		}
	}
	return {fala: null, abertura: 0};
}
