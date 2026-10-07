import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { TALK_FEEDBACK_ITEMS } from "./talk-feedback.js";

// #567 — the recap email names the appreciations with the backend's labels,
// the site with the frontend's (messages/*.json, feedback.items). A speaker
// must read the same words in both. Skipped in the backend container, which
// mounts src/backend only; the CI has the whole repository.

const MESSAGES = (lang: string) => new URL(`../../../frontend/messages/${lang}.json`, import.meta.url);

describe.skipIf(!existsSync(MESSAGES("fr")))("feedback labels parity with the frontend (#567)", () => {
  it.each(["fr", "en"] as const)("should label every appreciation as the site does, in %s", (lang) => {
    const site = JSON.parse(readFileSync(MESSAGES(lang), "utf8")).feedback.items as Record<string, string>;
    const backend = Object.fromEntries(TALK_FEEDBACK_ITEMS.map((item) => [item.code, item[lang]]));

    expect(backend).toEqual(site);
  });
});
