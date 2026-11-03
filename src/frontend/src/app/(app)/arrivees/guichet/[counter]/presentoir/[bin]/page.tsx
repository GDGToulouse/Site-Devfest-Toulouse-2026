import { notFound } from "next/navigation";

import ArrivalsZone from "@/components/arrivals/ArrivalsZone";
import { parseStationNumber } from "@/lib/arrivals-station";

export default async function ArrivalsBinPage({ params }: { params: Promise<{ counter: string; bin: string }> }) {
  const { counter: rawCounter, bin: rawBin } = await params;
  const counter = parseStationNumber(rawCounter);
  const bin = parseStationNumber(rawBin);
  if (counter === null || bin === null) notFound();
  return <ArrivalsZone station={{ kind: "counter", counter, bin }} />;
}
