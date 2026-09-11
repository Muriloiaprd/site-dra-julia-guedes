import L from "leaflet";

/**
 * Tiles escuros (CARTO Dark Matter, sobre dados OpenStreetMap) — gratuitos,
 * sem chave de API, exigem apenas atribuicao. Mantem a identidade escura do
 * Ondilow em vez do OSM claro padrao.
 */
export const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const DARK_TILES_NO_LABELS = "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Desenha a rota com um "glow" (polyline larga e translucida por baixo). */
export function addGlowRoute(map: L.Map, coords: [number, number][], color = "#00FF66", weight = 3): L.Polyline {
  L.polyline(coords, { color, weight: weight * 4, opacity: 0.12, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  L.polyline(coords, { color, weight: weight * 2, opacity: 0.22, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
  return L.polyline(coords, { color, weight, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(map);
}

export function routeMarker(color: string, size = 12, ring = "#0A0A0A"): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${ring};box-shadow:0 0 0 3px ${color}40,0 0 12px ${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
