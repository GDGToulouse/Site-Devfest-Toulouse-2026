export interface SponsorMessage {
  isOk: boolean;
  text: string;
}

// Every outcome the sponsor space reports goes through this one paragraph
// (#427). It was a bare <p> on four of the five screens: the sponsor saved, the
// text appeared, and assistive tech said nothing — and an unheard failure reads
// as a success (#394). The job-offers tab alone carried the attributes, which
// is precisely how the drift survived: the pattern was in the folder, just not
// in a shape the next screen could reuse.
export default function SponsorFeedback({ message }: { message: SponsorMessage | null }) {
  if (!message) return null;

  return (
    <p
      role={message.isOk ? "status" : "alert"}
      aria-live={message.isOk ? "polite" : "assertive"}
      className={`text-sm ${message.isOk ? "text-malachite" : "text-terre-cuite"}`}
    >
      {message.text}
    </p>
  );
}
