"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapPoint } from "./discovery-map-canvas";

// Leaflet touches `window`, so the map is loaded only in the browser.
const Canvas = dynamic(() => import("./discovery-map-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-2xl" />,
});

export function DiscoveryMap(props: { points: MapPoint[]; center: [number, number]; zoom?: number }) {
  // Parent passes a memoized center; the canvas recenters only when its coordinates change.
  return (
    <div className="h-[360px] w-full overflow-hidden rounded-2xl border border-line md:h-[460px]">
      <Canvas {...props} />
    </div>
  );
}
