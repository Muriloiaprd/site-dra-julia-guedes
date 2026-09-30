import type { ActivityDetail, HrZones, Split, ZoneBucket } from "@/lib/api";
import type { StoryMetric } from "./metrics";

export interface StoryPhoto {
  image: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface StoryLayoutData {
  activity: ActivityDetail;
  metrics: StoryMetric[];
  /** Coordenadas [lat, lon] com GPS (já filtradas de nulos). */
  routePoints: { lat: number; lon: number }[];
  photo: StoryPhoto | null;
  /** Arte original (PNG do Canva) já carregada — cada layout monta sua própria camada a partir dela. */
  art: HTMLImageElement;
  transparent: boolean;
  color: string;
  /** Parciais por km (as mesmas da tabela da atividade); vazio quando não há. */
  splits: Split[];
  /** Tempo em cada zona de FC (as mesmas barras da atividade). */
  zones: ZoneBucket[];
  /** Zonas de FC do perfil, para colorir a curva do "Batimento". */
  hrZones: HrZones | null;
  /** Primeiro nome do atleta ("passageiro" do bilhete). */
  athleteName: string | null;
  /** Quadro do vídeo: 0 = começo, 1 = imagem final (padrão). Só os modelos `animated` usam. */
  progress?: number;
}

/** O que decide se um modelo faz sentido para a atividade (ex.: "Batimento" precisa de FC). */
export interface StoryAvailability {
  activity: ActivityDetail;
  routePoints: { lat: number; lon: number }[];
  splits: Split[];
}

export interface StoryLayout {
  id: string;
  label: string;
  /** Caminho do PNG em public/story-art/, pra pré-carregar antes de desenhar. */
  art: string;
  /** Precisa de rota com GPS para fazer sentido (esconde da lista se não houver). */
  requiresRoute?: boolean;
  /** Modelos desenhados em código: escondem-se quando falta o dado de que precisam. */
  available?(input: StoryAvailability): boolean;
  /** Mostra o selo "novo" no chip do carrossel. */
  isNew?: boolean;
  /** Sabe desenhar quadros intermediários (`data.progress`): pode virar vídeo. */
  animated?: boolean;
  draw(ctx: CanvasRenderingContext2D, data: StoryLayoutData): void;
}
