// Deixa o volume do vídeo no padrão de redes sociais (-16 LUFS, pico -1,5 dB) sem mexer na imagem.
// O render do Remotion sai baixo (voz perto de -25 dB). Usa o ffmpeg que vem com o Remotion.
//   npx tsx scripts/normalizar.ts out/bruto.mp4 out/como-funciona-kactus.mp4
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const [entrada = 'out/bruto.mp4', saida = 'out/como-funciona-kactus.mp4'] = process.argv.slice(2);
const ffmpeg = path.join(__dirname, '..', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
execFileSync(
	ffmpeg,
	['-hide_banner', '-loglevel', 'error', '-y', '-i', entrada, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', saida],
	{stdio: 'inherit'},
);
console.log(`ok ${saida}`);
