"use client";

import ResetPasswordScreen from "@/components/sponsor-space/ResetPasswordScreen";
import { SPONSOR_SPACE } from "@/lib/account-spaces";

export default function SponsorResetPasswordPage() {
  return <ResetPasswordScreen space={SPONSOR_SPACE} />;
}
