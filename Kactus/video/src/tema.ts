import {continueRender, delayRender, staticFile} from 'remotion';

// Paleta do vídeo: papel claro e traço preto (estilo desenho), com o verde do Kactus
// nos detalhes e nas telas do app (que são escuras, como o app de verdade).
export const COR = {
	papel: '#F6F3EA',
	parede: '#EFE9DA',
	tinta: '#1B1B1B',
	branco: '#FFFFFF',
	camiseta: '#2BD96B',
	short: '#1F2A44',
	pele: '#FFFFFF',
	madeira: '#A9692F',
	madeiraEscura: '#7A4A1E',
	estofado: '#7FE3C9',
	estofadoEscuro: '#3FB79A',
	cacto: '#3CC95A',
	cactoEscuro: '#23964A',
	ouro: '#FFC93C',
	rosa: '#FF9EB0',
	vermelho: '#F2554B',
	amarelo: '#FFD94A',
	azul: '#4AA8FF',
	cinza: '#BDBDBD',
	tela: '#0B0B0B',
	telaCartao: '#171717',
	telaBorda: '#2A2A2A',
	neon: '#00FF66',
	lima: '#C6FF00',
	textoTela: '#FFFFFF',
	textoTelaFraco: '#9A9A9A',
};

export const FONTE = 'Poppins, "Segoe UI", sans-serif';
export const FONTE_MAO = '"Ink Free", "Comic Sans MS", cursive';

// Traço padrão de desenho.
export const TRACO = {
	stroke: COR.tinta,
	strokeWidth: 5,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
};

if (typeof document !== 'undefined') {
	const espera = delayRender('Carregando fontes');
	const fontes = [
		new FontFace('Poppins', `url(${staticFile('fonts/Poppins-700.woff2')})`, {weight: '700'}),
		new FontFace('Poppins', `url(${staticFile('fonts/Poppins-900.woff2')})`, {weight: '900'}),
	];
	Promise.all(
		fontes.map((f) =>
			f.load().then((carregada) => {
				(document.fonts as unknown as {add: (f: FontFace) => void}).add(carregada);
			}),
		),
	)
		.then(() => continueRender(espera))
		.catch((erro) => {
			console.error(erro);
			continueRender(espera);
		});
}
