---
objective: "A translation never marks a language it did not write, the editor is warned before overwriting a text the AI did not produce, and the « reviewed » checkbox is found without looking for it."
status: in-progress
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Article auto-translation badge on original French text (#488)

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Close the two real defects of #488 (badge raised with nothing translated, silent back-translation over an original text) and make the existing review checkbox visible |
| **Source** | GitHub issue [#488](https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/issues/488) |

## Phases

| #   | Phase                                                     | File                         |
| --- | --------------------------------------------------------- | ---------------------------- |
| 1   | Backend: no translation from an empty source              | [`phase-1.md`](./phase-1.md) |
| 2   | Admin editor: overwrite warning, visible review checkbox  | [`phase-2.md`](./phase-2.md) |
| 3   | Data: other articles flagged auto in French               | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| No automatic clearing of the badge on a manual edit; the existing checkbox stays the only way to mark a language as reviewed, moved to the top of the language panel | Defect 1 of the issue came from a checkbox nobody saw, not from a missing feature: once found, it removed the badge of `les-coulisses-ete-2026` as designed. Visibility fixes it without a second rule on the server |
| `translate-fields` answers `400 { error: "empty_source", message }` when the source body is empty, and writes nothing | The most likely cause of the incident: the French text is intact (checked on production, 2026-09-28), so the badge was raised by a translation that wrote no body. Refusing up front also avoids a half-write (target title replaced, body not) |
