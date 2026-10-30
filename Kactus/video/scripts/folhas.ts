// Renderiza a folha de conferência (6 momentos lado a lado) de uma ou mais cenas, com um bundle só.
// Rodar pelo PowerShell:  npx tsx scripts/folhas.ts 6 7 8   →  out/folha-06.png, out/folha-07.png...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const raiz = path.resolve(__dirname, '..');
const cenas = process.argv.slice(2).map(Number);

async function main() {
	const serveUrl = await bundle({entryPoint: path.join(raiz, 'src/index.ts')});
	const opcoes = {browserExecutable: EDGE, chromeMode: 'chrome-for-testing' as const};
	for (const cena of cenas) {
		const composition = await selectComposition({serveUrl, id: 'FolhaCena', inputProps: {cena}, ...opcoes});
		const output = path.join(raiz, 'out', `folha-${String(cena).padStart(2, '0')}.png`);
		await renderStill({composition, serveUrl, output, inputProps: {cena}, ...opcoes});
		console.log('ok', output);
	}
}

main();
