---
objective: "Every outbound link a sponsor gets from the site carries rel=\"sponsored noopener noreferrer\", and the DevITJobs.fr record no longer smuggles the rel into its URL."
status: in-progress
---

# Plan: Qualify sponsor links as sponsored

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Mark partner links `sponsored` at render time, then clean the DevITJobs.fr data in production |
| **Source** | [#495](https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/issues/495) |

## Phases

| #   | Phase                                   | File                         |
| --- | --------------------------------------- | ---------------------------- |
| 1   | Sponsored rel on every partner link     | [`phase-1.md`](./phase-1.md) |
| 2   | Clean the DevITJobs.fr record in prod   | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links | `rel="sponsored"` is the value for advertising or paid placements; it combines with other rel values in a space-separated list |

## Decisions

| Decision | Why |
| -------- | --- |
| Add `sponsored` when rendering, on the frontend, not in `sanitizeRichHtml` | The sanitizer is shared with articles and content pages, where a link is not a partnership; it also rewrites `rel` on every save, so a stored value could never be set per context. Rendering covers existing descriptions with no data migration |
| Every outbound link on the sponsor fiche and on the partner job offers page is `sponsored` — website, social links, description links, job offer links and descriptions | The whole fiche and the relayed offers exist because of the partnership; a single rule is easier to hold than a per-link judgment. Links inside the site (root-relative, `#`) stay untouched |
