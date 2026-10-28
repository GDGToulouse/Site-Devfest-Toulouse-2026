"use client";

import { useEffect } from "react";

const WORKER_URL = "/arrivees-sw.js";

// Installs the event-day zone's service worker (RG-ARR-63, #641). Production
// builds only: under `next dev` the files change on every save, and a worker
// serving yesterday's copy would make every local check lie. A worker left
// over from a production run on the same origin is removed for that reason.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          if (registration.active?.scriptURL.endsWith(WORKER_URL)) registration.unregister();
        }
      });
      return;
    }

    navigator.serviceWorker
      .register(WORKER_URL, { scope: "/arrivees" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // What this visit loaded before the worker was in control.
        const urls = [
          window.location.pathname,
          ...performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(`${window.location.origin}/_next/static/`)),
        ];
        registration.active?.postMessage({ type: "cache-urls", urls });
      })
      .catch(() => {
        // No worker, no offline copy: the zone still works online.
      });
  }, []);

  return null;
}
