import {LINHA} from './linhaDoTempo';

// Tempos de uma cena em quadros RELATIVOS ao começo dela (o mesmo quadro que useCurrentFrame()
// devolve dentro da Sequence da cena). As cenas se animam a partir disso, sincronizadas com a voz.
export function tempoDaCena(n: number) {
	const cena = LINHA.cenas.find((c) => c.n === n);
	if (!cena) throw new Error(`Cena ${n} não existe na linha do tempo`);
	const falas = cena.falas.map((f) => ({i: f.inicio - cena.inicio, fim: f.fimVoz - cena.inicio}));
	// Quadro em que a palavra começa: por índice ou pelo texto (a primeira que contém o texto).
	const palavra = (fala: number, busca: number | string): number => {
		const lista = cena.falas[fala].palavras;
		const achada =
			typeof busca === 'number'
				? lista[busca]
				: lista.find((p) => p.texto.toLowerCase().includes(busca.toLowerCase()));
		if (!achada) throw new Error(`Palavra "${busca}" não está na fala ${fala} da cena ${n}`);
		return achada.quadro - cena.inicio;
	};
	return {duracao: cena.duracao, falas, palavra};
}
