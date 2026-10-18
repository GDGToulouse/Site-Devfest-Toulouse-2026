import { richTextUsage } from "@/lib/sponsor-text-limit";

// Space left in a rich description, measured the way the server measures it
// (#610). A share rather than "x / 5000": the count includes the HTML markup,
// so a character count would not match the text the sponsor sees.
//
// The percentage is plain text, not just a colour (WCAG 1.4.1). Only the state
// change goes through the live region: announcing every keystroke would drown
// a screen-reader user typing in the editor.
export default function RichTextLimitMeter({ html }: { html: string }) {
  const { percent, state } = richTextUsage(html);

  const barClass = state === "over" ? "bg-terre-cuite" : state === "warning" ? "bg-orange" : "bg-malachite";

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gris/15" aria-hidden="true">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className={`mt-1 text-xs ${state === "over" ? "text-terre-cuite" : "text-gris-sur-creme"}`}>
        Place utilisée : {percent} %
      </p>
      <p role="status" className="text-xs font-medium text-terre-cuite">
        {state === "over" && "Description trop longue : raccourcissez-la pour pouvoir l'enregistrer."}
        {state === "warning" && <span className="text-noir">Vous approchez de la limite.</span>}
      </p>
    </div>
  );
}
