"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import FormField from "@/components/admin/FormField";
import SaveFeedback, { type SaveState } from "@/components/admin/SaveFeedback";

// The edition's registration deadline (#822). Past it, every tier shows as
// closed on the site, the countdown above the tickets included. The Billetweb
// import fills it when the event exposes one; this field corrects it by hand.
export default function SalesEndField({ editionId, reloadKey }: { editionId: number; reloadKey: number }) {
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveState>(null);

  useEffect(() => {
    adminFetch<{ salesEndAt: string | null }>(`/tickets/sales-end?editionId=${editionId}`).then(({ data, status }) => {
      if (status === 200 && data) setValue(isoToLocalInput(data.salesEndAt));
    });
  }, [editionId, reloadKey]);

  async function save(next: string) {
    setIsSaving(true);
    const { status, error } = await adminFetch("/tickets/sales-end", {
      method: "PUT",
      body: JSON.stringify({ editionId, salesEndAt: localInputToIso(next) }),
    });
    setIsSaving(false);
    if (status === 200) {
      setValue(next);
      setFeedback({ kind: "ok", text: next ? "Date de fin des inscriptions enregistrée." : "Date de fin des inscriptions retirée." });
    } else {
      setFeedback({ kind: "error", text: error ?? "La date n'a pas été enregistrée. Réessayez." });
    }
  }

  return (
    <div className="bg-blanc-casse/50 rounded-xl p-4 mb-6">
      <div className="max-w-md">
          <FormField
            label="Fin des inscriptions"
            name="ticketSalesEndAt"
            type="datetime-local"
            value={value}
            onChange={setValue}
            helpText="À l'heure de votre ordinateur. Le site affiche un compte à rebours au-dessus des billets, puis les grise à cette heure."
          />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={() => save(value)}
          disabled={isSaving}
          className="px-4 py-2 bg-malachite text-blanc rounded-lg text-sm font-medium hover:bg-malachite/90 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {value && (
          <button
            onClick={() => save("")}
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded-lg border border-gris/30 text-gris hover:bg-blanc-casse disabled:opacity-50"
          >
            Retirer la date
          </button>
        )}
      </div>
      <SaveFeedback state={feedback} onDismiss={() => setFeedback(null)} />
    </div>
  );
}
