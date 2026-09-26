import type { ActivityDetail } from "@/lib/api";
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
}

export interface StoryLayout {
  id: string;
  label: string;
  /** Caminho do PNG em public/story-art/, pra pré-carregar antes de desenhar. */
  art: string;
  /** Precisa de rota com GPS para fazer sentido (esconde da lista se não houver). */
  requiresRoute?: boolean;
  draw(ctx: CanvasRenderingContext2D, data: StoryLayoutData): void;
}
