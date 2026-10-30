// Tira um quadro de cada cena do filme (no momento da fala principal) para storyboard/cena-NN.png.
// Rodar pelo PowerShell (o Edge headless não abre a partir do Git Bash nesta máquina):
//   npx tsx scripts/storyboard.ts            todas as cenas
//   npx tsx scripts/storyboard.ts 3 4        só as cenas 3 e 4
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {LINHA} from '../src/linhaDoTempo';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// Fala de cada cena que vira o quadro do storyboard (índice dentro da cena).
const FALA_DO_QUADRO = [1, 0, 1, 0, 1, 1, 3, 1, 1, 1, 0];
const raiz = path.resolve(__dirname, '..');
const so = process.argv.slice(2).map(Number);

async function main() {
	const serveUrl = await bundle({entryPoint: path.join(raiz, 'src/index.ts')});
	const opcoes = {browserExecutable: EDGE, chromeMode: 'chrome-for-testing' as const};
	const composition = await selectComposition({serveUrl, id: 'ComoFuncionaKactus', ...opcoes});
	for (const cena of LINHA.cenas) {
		if (so.length && !so.includes(cena.n)) continue;
		const fala = cena.falas[FALA_DO_QUADRO[cena.n - 1]];
		const frame = Math.round(fala.inicio + (fala.fimVoz - fala.inicio) * 0.7);
		const output = path.join(raiz, 'storyboard', `cena-${String(cena.n).padStart(2, '0')}.png`);
		await renderStill({composition, serveUrl, output, frame, ...opcoes});
		console.log('ok', output, 'quadro', frame);
	}
}

main();
