"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppFrame } from "@/components/AppFrame";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { DEFAULT_MAP } from "@/lib/config";

// Free OpenStreetMap raster style (no API key required).
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

type LayerKey = "cases" | "hotspots" | "police" | "cctv";

export default function MapPage() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rafRef = useRef<number | null>(null);
  const [shown, setShown] = useState<Record<LayerKey, boolean>>({
    cases: true,
    hotspots: true,
    police: true,
    cctv: false,
  });
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [DEFAULT_MAP.lng, DEFAULT_MAP.lat],
      zoom: DEFAULT_MAP.zoom,
    });
    map.addControl(new maplibregl.NavigationControl({}), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), "top-right");
    mapRef.current = map;
    map.on("load", async () => {
      map.resize(); // canvas can init at 0×0 before layout settles
      await addData(map);
      startPulse(map);
      setReady(true);
    });
    // Keep the canvas sized to its container (fixes blank/white map).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    const t = setTimeout(() => map.resize(), 400);
    // Surface tile-load failures (e.g. Brave Shields blocking OSM tiles).
    map.on("error", (e: any) => {
      const msg = String(e?.error?.message || "");
      if (msg.includes("tile") || msg.toLowerCase().includes("fetch")) setTileError(true);
    });
    return () => {
      ro.disconnect();
      clearTimeout(t);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addData(map: maplibregl.Map) {
    const [layers, hotspots, cases] = await Promise.all([
      api.geoLayers().catch(() => ({ police_stations: [], cctv: [] })),
      api.geoHotspots().catch(() => ({ hotspots: [] })),
      api.geoCases().catch(() => ({ cases: [] })),
    ]);

    const fc = (features: any[]) => ({ type: "FeatureCollection", features } as any);
    const pt = (lng: number, lat: number, props: any) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: props,
    });

    // Hotspots (risk circles)
    map.addSource("hotspots", {
      type: "geojson",
      data: fc(hotspots.hotspots.map((h: any) => pt(h.lng, h.lat, h))),
    });
    map.addLayer({
      id: "hotspots",
      type: "circle",
      source: "hotspots",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "risk_score"], 0, 8, 2, 28],
        "circle-color": "#ef4444",
        "circle-opacity": 0.18,
        "circle-stroke-color": "#ef4444",
        "circle-stroke-width": 1,
      },
    });

    // CCTV (small dots)
    map.addSource("cctv", { type: "geojson", data: fc((layers.cctv || []).map((c: any) => pt(c.lng, c.lat, c))) });
    map.addLayer({
      id: "cctv",
      type: "circle",
      source: "cctv",
      layout: { visibility: "none" },
      paint: { "circle-radius": 2.5, "circle-color": "#0ea5e9", "circle-opacity": 0.7 },
    });

    // Police stations
    map.addSource("police", {
      type: "geojson",
      data: fc((layers.police_stations || []).map((p: any) => pt(p.lng, p.lat, p))),
    });
    map.addLayer({
      id: "police",
      type: "circle",
      source: "police",
      paint: { "circle-radius": 6, "circle-color": "#1d4ed8", "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
    });

    // Open cases (color by type)
    map.addSource("cases", {
      type: "geojson",
      data: fc((cases.cases || []).map((c: any) => pt(c.lng, c.lat, c))),
    });
    // Expanding "pulse" halo beneath the solid case pins to draw attention.
    map.addLayer({
      id: "cases-pulse",
      type: "circle",
      source: "cases",
      paint: {
        "circle-radius": 8,
        "circle-color": ["match", ["get", "case_type"], "missing", "#ea580c", "found", "#0d9488", "#64748b"],
        "circle-opacity": 0.4,
      },
    });
    map.addLayer({
      id: "cases",
      type: "circle",
      source: "cases",
      paint: {
        "circle-radius": 6,
        "circle-color": ["match", ["get", "case_type"], "missing", "#ea580c", "found", "#0d9488", "#64748b"],
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });

    const popup = new maplibregl.Popup({ closeButton: false });
    map.on("click", "cases", (e: any) => {
      const p = e.features[0].properties;
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:13px"><b>${p.name || "Unknown"}</b><br/>${p.case_id} · ${p.gender || ""} ${p.age_band || ""}<br/>${p.last_seen_location || ""}<br/><a href="/case/${p.id}" style="color:#ea580c">${t("match.viewCase")} →</a></div>`
        )
        .addTo(map);
    });
    map.on("mouseenter", "cases", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "cases", () => (map.getCanvas().style.cursor = ""));
  }

  // Smoothly pulse the open-case halo so the pins visibly "blink".
  function startPulse(map: maplibregl.Map) {
    const period = 1600; // ms per pulse cycle
    const loop = (ts: number) => {
      if (!map.getLayer("cases-pulse")) return;
      const phase = (ts % period) / period; // 0..1
      // Ease the radius outward and fade opacity as it expands.
      const radius = 8 + phase * 16; // 8 -> 24 px
      const opacity = 0.45 * (1 - phase); // 0.45 -> 0
      try {
        map.setPaintProperty("cases-pulse", "circle-radius", radius);
        map.setPaintProperty("cases-pulse", "circle-opacity", opacity);
      } catch {
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function toggle(k: LayerKey) {
    const map = mapRef.current;
    if (!map || !map.getLayer(k)) return;
    const next = !shown[k];
    map.setLayoutProperty(k, "visibility", next ? "visible" : "none");
    // The open-case pins have a paired pulse halo — toggle it together.
    if (k === "cases" && map.getLayer("cases-pulse")) {
      map.setLayoutProperty("cases-pulse", "visibility", next ? "visible" : "none");
    }
    setShown((s) => ({ ...s, [k]: next }));
  }

  const legend: { k: LayerKey; label: string; color: string }[] = [
    { k: "cases", label: t("map.openCases"), color: "#ea580c" },
    { k: "hotspots", label: t("map.hotspots"), color: "#ef4444" },
    { k: "police", label: t("map.police"), color: "#1d4ed8" },
    { k: "cctv", label: t("map.cctv"), color: "#0ea5e9" },
  ];

  return (
    <AppFrame>
      <h1 className="text-xl font-extrabold mb-3">{t("map.title")}</h1>
      {tileError && (
        <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
          Map tiles could not load. If you use Brave/an ad-blocker, lower the Shields for this site
          (OpenStreetMap tiles are being blocked). Case pins, hotspots and routing still work.
        </div>
      )}
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
    </AppFrame>
  );
}
