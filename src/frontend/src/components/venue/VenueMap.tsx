"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { venueMarkerIcon } from "./marker-icon";

interface VenueMapProps {
  lat: number;
  lng: number;
  label: string;
}

export default function VenueMap({ lat, lng, label }: VenueMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-2xl"
      // Leaflet renders into this container imperatively; a fixed height is
      // required or the map collapses to 0px.
      style={{ height: "20rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={venueMarkerIcon}>
        <Popup>{label}</Popup>
      </Marker>
    </MapContainer>
  );
}
