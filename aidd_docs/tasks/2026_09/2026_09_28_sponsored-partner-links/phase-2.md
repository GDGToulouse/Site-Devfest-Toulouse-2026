---
status: done
---

# Instruction: Clean the DevITJobs.fr record in prod

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

No file changes: a data correction done by a human through the production back-office. It does not depend on phase 1 and can be done before the release; the `sponsored` on the description link only appears once phase 1 is in production.

## User Journey

```mermaid
flowchart TD
  A[Admin on devfesttoulouse.fr/admin/sponsors] --> B[Open DevITJobs.fr]
  B --> C["Website: https://devitjobs.fr/jobs/DevOps/all"]
  B --> D["Description FR and EN: link to https://DevITJobs.fr"]
  C --> E[Save]
  D --> E
  E --> F[Fiche revalidated on demand]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Read GET /api/sponsors/devitjobs-fr on prod => websiteUrl still ends with ?rel="sponsored", description links http://DevITJobs.fr: 5: api
  section Happy path
    Save the corrected website and descriptions in /admin => GET /api/sponsors/devitjobs-fr returns websiteUrl https://devitjobs.fr/jobs/DevOps/all: 5: api
    Read the same response => descriptionFr and descriptionEn link https://DevITJobs.fr: 5: api
    Read /fr/sponsors/devitjobs-fr and /en/sponsors/devitjobs-fr => the button href has no rel parameter: 5: api
  section Edge case - stale cache
    Page still shows the old URL after saving => trigger revalidation from the admin or wait for s-maxage => the page serves the new URL: 1: api
```

## Tasks to do

### `1)` Correct the website URL

> The rel belongs on the link, not in the query string.

1. In the production back-office, open the DevITJobs.fr sponsor and set the website to `https://devitjobs.fr/jobs/DevOps/all`.

### `2)` Correct the description link

> https, both languages.

1. In the FR and EN descriptions, edit the `DevITJobs.fr` link to `https://DevITJobs.fr`.
2. Save once, and confirm the save feedback shows success.

### `3)` Verify

> Read what production serves, not the form.

1. `curl -s https://devfesttoulouse.fr/api/sponsors/devitjobs-fr` shows the new `websiteUrl` and both https links.
2. The FR and EN fiches serve the new button href. Once phase 1 is released, every link on them also reads `rel="sponsored noopener noreferrer"`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | The prod API returns `websiteUrl` `https://devitjobs.fr/jobs/DevOps/all`, with no `rel` parameter |
| 2 | `descriptionFr` and `descriptionEn` link to `https://DevITJobs.fr`, no `http://` left |
| 3 | The FR and EN fiches serve the corrected button href; after the phase 1 release, their partner links carry `sponsored` |
