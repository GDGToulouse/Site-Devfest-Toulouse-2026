"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { venueMarkerIcon } from "@/components/venue/marker-icon";

// Where the pin goes on /lieu, seen while it is typed (#710). Two bare numbers
// let the metro stop next door pass for the congress centre: on a map the
// mistake shows at once, and a click or a drag puts the pin where it belongs.

// Toulouse, for a venue that has no coordinates yet.
const FALLBACK_CENTER: [number, number] = [43.6045, 1.444];

interface VenueLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

/** Clicking the map moves the pin there. */
function PickOnClick({ onPick }: Pick<VenueLocationPickerProps, "onPick">) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Coordinates typed in the fields bring the map along. */
function FollowPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

export default function VenueLocationPicker({ lat, lng, onPick }: VenueLocationPickerProps) {
  const hasPin = lat !== null && lng !== null;
  return (
    <MapContainer
      center={hasPin ? [lat, lng] : FALLBACK_CENTER}
      zoom={hasPin ? 16 : 11}
      scrollWheelZoom={false}
      className="w-full rounded-[12px]"
      // Leaflet renders into this container imperatively; a fixed height is
      // required or the map collapses to 0px.
      style={{ height: "20rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PickOnClick onPick={onPick} />
      {hasPin && (
        <>
          <Marker
            position={[lat, lng]}
            icon={venueMarkerIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const { lat: newLat, lng: newLng } = event.target.getLatLng();
                onPick(newLat, newLng);
              },
            }}
          />
          <FollowPin lat={lat} lng={lng} />
        </>
      )}
    </MapContainer>
  );
}
