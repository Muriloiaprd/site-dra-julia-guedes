"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import type { ActivityPoint } from "@/lib/api";

interface ActivityMiniMapProps {
  points: ActivityPoint[];
  height?: number;
  color?: string;
}

/** Mapa estatico (sem zoom/drag) para preview em cards — usa os mesmos tiles
 * OSM do mapa interativo da pagina de detalhe, so que sem controles. */
export function ActivityMiniMap({ points, height = 96, color = "#00FF66" }: ActivityMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const coords = points
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (coords.length < 2 || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
      fadeAnimation: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    const polyline = L.polyline(coords, { color, weight: 3, opacity: 0.95 }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [10, 10] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points, color]);

  return <div ref={containerRef} style={{ height, width: "100%" }} />;
}
