// Renderiza um quadro parado de cada cena (Cena01..Cena11) e a folha com todos.
// Rodar pelo PowerShell: o Edge headless não abre a partir do Git Bash nesta máquina.
import {bundle} from '@remotion/bundler';
import {getCompositions, renderStill} from '@remotion/renderer';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const raiz = path.resolve(import.meta.dirname, '..');
const so = process.argv.slice(2);

const serveUrl = await bundle({entryPoint: path.join(raiz, 'src/index.ts')});
const opcoes = {browserExecutable: EDGE, chromeMode: 'chrome-for-testing'};
const comps = await getCompositions(serveUrl, opcoes);
for (const composition of comps) {
	if (so.length && !so.includes(composition.id)) continue;
	const output = path.join(raiz, 'storyboard', (composition.id === 'Folha' ? 'storyboard' : composition.id.replace(/^Cena/, 'cena-')) .toLowerCase() + '.png');
	await renderStill({composition, serveUrl, output, ...opcoes});
	console.log('ok', output);
}
