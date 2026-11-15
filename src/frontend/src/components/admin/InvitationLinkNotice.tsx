"use client";

export interface CopiedInvitation {
  url: string;
  // False when the browser refused the clipboard: the link is then copied by hand.
  isCopied: boolean;
}

// Put a link in the clipboard; false when the browser refuses (permission,
// insecure context), so the caller can show it for a copy by hand.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// The invitation link an admin sends by hand when the email went astray (#799).
// It stays on screen until dismissed, selectable, whether the copy worked or
// not: the admin may need it twice, and a message that fades reads as nothing.
export default function InvitationLinkNotice({
  invitation,
  recipient,
  validity,
  note,
  onDismiss,
}: {
  invitation: CopiedInvitation;
  recipient: string;
  validity: string;
  note?: string;
  onDismiss: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-malachite/30 bg-malachite/5 p-4 text-sm text-noir space-y-2">
      <p>
        {invitation.isCopied
          ? `Lien d'invitation de ${recipient} copié. Envoyez-le-lui : il est valable ${validity}.`
          : `Le navigateur a refusé la copie. Sélectionnez le lien d'invitation de ${recipient} ci-dessous ; il est valable ${validity}.`}
        {note && <> {note}</>}
      </p>
      <input
        type="text"
        readOnly
        value={invitation.url}
        aria-label={`Lien d'invitation de ${recipient}`}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-gris/30 bg-blanc px-3 py-2 text-xs text-noir focus:outline-none focus:ring-2 focus:ring-malachite/50"
      />
      <button type="button" onClick={onDismiss} className="text-xs text-gris hover:underline">
        Fermer
      </button>
    </div>
  );
}
