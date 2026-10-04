"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/admin-api";
import { getSponsorAccount, type SponsorAccount } from "@/lib/sponsor-api";

// Who is signed in, on every screen of the partner space (#411). The space was
// built around the company: someone invited by two of them saw the title change
// between spaces without ever seeing which address they were signed in with.
export default function SponsorAccountBar() {
  const router = useRouter();
  const [account, setAccount] = useState<SponsorAccount | null>(null);

  useEffect(() => {
    getSponsorAccount().then(({ data }) => setAccount(data));
  }, []);

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
      {account && (
        <span className="min-w-0 truncate text-gris" title={account.email}>
          {account.name && <span className="font-medium text-noir">{account.name} · </span>}
          {account.email}
        </span>
      )}
      <Link href="/sponsor/account" className="font-medium text-bleu hover:underline">
        Mon compte
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/sponsor/login");
        }}
        className="font-medium text-gris hover:text-noir"
      >
        Déconnexion
      </button>
    </div>
  );
}
