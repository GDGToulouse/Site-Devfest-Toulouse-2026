import { notFound } from "next/navigation";

import ArrivalsZone from "@/components/arrivals/ArrivalsZone";
import { parseStationNumber } from "@/lib/arrivals-station";

export default async function ArrivalsCounterPage({ params }: { params: Promise<{ counter: string }> }) {
  const counter = parseStationNumber((await params).counter);
  if (counter === null) notFound();
  return <ArrivalsZone station={{ kind: "counter", counter, bin: null }} />;
}
