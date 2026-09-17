import type { StoryLayout } from "../types";
import { desafio } from "./desafio";
import { iconesEsquerda } from "./iconesEsquerda";
import { rotaFaixa } from "./rotaFaixa";
import { rotaIcones } from "./rotaIcones";
import { statsDireita } from "./statsDireita";

/** Ordem de exibição no carrossel do gerador. */
export const STORY_LAYOUTS: StoryLayout[] = [rotaIcones, iconesEsquerda, rotaFaixa, desafio, statsDireita];

export function availableLayouts(hasRoute: boolean): StoryLayout[] {
  return STORY_LAYOUTS.filter((l) => hasRoute || !l.requiresRoute);
}
