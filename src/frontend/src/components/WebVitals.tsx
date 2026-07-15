"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePlausible } from "next-plausible";

// Core Web Vitals reporting (#118). Next measures the metrics in the browser;
// we forward the ones that matter for our performance targets to Plausible as
// custom events. Nothing user-identifying is sent — only the metric, its value
// and Google's rating bucket.
const REPORTED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

type WebVitalsEvents = {
  "Web Vitals": { metric: string; value: number; rating: string };
};

export default function WebVitals() {
  const plausible = usePlausible<WebVitalsEvents>();

  useReportWebVitals((metric) => {
    if (!REPORTED_METRICS.has(metric.name)) return;

    plausible("Web Vitals", {
      props: {
        metric: metric.name,
        // CLS is a unitless ratio (kept at 3 decimals); the others are
        // milliseconds, where sub-millisecond precision is noise.
        value: metric.name === "CLS"
          ? Math.round(metric.value * 1000) / 1000
          : Math.round(metric.value),
        rating: metric.rating,
      },
    });
  });

  return null;
}
