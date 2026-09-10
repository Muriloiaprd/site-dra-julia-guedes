"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import type { ActivityPoint } from "@/lib/api";

interface ActivityMapProps {
  points: ActivityPoint[];
  height?: string;
}

export function ActivityMap({ points, height = "320px" }: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const coords = points
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => [p.lat!, p.lon!] as [number, number]);

    if (coords.length === 0 || !containerRef.current) return;
    if (mapRef.current) return; // já inicializado

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline(coords, { color: "#00FF66", weight: 3, opacity: 0.9 }).addTo(map);
    map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

    // marcadores de início e fim
    const startIcon = L.divIcon({
      className: "",
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#00FF66;border:2px solid #000;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    const endIcon = L.divIcon({
      className: "",
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#f85149;border:2px solid #fff;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    L.marker(coords[0], { icon: startIcon }).addTo(map);
    L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  const hasGps = points.some((p) => p.lat != null && p.lon != null);

  if (!hasGps) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-brand-muted text-sm"
        style={{ height }}
      >
        Atividade sem dados GPS
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="rounded-lg overflow-hidden border border-brand-border"
    />
  );
}
