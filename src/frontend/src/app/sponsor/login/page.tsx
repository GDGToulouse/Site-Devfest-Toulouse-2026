"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import SponsorLogin from "@/components/sponsor-space/SponsorLogin";

// Sign-in for a sponsor (#362). Outside [locale] like /admin and /edit: this is
// an application screen, not a page of the public site, and next-intl would
// otherwise prefix it with a locale.

function LoginWithRedirect() {
  const params = useSearchParams();
  // Where to land after signing in. Confined to a path on this site so the
  // parameter cannot bounce someone to another domain.
  const raw = params.get("next") ?? "/sponsor";
  const callbackURL = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/sponsor";
  return <SponsorLogin callbackURL={callbackURL} />;
}

export default function SponsorLoginPage() {
  return (
    <Suspense>
      <LoginWithRedirect />
    </Suspense>
  );
}
