import L from "leaflet";

// Leaflet's default marker icon URLs break under a bundler (they resolve against
// the CSS file, not the app). Point them at unpkg so the pin actually shows —
// img-src in the CSP already allows any https image, so no CSP change needed.
export const venueMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
