import ArrivalsZone from "@/components/arrivals/ArrivalsZone";

// The choice of station, for the team and the volunteers with an account
// (RG-ARR-25). A station opened by its QR code never lands here: it is sent to
// its own screen (#775).
export default function ArrivalsHomePage() {
  return <ArrivalsZone station={null} />;
}
