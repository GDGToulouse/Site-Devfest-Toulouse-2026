import {
  googleCalendarUrl,
  outlookCalendarUrl,
  icsUrl,
  type CalendarSession,
} from "@/lib/calendar-links";

interface AddToCalendarProps {
  session: CalendarSession;
  labels: { heading: string; google: string; outlook: string; download: string };
}

// "Add to my calendar" on a session page (#443).
//
// Three doors rather than one: Google and Outlook take a composition URL, and
// everything else — Apple Calendar, Thunderbird, a phone — takes the file. All
// three carry only what the session page already shows publicly.
//
// It lives here and not in a grid cell: at eight rooms a column is 180 px wide
// (#441), which leaves no room for a third control beside the title.
export default function AddToCalendar({ session, labels }: AddToCalendarProps) {
  const links = [
    { key: "google", href: googleCalendarUrl(session), label: labels.google, external: true },
    { key: "outlook", href: outlookCalendarUrl(session), label: labels.outlook, external: true },
    { key: "ics", href: icsUrl(session), label: labels.download, external: false },
  ];

  return (
    <section className="mt-10 rounded-2xl bg-blanc-casse p-5">
      <h2 className="text-lg font-bold text-noir">{labels.heading}</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.key}
            href={link.href}
            // The first two leave the site for a third party; the file does not.
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="rounded-[12px] bg-blanc px-4 py-2 text-sm font-bold text-noir shadow-card transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-malachite/50"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
