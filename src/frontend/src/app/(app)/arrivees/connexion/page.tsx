"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import SponsorLogin from "@/components/sponsor-space/SponsorLogin";
import { ARRIVALS_SPACE } from "@/lib/account-spaces";
import { localPath } from "@/lib/local-path";

// Sign-in for a volunteer (#640): the partner space's screen, in the arrivals'
// words. "next" is confined to this site, as on /sponsor/login.
function LoginWithRedirect() {
  const params = useSearchParams();
  const callbackURL = localPath(params.get("next") ?? "/arrivees", "/arrivees");
  return <SponsorLogin callbackURL={callbackURL} space={ARRIVALS_SPACE} />;
}

export default function ArrivalsLoginPage() {
  return (
    <Suspense>
      <LoginWithRedirect />
    </Suspense>
  );
}
