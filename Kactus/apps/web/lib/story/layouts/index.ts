import type { StoryAvailability, StoryLayout } from "../types";
import { bandeiras } from "./bandeiras";
import { batimento } from "./batimento";
import { bilhete } from "./bilhete";
import { desafio } from "./desafio";
import { faixaListras } from "./faixaListras";
import { faixaSimples } from "./faixaSimples";
import { iconesDireita } from "./iconesDireita";
import { iconesEsquerda } from "./iconesEsquerda";
import { iconesSolidos } from "./iconesSolidos";
import { logoLateral } from "./logoLateral";
import { maoApontando } from "./maoApontando";
import { molduraTracejada } from "./molduraTracejada";
import { montanha } from "./montanha";
import { parciais } from "./parciais";
import { recibo } from "./recibo";
import { rotaFaixa } from "./rotaFaixa";
import { rotaGrande } from "./rotaGrande";
import { rotaIcones } from "./rotaIcones";
import { rotaLimpa } from "./rotaLimpa";
import { rotaMinimal } from "./rotaMinimal";
import { rotaRitmo } from "./rotaRitmo";
import { rotulosCentro } from "./rotulosCentro";
import { simboloMetricas } from "./simboloMetricas";
import { statsDireita } from "./statsDireita";
import { tenis } from "./tenis";

/** Ordem de exibição no carrossel do gerador: a numeração das 19 artes Kactus do usuário (Imagens/Com fundo transparente/1..19.png). */
export const STORY_LAYOUTS: StoryLayout[] = [
  iconesDireita,
  iconesEsquerda,
  rotaMinimal,
  logoLateral,
  rotaLimpa,
  faixaSimples,
  rotaFaixa,
  faixaListras,
  maoApontando,
  simboloMetricas,
  tenis,
  bandeiras,
  iconesSolidos,
  rotaIcones,
  rotulosCentro,
  molduraTracejada,
  desafio,
  statsDireita,
  rotaGrande,
];

/**
 * Modelos desenhados em código, em que o dado do treino é a arte (planejamento 2026-09-29_2).
 * Vêm primeiro no carrossel. Ficam fora de STORY_LAYOUTS porque não têm arte do Canva
 * para comparar no /story-calibrate.
 */
export const DATA_LAYOUTS: StoryLayout[] = [batimento, parciais, montanha, rotaRitmo, recibo, bilhete];

export function availableLayouts(input: StoryAvailability): StoryLayout[] {
  const hasRoute = input.routePoints.length >= 2;
  return [...DATA_LAYOUTS, ...STORY_LAYOUTS].filter(
    (l) => (hasRoute || !l.requiresRoute) && (!l.available || l.available(input))
  );
}
