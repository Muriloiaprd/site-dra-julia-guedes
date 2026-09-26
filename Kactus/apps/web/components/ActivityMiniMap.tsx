"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import type { ActivityPoint } from "@/lib/api";
import { addBaseLayer, addGlowRoute, routeMarker } from "@/lib/mapTiles";

interface ActivityMiniMapProps {
  points: ActivityPoint[];
  height?: number | string;
  color?: string;
  padding?: number;
}

/** Mapa estatico (sem zoom/drag) para preview em cards — tiles escuros, rota com glow. */
export function ActivityMiniMap({ points, height = 96, color = "#00FF66", padding = 14 }: ActivityMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const coords = points
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (coords.length < 2 || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false,
      fadeAnimation: false,
    });
    map.attributionControl.setPrefix(false);
    mapRef.current = map;

    addBaseLayer(map, containerRef.current, true);

    const polyline = addGlowRoute(map, coords, color, 2.5);
    L.marker(coords[0], { icon: routeMarker(color, 7), interactive: false }).addTo(map);
    L.marker(coords[coords.length - 1], { icon: routeMarker("#C6FF00", 7), interactive: false }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [padding, padding] });

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      map.fitBounds(polyline.getBounds(), { padding: [padding, padding] });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [points, color, padding]);

  return <div ref={containerRef} className="od-map od-map-mini" style={{ height, width: "100%" }} />;
}
