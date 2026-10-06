import { describe, it, expect } from "vitest";

import { absoluteUrl, buildTalkEventJsonLd, buildVideoJsonLd, isCompleteEvent, jsonLdScript } from "./seo";

// JSON-LD is injected through dangerouslySetInnerHTML on every page carrying
// structured data. `JSON.stringify` alone leaves `</script>` intact, which ends
// the element early and turns any user-controlled field into stored XSS — and
// `company` is user-controlled: a speaker sets it through their magic link, and
// it is length-capped but never sanitised.

describe("jsonLdScript", () => {
  it("should neutralise a closing script tag", () => {
    const payload = jsonLdScript({ name: "Ada</script><script>alert(1)</script>" });

    expect(payload).not.toMatch(/<\/script/i);
    expect(payload).not.toContain("<script");
  });

  it("should escape every character able to open or close a tag", () => {
    const payload = jsonLdScript({ a: "<", b: ">", c: "&" });

    expect(payload).not.toContain("<");
    expect(payload).not.toContain(">");
    expect(payload).not.toContain("&");
  });

  // The escaping must not change what a consumer reads, or it would corrupt the
  // structured data it exists to serve.
  it("should round-trip to the original object", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Ada</script>",
      worksFor: { "@type": "Organization", name: "R&D <Labs>" },
    };

    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });

  it("should leave ordinary values untouched", () => {
    expect(JSON.parse(jsonLdScript({ name: "Ada Lovelace" }))).toEqual({ name: "Ada Lovelace" });
  });
});

// Google requires startDate and location on an Event, but both are optional in
// the database — an edition in preparation has neither. Search Console reported
// exactly that pair as two critical errors (#464), and the code did not prevent
// it: it simply had not met an incomplete edition yet.

describe("isCompleteEvent", () => {
  const place = { "@type": "Place", name: "Diagora" };

  it("passes an event carrying both required fields", () => {
    expect(isCompleteEvent({ startDate: "2026-11-19", location: place })).toBe(true);
  });

  it("refuses one with no date", () => {
    // `startDate: undefined` is what `edition.startDate?.split(…) ?? undefined`
    // produces, so this is the shape the builders actually emit.
    expect(isCompleteEvent({ startDate: undefined, location: place })).toBe(false);
  });

  it("refuses one with no venue", () => {
    expect(isCompleteEvent({ startDate: "2026-11-19", location: undefined })).toBe(false);
  });

  it("refuses one with neither — the case the report described", () => {
    expect(isCompleteEvent({})).toBe(false);
  });

  it("does not take an empty string for a date", () => {
    expect(isCompleteEvent({ startDate: "", location: place })).toBe(false);
  });
});

// #465 — the Person builders emitted /uploads/… straight into `image`, where
// Schema.org wants an absolute URL. The rule already existed for the Event's
// image; it just never followed the speakers.

describe("absoluteUrl", () => {
  // Careful with the origin here: under vitest, `process.env.BASE_URL` is "/" —
  // Vite injects its own BASE_URL (the app's base path) into the environment,
  // so neither the production value nor the localhost fallback applies. A test
  // asserting the prefix would be asserting Vite's default. What is worth
  // pinning is the distinction the function draws, not the origin it uses.
  it("prepends the origin to an uploaded asset", () => {
    const prefixed = absoluteUrl("/uploads/photo.jpg");

    expect(prefixed).not.toBe("/uploads/photo.jpg");
    expect(prefixed.endsWith("/uploads/photo.jpg")).toBe(true);
  });

  it("leaves a third-party photo alone", () => {
    // Speakers imported from 2016-2019 are hosted on twimg, gravatar and the
    // like (#356). Prefixing those would produce a doubled, broken URL.
    const external = "https://pbs.twimg.com/profile_images/42.jpg";
    expect(absoluteUrl(external)).toBe(external);
  });

  it("leaves a plain http host alone too", () => {
    expect(absoluteUrl("http://example.org/a.png")).toBe("http://example.org/a.png");
  });
});

// #382 — a talk page announces itself as an Event, and a filmed talk as a
// VideoObject. Both stay silent rather than emit what Google would reject.
describe("buildTalkEventJsonLd (#382)", () => {
  const talk = {
    title: "Kubernetes en production",
    description: "Retour d'expérience.",
    startsAt: "2026-11-19T10:55:00.000Z",
    endsAt: "2026-11-19T11:40:00.000Z",
    room: "Amphithéâtre",
    speakers: [{ name: "Ada Lovelace" }],
  };
  const venue = { venueName: "Diagora", venueAddress: "Labège" };

  it("should describe the session: times, room within the venue, speakers", () => {
    const event = buildTalkEventJsonLd(talk, venue, "/fr/conferences/kubernetes");

    expect(event).toMatchObject({
      "@type": "Event",
      name: "Kubernetes en production",
      startDate: "2026-11-19T10:55:00.000Z",
      endDate: "2026-11-19T11:40:00.000Z",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: "Amphithéâtre, Diagora" },
      performer: [{ "@type": "Person", name: "Ada Lovelace" }],
    });
    expect(isCompleteEvent(event!)).toBe(true);
  });

  it("should emit nothing before the session is placed on the grid or the venue is known", () => {
    expect(buildTalkEventJsonLd({ ...talk, startsAt: null }, venue, "/x")).toBeNull();
    expect(buildTalkEventJsonLd(talk, { venueName: null, venueAddress: null }, "/x")).toBeNull();
  });
});

describe("buildVideoJsonLd (#382)", () => {
  it("should describe a YouTube replay with its thumbnail and upload date", () => {
    const video = buildVideoJsonLd({ title: "Talk", description: "", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, "2024-11-21");

    expect(video).toMatchObject({
      "@type": "VideoObject",
      name: "Talk",
      thumbnailUrl: ["https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"],
      uploadDate: "2024-11-21",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
    // Google requires a description: the title stands in for an empty one.
    expect(video!.description).toBe("Talk");
  });

  it("should emit nothing without a date or a recognisable YouTube URL", () => {
    expect(buildVideoJsonLd({ title: "T", description: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }, null)).toBeNull();
    expect(buildVideoJsonLd({ title: "T", description: "", videoUrl: "https://vimeo.com/1" }, "2024-11-21")).toBeNull();
  });
});
