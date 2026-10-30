// Gera a legenda .srt do filme a partir da mesma linha do tempo do vídeo.
// Rodar de dentro de Kactus/video:  npx tsx scripts/legendas.ts
import {mkdirSync, writeFileSync} from 'node:fs';
import {FPS, LINHA} from '../src/linhaDoTempo';

const NOMES: Record<string, string> = {beto: 'Beto', duni: 'Duni', tenis: 'Tênis', amigo: 'Amigo'};
const hora = (q: number) => {
	const ms = Math.round((q / FPS) * 1000);
	const p = (n: number, t = 2) => String(n).padStart(t, '0');
	return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

const falas = LINHA.cenas.flatMap((c) => c.falas);
const blocos = falas.map((f, i) => {
	const fim = Math.min(f.fimVoz + 12, falas[i + 1]?.inicio ?? Infinity);
	return `${i + 1}\n${hora(f.inicio)} --> ${hora(fim)}\n${NOMES[f.quem]}: ${f.texto}\n`;
});
mkdirSync('out', {recursive: true});
writeFileSync('out/como-funciona-kactus.srt', blocos.join('\n'), 'utf-8');
console.log(`${blocos.length} legendas em out/como-funciona-kactus.srt`);
