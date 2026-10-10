"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Canvas = dynamic(() => import("./location-picker-canvas"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

/** Pin the exact pickup point. Only the donor and, after confirmation, the handover parties see it. */
export function LocationPicker(props: { value: { lat: number; lng: number } | null; fallback: [number, number]; onPick: (lat: number, lng: number) => void }) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-2xl border border-line md:h-72">
      <Canvas {...props} />
    </div>
  );
}
