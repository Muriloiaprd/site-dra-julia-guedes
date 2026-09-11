"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

import type { ActivityPoint } from "@/lib/api";

interface ActivityMapProps {
  points: ActivityPoint[];
  height?: string;
}

function NoGpsPlaceholder({ height }: { height: string }) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-lg border border-brand-border"
      style={{ height, background: "linear-gradient(160deg, #0f1a12 0%, #0a0a0a 100%)" }}
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
    return <NoGpsPlaceholder height={height} />;
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="rounded-lg overflow-hidden border border-brand-border"
    />
  );
}
