"use client";

import dynamic from "next/dynamic";

// `next/dynamic` with `ssr: false` is only allowed inside a Client Component
// (Next.js 16). The venue page is a Server Component, so this thin client
// wrapper holds the dynamic import — Leaflet renders against the DOM and has no
// SSR path. A pulsing placeholder holds the space while it loads.
const VenueMap = dynamic(() => import("./VenueMap"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-2xl bg-blanc-casse" />,
});

interface VenueMapClientProps {
  lat: number;
  lng: number;
  label: string;
}

export default function VenueMapClient(props: VenueMapClientProps) {
  return <VenueMap {...props} />;
}
