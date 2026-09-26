"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import type { ActivityPoint } from "@/lib/api";
import { addBaseLayer, addGlowRoute, routeMarker } from "@/lib/mapTiles";

interface ActivityMapProps {
  points: ActivityPoint[];
  height?: string;
}

function NoGpsPlaceholder({ height }: { height: string }) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-tile"
      style={{ height, background: "radial-gradient(ellipse at 50% 40%, #0f1a12 0%, #0a0a0a 75%)" }}
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* "mapa" ilustrativo: curvas topograficas + grade, imagem padrao pra atividades sem GPS */}
        <path d="M-20 40 C 60 10, 140 70, 220 30 S 380 50, 440 20" stroke="#00FF66" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M-20 90 C 70 60, 130 120, 210 80 S 360 100, 440 70" stroke="#00FF66" strokeOpacity="0.25" strokeWidth="1.5" />
        <path d="M-20 150 C 80 120, 150 180, 230 140 S 370 160, 440 130" stroke="#00FF66" strokeOpacity="0.2" strokeWidth="1.5" />
        <path d="M-20 200 C 90 175, 160 220, 240 190 S 380 205, 440 180" stroke="#00FF66" strokeOpacity="0.15" strokeWidth="1.5" />
        <path d="M40 -10 L20 250" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 6" />
        <path d="M160 -10 L150 250" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 6" />
        <path d="M280 -10 L280 250" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 6" />
      </svg>
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#00FF66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
          <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
          <line x1="3" y1="21" x2="21" y2="3" strokeOpacity="0.6" />
        </svg>
        <p className="text-xs font-medium text-brand-muted">Atividade sem dados de GPS</p>
      </div>
    </div>
  );
}

export function ActivityMap({ points, height = "320px" }: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const coords = points
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (coords.length < 2 || !containerRef.current) return;
    if (mapRef.current) return; // já inicializado

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix(false);
    mapRef.current = map;

    addBaseLayer(map, containerRef.current);

    const polyline = addGlowRoute(map, coords, "#00FF66", 3.5);
    map.fitBounds(polyline.getBounds(), { padding: [28, 28] });

    // marcadores de início (verde) e fim (lima)
    L.marker(coords[0], { icon: routeMarker("#00FF66", 14), title: "Início" }).addTo(map);
    L.marker(coords[coords.length - 1], { icon: routeMarker("#C6FF00", 14), title: "Fim" }).addTo(map);

    // scroll do mouse só com o mapa focado — evita "prender" a rolagem da página
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  const hasGps = points.filter((p) => p.lat != null && p.lon != null).length >= 2;

  if (!hasGps) {
    return <NoGpsPlaceholder height={height} />;
  }

  return (
    <div className="relative overflow-hidden rounded-tile">
      <div ref={containerRef} style={{ height }} className="od-map" />
      <div className="pointer-events-none absolute inset-0 rounded-tile" style={{ boxShadow: "inset 0 0 60px 10px rgba(10,10,10,0.55), inset 0 0 0 1px rgba(255,255,255,0.06)" }} />
    </div>
  );
}
