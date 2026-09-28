---
objective: "The main menu always offers a « Hall of Replays » link to /replays, tied to the programme when there is one, without ever showing it twice in the footer."
status: in-progress
---

# Plan: Replays link in the main menu

## Overview

| Field      | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| **Goal**   | Surface the cross-edition replays from the main menu (#489)  |
| **Source** | GitHub issue `GDGToulouse/Site-Devfest-Toulouse-2026#489`    |

## Phases

| #   | Phase                      | File                         |
| --- | -------------------------- | ---------------------------- |
| 1   | Hall of Replays in the nav | [`phase-1.md`](./phase-1.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| The link is **always** in the main menu: under « Conférences » when it is a flat link, beside it under « Programme » once the grid is ready, top-level when the edition has no programme yet | « Conférences » only exists while the current edition has published talks. Tying the replays to it alone would hide them between two editions, exactly when they are the site's main content. Decided with Julien on 2026-09-28 |
| Label « Hall of Replays » in both locales, under a new `nav.replays` key | Chosen by Julien over « Replays », echoing « Hall of fame ». The footer keeps its own `footer.replays` (« Replays ») in the archives column |
