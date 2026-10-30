import {Easing, interpolate, spring} from 'remotion';

// Utilitários de animação usados pelos personagens e pelas cenas.
// Tudo é função pura do quadro, para o Remotion poder renderizar qualquer quadro isolado.

// Piscada: a cada ~3,5 s (deslocada pela semente), fecha e abre em 5 quadros. 0 = aberto, 1 = fechado.
export function piscar(frame: number, semente = 0): number {
	const periodo = 100 + (semente % 3) * 13;
	const f = (frame + semente * 37) % periodo;
	if (f > 4) return 0;
	return [0.5, 1, 1, 0.6, 0.2][f];
}

// Respiração: sobe e desce poucos pixels.
export function respirar(frame: number, amplitude = 4, semente = 0): number {
	return Math.sin((frame + semente * 11) / 14) * amplitude;
}

// Mola de entrada a partir de `inicio` (0 → 1, com um leve passar do ponto).
export function mola(frame: number, fps: number, inicio = 0, rigidez = 140): number {
	return spring({frame: frame - inicio, fps, config: {damping: 11, stiffness: rigidez, mass: 0.7}});
}

// Vai de a para b entre os quadros i e f, suavizado.
export function entre(frame: number, i: number, f: number, a: number, b: number): number {
	return interpolate(frame, [i, f], [a, b], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.cubic),
	});
}

// Boca falando sem áudio (até a Fase 3 trocar pelo volume da voz): abre e fecha de forma irregular.
export function bocaFalando(frame: number, semente = 0): number {
	const x = frame + semente * 7;
	const v = Math.abs(Math.sin(x * 0.9) * 0.6 + Math.sin(x * 0.37 + 1.3) * 0.4);
	return v < 0.25 ? 0 : Math.min(1, v * 1.2);
}

// Tremidinha de susto/grito.
export function tremer(frame: number, forca = 4): [number, number] {
	return [Math.sin(frame * 2.7) * forca, Math.cos(frame * 3.1) * forca * 0.6];
}
