"use client";
import dynamic from "next/dynamic";
import { AppFrame } from "@/components/AppFrame";
import { Spinner } from "@/components/ui";

// Leaflet references `window` at import, so the map must never be server-rendered.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center h-[60vh]">
      <Spinner className="h-6 w-6 text-saffron-600" />
    </div>
  ),
});

export default function MapPage() {
  return (
    <AppFrame>
      <MapView />
    </AppFrame>
  );
}
