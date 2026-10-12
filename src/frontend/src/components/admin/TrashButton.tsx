"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { adminFetch, getAdminSession, humanError } from "@/lib/admin-api";

interface TrashButtonProps {
  /** The admin API path of the record, e.g. `/talks/12`. */
  path: string;
  /** Where to go once the record is in the trash. */
  listHref: string;
  title: string;
  message: string;
  /** The route is ADMIN-only: hide the button from an editor rather than let it fail. */
  adminOnly?: boolean;
  /** Positioning in the page header; pushed to the right by default. */
  className?: string;
}

// Moves the record a detail page shows to the trash (#599): until then the
// lists were the only place to do it, so deciding from the record meant going
// back and finding its row again.
export default function TrashButton({
  path,
  listHref,
  title,
  message,
  adminOnly = false,
  className = "ml-auto",
}: TrashButtonProps) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(!adminOnly);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminOnly) return;
    getAdminSession().then((session) => setIsAllowed(session?.role === "ADMIN"));
  }, [adminOnly]);

  if (!isAllowed) return null;

  async function moveToTrash() {
    setIsConfirming(false);
    setIsPending(true);
    setError(null);
    const result = await adminFetch(path, { method: "DELETE" });
    setIsPending(false);
    // Soft deletes answer 204, the articles route 200; 0 is a request that
    // never reached the backend, not a success (#428).
    if (result.status !== 204 && result.status !== 200) {
      setError(humanError(result, "La mise à la corbeille a échoué. Réessayez, ou passez par la liste."));
      return;
    }
    router.push(listHref);
  }

  return (
    <div className={`${className} flex items-center gap-3`}>
      {/* Stays until the next attempt: a failure that fades reads as a success (#394). */}
      {error && (
        <p role="alert" className="text-sm text-terre-cuite">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={isPending}
        className="rounded-lg border border-terre-cuite/40 px-4 py-2 text-sm font-medium text-terre-cuite hover:bg-terre-cuite/10 disabled:opacity-50"
      >
        {isPending ? "Mise à la corbeille…" : "Mettre à la corbeille"}
      </button>
      <ConfirmDialog
        isOpen={isConfirming}
        title={title}
        message={message}
        confirmLabel="Mettre à la corbeille"
        variant="danger"
        onConfirm={moveToTrash}
        onCancel={() => setIsConfirming(false)}
      />
    </div>
  );
}
