import type { StoryLayout } from "../types";
import { bandeiras } from "./bandeiras";
import { desafio } from "./desafio";
import { faixaListras } from "./faixaListras";
import { faixaSimples } from "./faixaSimples";
import { iconesDireita } from "./iconesDireita";
import { iconesEsquerda } from "./iconesEsquerda";
import { iconesSolidos } from "./iconesSolidos";
import { logoLateral } from "./logoLateral";
import { molduraTracejada } from "./molduraTracejada";
import { rotaFaixa } from "./rotaFaixa";
import { rotaIcones } from "./rotaIcones";
import { rotaLimpa } from "./rotaLimpa";
import { rotaMinimal } from "./rotaMinimal";
import { rotulosCentro } from "./rotulosCentro";
import { statsDireita } from "./statsDireita";

/**
 * Ordem de exibição no carrossel do gerador: os 5 primeiros modelos, depois
 * os 10 adicionados em 2026-09-20 na ordem numérica dos PNGs do usuário
 * (1, 2, 4, 5, 6, 8, 11, 12, 14, 15). Ficam fora o 9 e o 10 (elementos
 * soltos, não layouts) e o 18 (PNG vazio).
 */
export const STORY_LAYOUTS: StoryLayout[] = [
  rotaIcones,
  iconesEsquerda,
  rotaFaixa,
  desafio,
  statsDireita,
  iconesDireita,
  rotaMinimal,
  logoLateral,
  rotaLimpa,
  faixaSimples,
  faixaListras,
  bandeiras,
  iconesSolidos,
  rotulosCentro,
  molduraTracejada,
];

export function availableLayouts(hasRoute: boolean): StoryLayout[] {
  return STORY_LAYOUTS.filter((l) => hasRoute || !l.requiresRoute);
}
