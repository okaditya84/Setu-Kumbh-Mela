"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { DEFAULT_MAP } from "@/lib/config";

// Leaflet (DOM raster tiles, no WebGL) so it works in Brave/hardened browsers
// where MapLibre's WebGL canvas is blocked. OpenStreetMap tiles, no API key.
// Loaded with ssr:false (see app/map/page.tsx) — Leaflet touches `window` at import.
type LayerKey = "cases" | "hotspots" | "police" | "cctv";

export default function MapView() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groups = useRef<Record<LayerKey, L.LayerGroup>>({} as any);
  const [shown, setShown] = useState<Record<LayerKey, boolean>>({
    cases: true,
    hotspots: true,
    police: true,
    cctv: false,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [DEFAULT_MAP.lat, DEFAULT_MAP.lng], zoom: DEFAULT_MAP.zoom });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    groups.current = {
      hotspots: L.layerGroup().addTo(map),
      police: L.layerGroup().addTo(map),
      cases: L.layerGroup().addTo(map),
      cctv: L.layerGroup(),
    };

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);
    setTimeout(() => map.invalidateSize(), 300);

    void load(map);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(map: L.Map) {
    const [layers, hotspots, cases] = await Promise.all([
      api.geoLayers().catch(() => ({ police_stations: [], cctv: [] })),
      api.geoHotspots().catch(() => ({ hotspots: [] })),
      api.geoCases().catch(() => ({ cases: [] })),
    ]);

    // Risk hotspots — translucent red circles sized by risk.
    for (const h of hotspots.hotspots || []) {
      L.circle([h.lat, h.lng], {
        radius: 150 + (h.risk_score || 1) * 220,
        color: "#ef4444",
        weight: 1,
        fillColor: "#ef4444",
        fillOpacity: 0.12,
      }).addTo(groups.current.hotspots);
    }
    // CCTV — small blue dots (hidden by default).
    for (const c of layers.cctv || []) {
      L.circleMarker([c.lat, c.lng], { radius: 2, color: "#0ea5e9", weight: 1, fillOpacity: 0.7 }).addTo(
        groups.current.cctv
      );
    }
    // Police stations.
    for (const s of layers.police_stations || []) {
      L.circleMarker([s.lat, s.lng], { radius: 6, color: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.9, weight: 2 })
        .bindPopup(`<b>${s.name}</b><br/>Police station`)
        .addTo(groups.current.police);
    }
    // Open cases — pulsing pins (saffron=missing, teal=found).
    for (const c of cases.cases || []) {
      const color = c.case_type === "missing" ? "#ea580c" : "#0d9488";
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
        className: "case-pulse",
      })
        .bindPopup(
          `<div style="font-size:13px"><b>${c.name || "Unknown"}</b><br/>` +
            `${c.case_id} · ${c.gender || ""} ${c.age_band || ""}<br/>` +
            `${c.case_type === "missing" ? "Missing report" : "Found person"} · ${c.last_seen_location || ""}<br/>` +
            `<a href="/case/${c.id}" style="color:#ea580c;font-weight:600">Open →</a></div>`
        )
        .addTo(groups.current.cases);
    }
    map.invalidateSize();
    setReady(true);
  }

  function toggle(k: LayerKey) {
    const map = mapRef.current;
    const g = groups.current[k];
    if (!map || !g) return;
    const next = !shown[k];
    if (next) g.addTo(map);
    else map.removeLayer(g);
    setShown((s) => ({ ...s, [k]: next }));
  }

  const legend: { k: LayerKey; label: string; color: string }[] = [
    { k: "cases", label: t("map.openCases"), color: "#ea580c" },
    { k: "hotspots", label: t("map.hotspots"), color: "#ef4444" },
    { k: "police", label: t("map.police"), color: "#1d4ed8" },
    { k: "cctv", label: t("map.cctv"), color: "#0ea5e9" },
  ];

  return (
    <>
      <h1 className="text-xl font-extrabold mb-3">{t("map.title")}</h1>
      <div className="card overflow-hidden">
        <div ref={ref} className="h-[60vh] lg:h-[72vh] w-full bg-slate-100" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {legend.map((l) => (
          <button
            key={l.k}
            onClick={() => toggle(l.k)}
            disabled={!ready}
            className={`chip border ${shown[l.k] ? "bg-white border-slate-300" : "bg-slate-100 border-transparent opacity-50"}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </button>
        ))}
      </div>
      <style>{`
        .case-pulse { animation: casepulse 1.6s ease-in-out infinite; }
        @keyframes casepulse { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.2; } }
        .leaflet-container { font: inherit; }
      `}</style>
    </>
  );
}
