"use client";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 15));
  }, [center, map]);
  return null;
}

export default function LocationPickerCanvas({
  value,
  fallback,
  onPick,
}: {
  value: { lat: number; lng: number } | null;
  fallback: [number, number];
  onPick: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = value ? [value.lat, value.lng] : fallback;
  return (
    <MapContainer center={center} zoom={value ? 15 : 12} scrollWheelZoom={false} className="h-full w-full" aria-label="Pickup location map. Click to place the pin.">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      <ClickToPick onPick={onPick} />
      {value ? <FlyTo center={[value.lat, value.lng]} /> : null}
      {value ? <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: "#173F32", weight: 3, fillColor: "#E98770", fillOpacity: 1 }} /> : null}
    </MapContainer>
  );
}
