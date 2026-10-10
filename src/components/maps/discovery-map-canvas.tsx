"use client";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

export interface MapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  areaLabel: string;
  exact: boolean;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

/** OpenStreetMap tiles via Leaflet. Points are approximate for public viewers. */
export default function DiscoveryMapCanvas({ points, center, zoom = 12 }: { points: MapPoint[]; center: [number, number]; zoom?: number }) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full rounded-2xl" aria-label="Map of available food near you">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Recenter center={center} />
      {points.map((p) => (
        <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={9} pathOptions={{ color: "#173F32", weight: 2, fillColor: "#E98770", fillOpacity: 0.95 }}>
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{p.title}</p>
              <p className="text-xs text-gray-600">{p.areaLabel}{p.exact ? "" : " (approximate)"}</p>
              <Link className="text-xs font-semibold text-[#245C45] underline" href={`/donations/${p.id}`}>Open details</Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
