import L from "leaflet";

/**
 * Tiles escuros (Stadia Maps "Alidade Smooth Dark", sobre dados OpenStreetMap).
 * Gratuitos em localhost sem chave; fora do localhost (ex. IP na rede local),
 * defina NEXT_PUBLIC_STADIA_API_KEY para nao levar 401/403 do provedor.
 * O antigo CARTO passou a exigir chave e parou de funcionar sem uma.
 */
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIA_API_KEY;
const STADIA_QS = STADIA_KEY ? `?api_key=${STADIA_KEY}` : "";

export const DARK_TILES = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png${STADIA_QS}`;
export const DARK_TILES_NO_LABELS = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png${STADIA_QS}`;
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>';

/** Fallback sem chave nenhuma: OSM padrao (claro), escurecido via filtro CSS (.od-map-osm-dark). */
export const FALLBACK_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/**
 * Adiciona a camada de tiles com fallback automatico: se o Stadia falhar
 * (chave invalida, offline, bloqueio), troca para OSM padrao escurecido via
 * CSS, sem deixar o mapa sem base nenhuma.
 */
export function addBaseLayer(map: L.Map, containerEl: HTMLElement, noLabels = false): L.TileLayer {
  const url = noLabels ? DARK_TILES_NO_LABELS : DARK_TILES;
  const layer = L.tileLayer(url, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  layer.once("tileerror", () => {
    containerEl.classList.add("od-map-osm-dark");
    layer.setUrl(FALLBACK_TILES);
    layer.options.attribution = FALLBACK_ATTRIBUTION;
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution(FALLBACK_ATTRIBUTION);
  });
  return layer;
}

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
