import type { StoryLayout } from "../types";
import { bandeiras } from "./bandeiras";
import { desafio } from "./desafio";
import { faixaListras } from "./faixaListras";
import { faixaSimples } from "./faixaSimples";
import { iconesDireita } from "./iconesDireita";
import { iconesEsquerda } from "./iconesEsquerda";
import { iconesSolidos } from "./iconesSolidos";
import { logoLateral } from "./logoLateral";
import { maoApontando } from "./maoApontando";
import { molduraTracejada } from "./molduraTracejada";
import { rotaFaixa } from "./rotaFaixa";
import { rotaGrande } from "./rotaGrande";
import { rotaIcones } from "./rotaIcones";
import { rotaLimpa } from "./rotaLimpa";
import { rotaMinimal } from "./rotaMinimal";
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

export function availableLayouts(hasRoute: boolean): StoryLayout[] {
  return STORY_LAYOUTS.filter((l) => hasRoute || !l.requiresRoute);
}
