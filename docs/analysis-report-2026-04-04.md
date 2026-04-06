# Code Compliance Analysis Report
**Generated**: 2026-04-04
**Project**: Site DevFest Toulouse 2026
**Analyzer**: Spec Compliance Analyzer Agent

---

## Table of Contents

1. [Specification Documents Analyzed](#specification-documents-analyzed)
   - [Document Inventory](#document-inventory)
   - [Coverage Assessment](#coverage-assessment)
2. [Code Analysis Summary](#code-analysis-summary)
   - [Analyzed Components](#analyzed-components)
   - [Technology Stack Detected](#technology-stack-detected)
   - [Code Structure Overview](#code-structure-overview)
   - [Analysis Metrics](#analysis-metrics)
3. [Discrepancies Found](#discrepancies-found)
   - [Critical Issues](#critical-issues)
   - [High Priority Issues](#high-priority-issues)
   - [Medium Priority Issues](#medium-priority-issues)
   - [Low Priority Issues](#low-priority-issues)
   - [Discrepancy Categories](#discrepancy-categories)
4. [Prioritized Task List](#prioritized-task-list)
   - [Critical Tasks](#critical-tasks)
   - [High Priority Tasks](#high-priority-tasks-1)
   - [Medium Priority Tasks](#medium-priority-tasks-1)
   - [Low Priority Tasks](#low-priority-tasks-1)
5. [Task Tracking Table](#task-tracking-table)
6. [Execution Guide](#execution-guide)
   - [How to Execute Tasks](#how-to-execute-tasks)
   - [Verification Checklist](#verification-checklist)
   - [Re-analysis Instructions](#re-analysis-instructions)

---

## PART 1: Specification Documents Analyzed

### Document Inventory

| Document | Path | Scope |
|----------|------|-------|
| Feature list | `docs/fonctionnalites-2026.md` | All pages, components, user roles, admin |
| Technical objectives | `docs/objectifs-techniques.md` | SEO, performance, a11y, caching, i18n |
| Development prioritization | `docs/priorisation-developpement.md` | Lots 1–5, deadlines, features per lot |
| Business data model | `docs/modele-donnees-metier.md` | All domain entities, attributes, relations |
| Design system | `docs/design-system.md` | Colors, typography, tokens, UI components |
| Lot 1 spec (detailed) | `docs/specs/lot-1-fondations.md` | User stories and business rules for Lot 1 |
| Lot 2 spec | `docs/specs/lot-2-speakers-sponsors.md` | Speakers, sponsors, sessions |
| Lot 3 spec | `docs/specs/lot-3-programme.md` | Programme / schedule |
| Lot 4 spec | `docs/specs/lot-4-contenu.md` | Venue, team, FAQ, history, replays |
| Lot 5 spec | `docs/specs/lot-5-jour-j.md` | Passport digital, day-of features |
| Lot 1 progress tracker | `SUIVI-LOT-1.md` | Phase-by-phase task status |

### Coverage Assessment

The specifications cover the full product from foundations (Lot 1, deadline 08 April 2026 — already past) through the event day (Lot 5, deadline 19 November 2026). The analysis focuses on what has been built vs. what the specs require, prioritized by the V1 release scope defined in Lot 1.

---

## PART 2: Code Analysis Summary

### Analyzed Components

**Frontend** (`src/frontend/src/`):
- `app/[locale]/` — 14 pages (home, blog list, blog detail, tag page, ticketing, CFP, contact, code-of-conduct, legal, 404, admin pages)
- `components/` — 8 public components, 10+ admin components
- `lib/` — API client, type definitions, i18n helpers
- `app/` — sitemap.ts, robots.ts, layout.tsx, globals.css

**Backend** (`src/backend/src/`):
- `routes/` — 5 public route files, 9 admin route files
- `lib/` — auth (Better Auth), email (nodemailer), prisma, admin-guard, revalidate
- `__tests__/` — 39 tests covering public and admin routes

**Database** (`prisma/schema.prisma`):
- Models: Edition, KeyFigure, Article, Tag, TicketTier, ContactCategory, ContactMessage, ContentPage, User, Session, Account, Verification, SiteSetting

### Technology Stack Detected

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Server Components), Tailwind CSS v4, next-intl, pnpm |
| Backend | Node.js + Fastify, Prisma ORM, PostgreSQL |
| Auth | Better Auth (email/password + Google + GitHub OAuth) |
| Email | nodemailer + MailHog (dev) |
| Rich text editor | TipTap (via RichTextEditor component, used in article editor) |
| Hosting | Docker Compose (dev), Coolify (prod) |
| Typography | Google Sans (via next/font/google) |

### Code Structure Overview

The architecture follows the spec: strict frontend/backend separation, frontend calls backend via HTTP, Prisma owned by backend only. SSR with Next.js fetch cache (`revalidate`). Admin routes protected by role-based middleware (`requireAdmin` / `requireAdminRole`). i18n routing via next-intl with `/fr/` and `/en/` prefixes.

### Analysis Metrics

- Total Lot 1 requirements (user stories + business rules): ~90
- Requirements implemented: ~72
- Requirements partially implemented: ~10
- Requirements not implemented: ~8
- Total discrepancies found: 21 (corrigé à 19 après revue : CRIT-03 reclassé Lot 2, HIGH-03 supprimé)

---

## PART 3: Discrepancies Found

### Critical Issues

**CRIT-01 — PREPARATION and SEE_YOU_NEXT_YEAR homepage modes not implemented**
The homepage only handles `ANNOUNCEMENT` mode. When `edition.status` is `PREPARATION` or `SEE_YOU_NEXT_YEAR`, the page renders only the `HeroSection` (with a fallback placeholder image). The spec (RG-082, RG-084) requires distinct content per status: teasing hero + newsletter + replay for PREPARATION; bilan + aftermovie + gallery + links for SEE_YOU_NEXT_YEAR.
- Files: `src/frontend/src/app/[locale]/page.tsx` (lines 69–104)
- Spec: `docs/fonctionnalites-2026.md` §Page d'accueil, `docs/objectifs-techniques.md` §Contenu conditionnel, `docs/specs/lot-1-fondations.md` RG-080–084

**CRIT-02 — Cache-Control headers (s-maxage) missing on public pages**
The spec (RG-002, RG-003) requires `Cache-Control: s-maxage=3600, stale-while-revalidate=60` on all public HTML pages (and `s-maxage=300` on the homepage). The `next.config.ts` sets security headers globally but does NOT set `Cache-Control: s-maxage` on any route. The `fetchAPI()` function uses `{ next: { revalidate } }` for Next.js ISR, but this is not the same as sending HTTP cache headers to a CDN. Without these headers, Coolify/Traefik cannot cache at the edge level.
- Files: `src/frontend/next.config.ts`, `src/frontend/src/lib/api.ts`
- Spec: `docs/specs/lot-1-fondations.md` RG-002, RG-003; `docs/objectifs-techniques.md` §Politique de cache

**~~CRIT-03~~ → Reclassé LOT-2 — Speakers, Sessions, and Sponsors not in Prisma schema**
> **Note (revue du 05/04/2026)** : non bloquant pour la V1. Les onglets admin sont en placeholder (0), les liens du header sont masqués via les flags `isProgramPublished`/`hasSpeakers`/`hasSponsors`. Ce point sera traité intégralement dans le Lot 2 (deadline 19 juin 2026).

Le Prisma schema ne contient pas les modèles `Speaker`, `Session`, `Sponsor`, `Venue`, `Room`, ou `TimeSlot`. Ce périmètre relève du Lot 2.
- Files: `prisma/schema.prisma`, `src/backend/src/routes/editions.ts`, `src/frontend/src/app/[locale]/admin/editions/[id]/page.tsx`
- Spec: `docs/modele-donnees-metier.md` §Session, §Speaker, §Sponsor, §Lieu, §Salle; `docs/priorisation-developpement.md` Lot 2

### High Priority Issues

**HIGH-01 — Language suggestion banner (browser language detection) not implemented**
Spec RG-036–038 requires a non-blocking banner suggesting a language switch based on browser `Accept-Language`, with the user's choice stored in localStorage. The `LanguageSwitcher` component provides a toggle but no auto-detection or banner exists.
- Files: `src/frontend/src/components/LanguageSwitcher.tsx`, `src/frontend/src/app/[locale]/layout.tsx`
- Spec: `docs/specs/lot-1-fondations.md` RG-036, RG-037, RG-038; `SUIVI-LOT-1.md` Phase 2.3 (PARTIAL)

**HIGH-02 — Font Awesome not integrated**
The design system specifies Font Awesome for functional icons (stats, social networks). The `SUIVI-LOT-1.md` explicitly marks task 1.6 as TODO. Currently the stats section (`StatIcon`) uses inline SVGs and the social icons use hardcoded SVGs. Font Awesome (fa-calendar-days, fa-users, fa-microphone, fa-handshake, fa-linkedin, fa-youtube, fa-x-twitter, fa-bluesky) is required by the spec.
- Files: `src/frontend/src/components/home/StatIcon.tsx`, `src/frontend/src/components/SocialIcons.tsx`
- Spec: `docs/design-system.md` §5 Iconographie; `SUIVI-LOT-1.md` task 1.6

**~~HIGH-03~~ — SUPPRIMÉ (erreur d'analyse)**
> **Note (revue du 05/04/2026)** : le composant `RichTextEditor` est bien utilisé dans l'éditeur d'articles (`admin/articles/[id]/page.tsx` lignes 227 et 232). TipTap est fonctionnel. Ce point est résolu.

**HIGH-04 — Billetweb API import for ticket tiers not implemented**
Spec RG-145, RG-146 require automatic import of ticket tiers from the Billetweb API. The `SUIVI-LOT-1.md` notes this as TODO. Currently all ticket tiers must be created manually in the admin. The Billetweb API key is referenced in environment variables docs but no import route exists in the backend.
- Files: `src/backend/src/routes/admin/tickets.ts`
- Spec: `docs/specs/lot-1-fondations.md` RG-145, RG-146; `SUIVI-LOT-1.md` task 7.4

**HIGH-05 — Analytics / Real User Monitoring (RUM) not implemented**
Spec RG-148 and `docs/objectifs-techniques.md` §Monitoring require analytics tracking and Core Web Vitals monitoring in real conditions. No analytics tool is present in the frontend code.
> **Décision (revue du 05/04/2026)** : solution retenue = **Plausible Analytics** (self-hosted via Coolify). RGPD-friendly (pas de cookies), script < 1 KB, plugin Web Vitals disponible. Déployer Plausible dans Coolify puis intégrer le script dans le frontend.
- Files: `src/frontend/src/app/layout.tsx`, `src/frontend/src/app/[locale]/layout.tsx`
- Spec: `docs/objectifs-techniques.md` §Monitoring et observabilité; `docs/specs/lot-1-fondations.md` RG-148; `SUIVI-LOT-1.md` task 1.19

**HIGH-06 — Brotli/Gzip compression not configured**
Spec RG-005 requires Brotli compression (with Gzip fallback) on all textual responses. The `SUIVI-LOT-1.md` marks this as TODO ("config serveur/Coolify"). There is no compression configuration in either the Next.js config or the Fastify backend (`src/backend/src/index.ts`).
- Files: `src/backend/src/index.ts`, `src/frontend/next.config.ts`
- Spec: `docs/specs/lot-1-fondations.md` RG-005; `SUIVI-LOT-1.md` task 1.16

**HIGH-07 — Sitemap does not include article URLs**
The sitemap at `src/frontend/src/app/sitemap.ts` only includes 6 static routes. It does not fetch and include dynamic routes for articles (`/[locale]/actualites/[slug]`) or tag pages (`/[locale]/actualites/tag/[slug]`). Published articles are not discoverable by search engines via sitemap.
- Files: `src/frontend/src/app/sitemap.ts`
- Spec: `docs/specs/lot-1-fondations.md` RG-013; `docs/objectifs-techniques.md` §SEO

**HIGH-08 — `og:image`, `twitter:image` missing on most pages**
The root `layout.tsx` sets `twitter: { card: "summary_large_image" }` but does not set a default `og:image`. Most pages (billetterie, CFP, contact, code-de-conduite, mentions-legales) generate metadata without any image. The spec (RG-015, RG-016, RG-020) requires OG and Twitter images on all pages, minimum 1200x630px.
- Files: `src/frontend/src/app/[locale]/layout.tsx`, individual page metadata functions
- Spec: `docs/specs/lot-1-fondations.md` RG-015, RG-016, RG-020; `docs/objectifs-techniques.md` §Open Graph Protocol

### Medium Priority Issues

**MED-01 — Footer logo uses text placeholder instead of SVG logo**
The footer renders `<> DevFest / TOULOUSE` as text rather than the actual SVG logo. The design system (§1 Logo, §UI Kit §Footer) specifies the complete DevFest Toulouse logo SVG (333×150px). Logo assets are available in `docs/assets/Logo/`.
- Files: `src/frontend/src/components/Footer.tsx` (lines 46–50)
- Spec: `docs/design-system.md` §1 Brand Guidelines, §7 UI Kit Footer

**MED-02 — Sponsors section on homepage not implemented**
The homepage spec for ANNOUNCEMENT mode (RG-083) requires a sponsors section ("Ils soutiennent le #DevFestToulouse") with Platinum/Gold/other tier cards and a "Devenir Partenaire" CTA. The section is conditionally hidden pending Lot 2 data, which is acceptable, but the component itself does not exist even as a placeholder. The Croix occitane illustration is also missing.
- Files: `src/frontend/src/app/[locale]/page.tsx`, `src/frontend/src/components/home/`
- Spec: `docs/fonctionnalites-2026.md` §Page d'accueil §Partenaires; `docs/design-system.md` §Illustrations

**MED-03 — Speakers "featured" section on homepage not implemented**
The homepage (ANNOUNCEMENT mode) should display a "Speakers en vedette" grid (4–8 featured speakers). No `SponsorsSection` or `FeaturedSpeakersSection` component exists. This is gated on Lot 2 data but the conditional rendering logic should at minimum be prepared.
- Files: `src/frontend/src/app/[locale]/page.tsx`
- Spec: `docs/fonctionnalites-2026.md` §Page d'accueil §Speakers en vedette

**MED-04 — About section uses gradient placeholder instead of background image**
The `AboutSection` component hardcodes a CSS gradient instead of a real background image (as shown in Figma maquettes: image with overlay). The spec describes "image de fond avec overlay". No image management for this section exists.
- Files: `src/frontend/src/components/home/AboutSection.tsx` (lines 11–12)
- Spec: `docs/fonctionnalites-2026.md` §Page d'accueil §À propos; `docs/maquettes-figma.md`

**MED-05 — `previousStartDate` missing from Schema.org Event markup**
The homepage `buildEventJsonLd()` function generates an `Event` schema with most required fields. However, RG-017 explicitly requires `previousStartDate` (dates of past editions, to indicate the recurring nature of the event). The function does not fetch previous editions or include this property.
- Files: `src/frontend/src/app/[locale]/page.tsx` (lines 18–55)
- Spec: `docs/specs/lot-1-fondations.md` RG-017; `docs/objectifs-techniques.md` §Données structurées Schema.org

**MED-06 — `lang` attribute on root `<html>` is hardcoded to `"fr"`**
The root `app/layout.tsx` sets `lang="fr"` permanently. The localized layout at `app/[locale]/layout.tsx` does not override it. The spec (RG-033) requires the `lang` attribute to match the current page locale.
- Files: `src/frontend/src/app/layout.tsx` (line 16)
- Spec: `docs/specs/lot-1-fondations.md` RG-033

**MED-07 — Admin: EDITOR role cannot delete contact messages**
The spec states editors have read-only access to contact messages. However, the contact messages admin page (`admin/contact/messages/page.tsx`) shows a delete button for all authenticated users. The backend route `DELETE /contact/messages/:id` uses `requireAdminRole`, which correctly blocks editors. But the frontend shows the button regardless of role, creating a confusing UX (button visible but request will fail with 403).
- Files: `src/frontend/src/app/[locale]/admin/contact/messages/page.tsx`
- Spec: `docs/fonctionnalites-2026.md` §Matrice des droits

**MED-08 — Admin sidebar links hardcode `/fr/` locale**
All navigation items in `AdminSidebar` hardcode `/fr/admin/...` paths. An English-locale admin user navigating to `/en/admin/` will see the correct page but all sidebar links redirect to `/fr/admin/...`, breaking locale consistency.
- Files: `src/frontend/src/components/admin/AdminSidebar.tsx` (lines 19–27)
- Spec: `docs/specs/lot-1-fondations.md` RG-031

**MED-09 — No `offers` field in Schema.org Event**
RG-017 requires `offers` (billetterie) in the Event schema.org markup on the homepage. The `buildEventJsonLd()` function does not include ticket tiers as `offers` objects, even though ticket data is already fetched on the same page.
- Files: `src/frontend/src/app/[locale]/page.tsx` (lines 18–55)
- Spec: `docs/specs/lot-1-fondations.md` RG-017

### Low Priority Issues

**LOW-01 — Image upload for articles (admin) not implemented**
Articles can reference an `imageUrl` but editors must manually enter a URL. The `SUIVI-LOT-1.md` improvement backlog notes "Upload d'images pour les articles (actuellement URL manuelle)". An `ImagePickerDialog` component exists that uses the file manager, suggesting this was started. Integration with the article editor form is incomplete.
- Files: `src/frontend/src/app/[locale]/admin/articles/[id]/page.tsx`, `src/frontend/src/components/admin/ImagePickerDialog.tsx`
- Spec: `docs/specs/lot-1-fondations.md` RG-143

**LOW-02 — Admin: no "New Edition" button / creation flow**
The editions list page (`admin/editions/page.tsx`) and the `SUIVI-LOT-1.md` improvement backlog both note that creating a new edition from the admin is missing. Editions can only be created via `prisma/seed.ts` or direct database access.
- Files: `src/frontend/src/app/[locale]/admin/editions/page.tsx`
- Spec: `docs/fonctionnalites-2026.md` §Admin

**LOW-03 — Dashboard stats count all articles, not just published ones**
The dashboard shows `totalArticles` by fetching total from the admin API with no status filter. The spec implies editorial stats should surface meaningful metrics (published vs. draft). Currently the count includes drafts.
- Files: `src/frontend/src/app/[locale]/admin/page.tsx` (line 52)
- Spec: `docs/fonctionnalites-2026.md` §Dashboard — statistiques globales

**LOW-04 — Breadcrumb Schema.org markup not verified for all pages**
Spec RG-019 requires BreadcrumbList structured data on all interior pages. The `Breadcrumb` component generates an `<ol>` but no `application/ld+json` script tag for Schema.org. The article detail page (`actualites/[slug]/page.tsx`) does include Article schema.org, but the breadcrumb schema is missing everywhere.
- Files: `src/frontend/src/components/Breadcrumb.tsx`
- Spec: `docs/specs/lot-1-fondations.md` RG-019

**LOW-05 — Bleu color token value differs from design system spec**
The design system specifies the primary blue CTA color as `#507BBD`. The `globals.css` defines `--color-bleu: #476DAB`, which is slightly darker. This is a minor deviation but affects button, border, and link colors across the entire site.
- Files: `src/frontend/src/app/globals.css` (line 20)
- Spec: `docs/design-system.md` §2 Couleurs secondaires (Bleu: `#507BBD`)

### Discrepancy Categories

| Category | Count |
|----------|-------|
| Missing features | 12 |
| Incomplete implementations | 6 |
| Incorrect implementations | 2 |
| Data model gaps | 1 |
| Documentation/Spec gaps | 0 |

---

## PART 4: Prioritized Task List

### Critical Tasks

#### TASK-001: Implement PREPARATION and SEE_YOU_NEXT_YEAR homepage modes
**Severity**: Critical
**Category**: Missing feature
**Impact**: Entire homepage logic incomplete. Without these modes, the site cannot transition to post-event state or pre-announcement teasing mode. Affects homepage rendering for 2 of 3 edition statuses.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-082, RG-084
- Requirement: "En mode PREPARATION: hero teasing, newsletter, réseaux sociaux, replay édition précédente. En mode SEE_YOU_NEXT_YEAR: bilan, aftermovie, galerie photos, replays, lien éditions précédentes."

**Current State**:
The homepage at `src/frontend/src/app/[locale]/page.tsx` checks `isAnnouncement = edition?.status === "ANNOUNCEMENT"` and wraps all conditional sections with this flag. If status is `PREPARATION` or `SEE_YOU_NEXT_YEAR`, only the `HeroSection` renders (with a placeholder image since `heroImageUrl` may be null in prep mode).

**Required Changes**:
- File: `src/frontend/src/app/[locale]/page.tsx`
  - Add `isPreparation` and `isSeeYouNextYear` flags
  - Render `PreparationSection` (teasing content + newsletter placeholder + social links + replay if available) for `PREPARATION`
  - Render `PostEventSection` (bilan + aftermovie + gallery link + replay + previous editions links) for `SEE_YOU_NEXT_YEAR`
- File: `src/frontend/src/components/home/` — create `PreparationSection.tsx` and `PostEventSection.tsx` components

**Ready-to-Use Prompt**:
```
Implement the two missing homepage modes for the DevFest Toulouse 2026 site.

Currently, `src/frontend/src/app/[locale]/page.tsx` only handles the ANNOUNCEMENT status. Add support for:

1. PREPARATION mode (RG-082): display a teasing hero (same HeroSection component, no key figures or sponsors), social media links, and the replay from the previous edition if `aftermovieUrl` is set. No ticketing, no speakers, no news sections.

2. SEE_YOU_NEXT_YEAR mode (RG-084): display a bilan/summary section, the aftermovie (ReplaySection), a link to the gallery (`edition.galleryUrl`), a link to previous editions, and the latest news articles (optional). No ticketing or CFP CTAs.

Create the necessary components in `src/frontend/src/components/home/`. Follow the existing component patterns (use `useTranslations`, accept locale as prop). Add the new translation keys to `src/frontend/messages/fr.json` and `src/frontend/messages/en.json`. Consult the spec at `docs/fonctionnalites-2026.md` (§Page d'accueil) and `docs/objectifs-techniques.md` (§Contenu conditionnel) for content details.
```

**Verification Criteria**:
- [ ] Setting edition status to PREPARATION in admin shows teasing content only
- [ ] Setting edition status to SEE_YOU_NEXT_YEAR shows post-event content
- [ ] No console errors in all three modes
- [ ] Translations present in both FR and EN

---

#### TASK-002: Add s-maxage Cache-Control headers on public pages
**Severity**: Critical
**Category**: Missing feature
**Impact**: Without HTTP cache headers, CDN/Traefik cannot cache pages at the edge. The ISR `revalidate` option in `fetchAPI()` only instructs Next.js's internal cache, not upstream CDN caches. This negates the performance and scalability benefits specified.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-002, RG-003
- Requirement: "Cache-Control: s-maxage=3600, stale-while-revalidate=60" on all public pages; homepage gets s-maxage=300.

**Current State**:
`next.config.ts` sets security headers on `/:path*` but no `Cache-Control` header. The `fetchAPI()` uses `{ next: { revalidate: 3600 } }` for Next.js ISR only.

**Required Changes**:
- File: `src/frontend/next.config.ts`
  - Add a `headers()` entry for public pages setting `Cache-Control: s-maxage=3600, stale-while-revalidate=60`
  - Add a separate entry for `/(fr|en)` (homepage) setting `Cache-Control: s-maxage=300, stale-while-revalidate=60`
  - Exclude admin routes (`/fr/admin/:path*`, `/en/admin/:path*`) from caching

**Ready-to-Use Prompt**:
```
Add HTTP Cache-Control headers to the Next.js frontend configuration to comply with specs RG-002 and RG-003 in `docs/specs/lot-1-fondations.md`.

In `src/frontend/next.config.ts`, add new entries in the `headers()` function:
- Source `/(fr|en)` (homepage only): `Cache-Control: s-maxage=300, stale-while-revalidate=60`
- Source `/(fr|en)/:path+` (all other public pages): `Cache-Control: s-maxage=3600, stale-while-revalidate=60`
- Admin routes (`/(fr|en)/admin/:path*`) should NOT be cached: `Cache-Control: no-store`

These headers work in combination with the existing `next: { revalidate }` in `fetchAPI()` — the ISR handles Next.js internal cache, the Cache-Control headers handle CDN/Traefik/Coolify edge caching.
```

**Verification Criteria**:
- [ ] `curl -I https://devfesttoulouse.fr/fr/` returns `Cache-Control: s-maxage=300, stale-while-revalidate=60`
- [ ] `curl -I https://devfesttoulouse.fr/fr/actualites` returns `Cache-Control: s-maxage=3600, stale-while-revalidate=60`
- [ ] Admin pages return `Cache-Control: no-store`

---

#### TASK-003: Add Speaker, Session, Sponsor, Venue, Room models to Prisma schema
**Severity**: ~~Critical~~ → **Lot 2** (reclassé le 05/04/2026)
**Category**: Missing feature — Lot 2 scope
**Impact**: ~~Blocks the entire Lot 2 scope.~~ Non bloquant V1 : les onglets admin sont en placeholder, les liens du header sont masqués. À traiter dans le Lot 2 (deadline 19 juin 2026).

**Specification Reference**:
- Document: `docs/modele-donnees-metier.md`
- Section: §Speaker, §Session, §Sponsor, §Lieu, §Salle, §Créneau horaire, §Niveau de sponsoring
- Requirement: Full entity definitions with all fields and relations

**Current State**:
`prisma/schema.prisma` has no Speaker, Session, Sponsor, Venue, Room, TimeSlot, or SponsorshipLevel models. The UserRole enum only has ADMIN and EDITOR (missing SPEAKER and SPONSOR).

**Required Changes**:
- File: `prisma/schema.prisma` — add models: `Speaker`, `Session`, `Sponsor`, `SponsorshipLevel`, `Category`, `Venue`, `Room`, `TimeSlot`, social link models; add SPEAKER and SPONSOR to UserRole enum; add relations to Edition model
- File: `prisma/migrations/` — generate migration
- File: `src/backend/src/routes/admin/` — create routes for speakers, sessions, sponsors

**Ready-to-Use Prompt**:
```
Implement the Lot 2 data model by extending the Prisma schema with the entities defined in `docs/modele-donnees-metier.md`.

In `prisma/schema.prisma`, add:
1. `Speaker` model: name, photo (imageUrl), company, city, bioFr, bioEn, isFeatured, socialLinks relation, sessions relation, sponsorId (optional link to Sponsor)
2. `Session` model: titleFr, titleEn, descriptionFr, descriptionEn, format (CONFERENCE/QUICKIE/KEYNOTE enum), level (BEGINNER/INTERMEDIATE/ADVANCED enum), language (FR/EN enum), categoryId, roomId, timeSlotId, replayUrl, slidesUrl, speakers relation (N:M), publicationStatus
3. `Sponsor` model: name, logoUrl, websiteUrl, descriptionFr, descriptionEn, sponsorshipLevelId, socialLinks relation, speakers relation, publicationStatus
4. `SponsorshipLevel` model: name, color (#hex), sortOrder, editionId
5. `Category` model: nameFr, nameEn, color, editionId
6. `Venue` model: nameFr, nameEn, address, lat, lng, itineraryUrl; rooms relation
7. `Room` model: name, capacity (optional), sortOrder, venueId
8. `TimeSlot` model: startTime, endTime, day (optional for multi-day events), editionId
9. `SocialLink` model: type (TWITTER/LINKEDIN/GITHUB/BLUESKY/WEBSITE enum), url, speakerId (optional), sponsorId (optional), teamMemberId (optional)
10. Add SPEAKER and SPONSOR to the `UserRole` enum
11. Add relations from Edition to Sponsor, Category, SponsorshipLevel, TimeSlot, Venue

Also update `prisma/seed.ts` to include sample data for these entities. Run `prisma migrate dev` to generate the migration. Consult `docs/modele-donnees-metier.md` for the complete field list and `docs/specs/lot-2-speakers-sponsors.md` for business rules.
```

**Verification Criteria**:
- [ ] `prisma migrate dev` succeeds without errors
- [ ] All new models accessible via Prisma client
- [ ] Edition model properly relates to all new models
- [ ] UserRole enum includes SPEAKER and SPONSOR

---

### High Priority Tasks

#### TASK-004: Implement language suggestion banner (browser language detection)
**Severity**: High
**Category**: Missing feature
**Impact**: Users whose browser language is English visiting `/fr/` will see no suggestion to switch. This degrades the bilingual UX and violates RG-036–038.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-036, RG-037, RG-038
- Requirement: "La détection de la langue du navigateur est utilisée pour suggérer un changement de langue (bannière non bloquante), sans redirection automatique. Le choix de l'utilisateur est mémorisé (localStorage)."

**Current State**:
`LanguageSwitcher.tsx` provides a toggle button but no auto-detection. `SUIVI-LOT-1.md` Phase 2.3 marked as PARTIAL.

**Required Changes**:
- File: `src/frontend/src/components/` — create `LanguageSuggestionBanner.tsx` client component
  - Reads `navigator.language` on mount
  - Compares to current locale
  - Shows dismissible banner if mismatch
  - Stores dismissal in localStorage
- File: `src/frontend/src/app/[locale]/layout.tsx` — render `LanguageSuggestionBanner`
- File: `src/frontend/messages/fr.json` and `en.json` — add banner translation keys

**Ready-to-Use Prompt**:
```
Implement a non-blocking language suggestion banner per specs RG-036, RG-037, RG-038 in `docs/specs/lot-1-fondations.md`.

Create `src/frontend/src/components/LanguageSuggestionBanner.tsx` as a client component that:
1. On mount, reads `navigator.language` (or `navigator.languages[0]`) and compares to the current next-intl locale
2. If the browser language is "en" and the current locale is "fr" (or vice versa), shows a sticky non-blocking banner at the top of the page
3. The banner has a "Switch to [EN/FR]" link using the next-intl `Link` component with the alternate locale, and a dismiss button (X)
4. Stores the dismissal decision in `localStorage` under key `"lang-banner-dismissed"` so it never shows again after dismissal
5. Does NOT redirect automatically — only suggests

Add the banner to `src/frontend/src/app/[locale]/layout.tsx` just after the skip-to-content link. Add translation strings for the banner in both `fr.json` and `en.json` (translation key: `lang.suggestion`).
```

**Verification Criteria**:
- [ ] Banner appears when browser language differs from page locale
- [ ] Banner disappears after clicking X and does not reappear on reload
- [ ] No banner shown when browser language matches page locale
- [ ] Switch link navigates to correct alternate locale

---

#### TASK-005: Install and configure Font Awesome
**Severity**: High
**Category**: Missing feature
**Impact**: Stats icons (calendar, users, microphone, handshake) and social network icons (LinkedIn, YouTube, X, Bluesky) are not rendered with the specified Font Awesome icons. Current inline SVGs are ad-hoc.

**Specification Reference**:
- Document: `docs/design-system.md`
- Section: §5 Iconographie
- Requirement: Font Awesome free plan — fa-calendar-days, fa-users, fa-microphone, fa-handshake, fa-linkedin, fa-youtube, fa-x-twitter, fa-bluesky

**Current State**:
`StatIcon.tsx` uses custom inline SVGs. `SocialIcons.tsx` uses custom inline SVGs. `SUIVI-LOT-1.md` task 1.6 is TODO.

**Required Changes**:
- Install `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/free-brands-svg-icons`, `@fortawesome/react-fontawesome`
- File: `src/frontend/src/components/home/StatIcon.tsx` — replace SVGs with Font Awesome icons
- File: `src/frontend/src/components/SocialIcons.tsx` — replace SVGs with Font Awesome brand icons

**Ready-to-Use Prompt**:
```
Install Font Awesome and replace the custom SVG icons with the specified Font Awesome icons per `docs/design-system.md` §5.

First use Context7 MCP to fetch the latest Font Awesome React documentation. Then:

1. In `src/frontend/`, install: `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/free-brands-svg-icons`, `@fortawesome/react-fontawesome` using pnpm.

2. Update `src/frontend/src/components/home/StatIcon.tsx` to render Font Awesome icons based on the `name` prop:
   - "calendar" → `faCalendarDays` (solid)
   - "users" → `faUsers` (solid)
   - "microphone" → `faMicrophone` (solid)
   - "handshake" → `faHandshake` (solid)

3. Update `src/frontend/src/components/SocialIcons.tsx` to use Font Awesome brand icons:
   - LinkedIn → `faLinkedin` (brands)
   - YouTube → `faYoutube` (brands)
   - X/Twitter → `faXTwitter` (brands)
   - Bluesky → `faBluesky` (brands)

Maintain the existing `size` and `className` props interface. Do not add Font Awesome CSS CDN — use the SVG core package only to avoid render-blocking requests.
```

**Verification Criteria**:
- [ ] Stats section shows correct FA icons (calendar, users, microphone, handshake)
- [ ] Header and footer social icons use FA brand icons
- [ ] No Font Awesome CSS CDN loaded (SVG core only)
- [ ] Icons are accessible (aria-hidden where decorative)

---

#### ~~TASK-006~~ — SUPPRIMÉ (erreur d'analyse)
> **Note (revue du 05/04/2026)** : TipTap est déjà intégré et fonctionnel via le composant `RichTextEditor`, utilisé dans l'éditeur d'articles (`admin/articles/[id]/page.tsx` lignes 227 et 232). Ce point est résolu.

---

#### TASK-007: Add article URLs to sitemap
**Severity**: High
**Category**: Incomplete implementation
**Impact**: Published articles are invisible to search engine sitemaps, limiting SEO discoverability.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-013
- Requirement: "Un sitemap XML est généré automatiquement et inclut toutes les pages publiques (FR et EN)."

**Current State**:
`src/frontend/src/app/sitemap.ts` only generates entries for 6 static routes. No dynamic article or tag routes are included.

**Required Changes**:
- File: `src/frontend/src/app/sitemap.ts` — fetch published articles from backend API and add dynamic entries for `/fr/actualites/[slug]`, `/en/actualites/[slug]`, and tag pages

**Ready-to-Use Prompt**:
```
Extend the sitemap to include dynamic article and tag URLs per spec RG-013.

In `src/frontend/src/app/sitemap.ts`:
1. Import the `getArticles` and `getTags` functions from `@/lib/api` (or call the backend API directly)
2. Fetch all published articles (use a high limit, e.g. 500)
3. For each article, add entries for both `/fr/actualites/[slug]` and `/en/actualites/[slug]` with `changeFrequency: "monthly"` and `priority: 0.6`
4. Fetch all tags from `/api/tags`
5. For each tag, add entries for both `/fr/actualites/tag/[slug]` and `/en/actualites/tag/[slug]` with `changeFrequency: "weekly"` and `priority: 0.5`
6. Set `lastModified` to the article's `publishedAt` date for articles, and `new Date()` for tags

Ensure the sitemap function is marked as `async` and handles API errors gracefully (return empty array on failure).
```

**Verification Criteria**:
- [ ] `/sitemap.xml` includes at least one article URL
- [ ] Both FR and EN article URLs present with correct `hreflang` alternates
- [ ] Tag URLs included
- [ ] Sitemap validates with Google Rich Results Test

---

#### TASK-008: Add default og:image and twitter:image to global metadata
**Severity**: High
**Category**: Incomplete implementation
**Impact**: Social shares of pages without images show no preview card, degrading click-through rates for all shared pages.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-015, RG-016, RG-020
- Requirement: "Balises Open Graph og:image et Twitter twitter:image sur toutes les pages. Dimensions minimales 1200x630px."

**Current State**:
Root `layout.tsx` sets `twitter: { card: "summary_large_image" }` but no `images` in `openGraph`. Individual pages like billetterie, CFP, contact, CoC do not set any image metadata.

**Required Changes**:
- File: `src/frontend/src/app/[locale]/layout.tsx` — add a default `og:image` pointing to a static OG image asset
- Create a default OG image at 1200x630px (static PNG or dynamically generated)
- File: `src/frontend/public/` — add `og-image.jpg` (1200x630px) as default fallback

**Ready-to-Use Prompt**:
```
Add a default Open Graph and Twitter Card image to the global metadata, complying with specs RG-015, RG-016, RG-020.

1. Create a default OG image: place a 1200x630px PNG/JPG at `src/frontend/public/images/og-default.jpg`. The image should use the DevFest Toulouse branding (the existing hero photo or a branded static image).

2. In `src/frontend/src/app/[locale]/layout.tsx`, update `generateMetadata()` to include:
   - `openGraph.images: [{ url: '/images/og-default.jpg', width: 1200, height: 630 }]`
   - `twitter.images: ['/images/og-default.jpg']`
   
3. Ensure the BASE_URL is prepended to make the image URL absolute (required by Open Graph).

4. The article detail page already sets `og:image` from `article.imageUrl` — this override should not break that behavior (per-page openGraph overwrites the default from layout).

Do not generate dynamic OG images for now — a static default is sufficient for Lot 1.
```

**Verification Criteria**:
- [ ] `og:image` meta tag present on all pages
- [ ] `twitter:image` meta tag present on all pages
- [ ] Image URL is absolute (https://)
- [ ] Image is 1200x630px minimum

---

#### TASK-009: Implement Brotli/Gzip compression on backend
**Severity**: High
**Category**: Missing feature
**Impact**: All API responses and assets served without compression, increasing transfer size and degrading performance metrics.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-005
- Requirement: "La compression Brotli est activée en priorité, avec fallback sur Gzip."

**Current State**:
`src/backend/src/index.ts` does not register `@fastify/compress`. `SUIVI-LOT-1.md` task 1.16 is marked TODO with "config serveur/Coolify" note.

**Required Changes**:
- File: `src/backend/package.json` — add `@fastify/compress`
- File: `src/backend/src/index.ts` — register `@fastify/compress` plugin with Brotli priority

**Ready-to-Use Prompt**:
```
Enable Brotli/Gzip compression on the Fastify backend per spec RG-005.

Use Context7 MCP to fetch the latest @fastify/compress documentation. Then:

1. In `src/backend/`, install: `@fastify/compress` using pnpm.

2. In `src/backend/src/index.ts`, register the plugin early (before routes):
   ```typescript
   import compress from '@fastify/compress';
   await app.register(compress, { global: true, encodings: ['br', 'gzip', 'deflate'] });
   ```

3. Verify that the plugin is registered before route handlers to ensure all responses are compressed.

4. Add a simple test to `src/backend/src/__tests__/` that checks the Content-Encoding header on a known API response.
```

**Verification Criteria**:
- [ ] API responses include `Content-Encoding: br` or `Content-Encoding: gzip`
- [ ] No compression errors in server logs

---

#### TASK-010: Implement analytics / Real User Monitoring with Plausible
**Severity**: High
**Category**: Missing feature
**Impact**: No visibility into real-world performance (Core Web Vitals, page views, user flows). Cannot validate production Lighthouse targets.
**Solution retenue**: **Plausible Analytics** (self-hosted via Coolify)

**Specification Reference**:
- Document: `docs/objectifs-techniques.md`
- Section: §Monitoring et observabilité
- Requirement: "Analytics: mesure des visites, pages vues, parcours utilisateur. Suivi des Core Web Vitals en conditions réelles (RUM)."

**Current State**:
No analytics or RUM tool installed. `SUIVI-LOT-1.md` task 1.19 is marked TODO.

**Why Plausible**:
- Open source (AGPL), self-hostable
- Template Coolify disponible (déploiement 1 clic)
- Script < 1 KB, pas d'impact sur les Core Web Vitals
- RGPD-friendly : pas de cookies, pas de bannière de consentement requise
- Plugin Web Vitals disponible pour monitorer LCP/CLS/INP

**Required Changes**:
1. **Infra** : déployer Plausible dans Coolify via le template one-click (PostgreSQL + ClickHouse inclus)
2. **Env** : ajouter `NEXT_PUBLIC_PLAUSIBLE_URL` (URL de l'instance Plausible) et `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (domaine du site à tracker) aux variables d'environnement
3. **Frontend** : intégrer le script Plausible dans le layout

**Ready-to-Use Prompt**:
```
Integrate Plausible Analytics into the DevFest Toulouse 2026 frontend.

Prerequisites: Plausible is already deployed and accessible at the URL in NEXT_PUBLIC_PLAUSIBLE_URL env var.

1. In `src/frontend/`, install: `next-plausible` using pnpm. Use Context7 MCP to fetch the latest next-plausible documentation.

2. In `src/frontend/src/app/[locale]/layout.tsx`, add the PlausibleProvider from next-plausible:
   - domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "devfesttoulouse.fr"
   - customDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_URL (the self-hosted instance URL)
   - selfHosted: true
   - enabled: true (in production only, disable in dev)

3. Add the environment variables to `docs/variables-environnement.md`:
   - NEXT_PUBLIC_PLAUSIBLE_URL: URL of the self-hosted Plausible instance
   - NEXT_PUBLIC_PLAUSIBLE_DOMAIN: domain to track (e.g. devfesttoulouse.fr)

4. Update the CSP in `src/frontend/next.config.ts` to allow the Plausible script:
   - Add the Plausible instance URL to `script-src` and `connect-src`

5. Optionally enable the Plausible Web Vitals plugin (pageview-props extension) for LCP/CLS/INP tracking.
```

**Verification Criteria**:
- [ ] Plausible script loaded on production pages (check view-source)
- [ ] Page views tracked in Plausible dashboard
- [ ] No cookie consent banner required
- [ ] No impact on Lighthouse performance score (script < 1 KB)
- [ ] CSP does not block the Plausible script

---

### Medium Priority Tasks

#### TASK-011: Fix hardcoded `lang="fr"` on root HTML element
**Severity**: Medium
**Category**: Incorrect implementation
**Impact**: Screen readers on English pages announce the page as French, violating WCAG 2.1 AA (criterion 3.1.1 Language of Page).

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-033
- Requirement: "L'attribut lang sur <html> correspond à la langue de la page (fr ou en)."

**Current State**:
`src/frontend/src/app/layout.tsx` sets `<html lang="fr">` permanently. The locale is not propagated to the root layout.

**Required Changes**:
- File: `src/frontend/src/app/layout.tsx` — make the `lang` attribute dynamic based on locale, using `getLocale()` or by restructuring layout hierarchy

**Ready-to-Use Prompt**:
```
Fix the hardcoded `lang="fr"` attribute on the root HTML element to dynamically reflect the current page locale, per spec RG-033.

In Next.js App Router with next-intl, the root `app/layout.tsx` does not have access to the locale directly. There are two approaches:

Option A (recommended): Move the `<html>` and `<body>` tags into `src/frontend/src/app/[locale]/layout.tsx` using a `generateStaticParams` approach, and make `app/layout.tsx` a minimal wrapper without html/body tags.

Option B: Use `getLocale()` from `next-intl/server` in `app/layout.tsx` — but this requires next-intl to be configured to work at the root layout level.

Consult the next-intl and Next.js App Router documentation via Context7 MCP to determine the correct approach for the current project setup. Ensure that the `lang` attribute on `<html>` is `"fr"` on all `/fr/...` routes and `"en"` on all `/en/...` routes.

After fixing, verify with the browser inspector and with an accessibility audit that the `lang` attribute is correct.
```

**Verification Criteria**:
- [ ] `/fr/` pages have `<html lang="fr">`
- [ ] `/en/` pages have `<html lang="en">`
- [ ] axe-core reports no "html-has-lang" violation on English pages

---

#### TASK-012: Replace footer text logo with actual SVG logo
**Severity**: Medium
**Category**: Incorrect implementation
**Impact**: Footer displays text `<> DevFest / TOULOUSE` instead of the branded SVG logo, violating brand guidelines.

**Specification Reference**:
- Document: `docs/design-system.md`
- Section: §1 Logo, §7 UI Kit Footer
- Requirement: "Footer: logo complet DevFest Toulouse (333×150px)"

**Current State**:
`src/frontend/src/components/Footer.tsx` lines 46–50 render a text placeholder. SVG logo assets are available in `docs/assets/Logo/Principal/RVB/svg/`.

**Required Changes**:
- Copy the appropriate logo SVG (White Dark Mode or Brique) to `src/frontend/public/images/`
- File: `src/frontend/src/components/Footer.tsx` — replace text with `<Image>` component pointing to the logo SVG/PNG

**Ready-to-Use Prompt**:
```
Replace the text placeholder in the footer with the actual DevFest Toulouse logo per `docs/design-system.md` §7 UI Kit Footer.

1. Copy the White Dark Mode logo from `docs/assets/Logo/Principal/RVB/svg/` (or an appropriate variant) to `src/frontend/public/images/logo-devfest-footer.svg`. If SVG is not available, use the PNG equivalent.

2. In `src/frontend/src/components/Footer.tsx`, replace the text block (lines 46-50) with a Next.js `<Image>` component:
   - src: `/images/logo-devfest-footer.svg`
   - alt: "DevFest Toulouse"
   - width: 200 (proportional to 333×150px spec, scaled down for the footer)
   - height: 90

3. Ensure the image is visible on the green (#109E6E) footer background — use the White Dark Mode logo variant.
```

**Verification Criteria**:
- [ ] Footer shows actual logo image, not text
- [ ] Logo is visible on the malachite green background
- [ ] Alt text is meaningful

---

#### TASK-013: Add BreadcrumbList Schema.org markup to Breadcrumb component
**Severity**: Medium
**Category**: Incomplete implementation
**Impact**: Search engines cannot display breadcrumb trails in search results, reducing click-through rates on interior pages.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-019
- Requirement: "Un fil d'Ariane (breadcrumb) avec balisage structuré Schema.org BreadcrumbList est présent sur toutes les pages sauf l'accueil."

**Current State**:
`src/frontend/src/components/Breadcrumb.tsx` renders a visual `<ol>` but no `<script type="application/ld+json">` for Schema.org.

**Required Changes**:
- File: `src/frontend/src/components/Breadcrumb.tsx` — add a `<script>` tag rendering BreadcrumbList JSON-LD alongside the visual breadcrumb

**Ready-to-Use Prompt**:
```
Add Schema.org BreadcrumbList JSON-LD markup to the Breadcrumb component per spec RG-019.

In `src/frontend/src/components/Breadcrumb.tsx`, after the visual `<nav>` element, add a `<script type="application/ld+json">` tag that renders a BreadcrumbList schema:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://devfesttoulouse.fr/fr"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[page title]",
      "item": "https://devfesttoulouse.fr/fr/[path]"
    }
  ]
}
```

The component already receives an `items` prop with `{ label, href }` objects — use these to build the `itemListElement` array dynamically. Use `process.env.BASE_URL` or a constant for the base URL prefix. Use `dangerouslySetInnerHTML` for the JSON-LD script tag.
```

**Verification Criteria**:
- [ ] Google Rich Results Test detects BreadcrumbList on article page
- [ ] No validation errors in Rich Results Test
- [ ] Schema present on all pages using the Breadcrumb component

---

#### TASK-014: Fix admin sidebar locale hardcoding
**Severity**: Medium
**Category**: Incorrect implementation
**Impact**: Admin users on `/en/admin/` see navigation links pointing to `/fr/admin/...`, causing locale inconsistency.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-031
- Requirement: "Toutes les URLs sont préfixées par la langue."

**Current State**:
`src/frontend/src/components/admin/AdminSidebar.tsx` lines 19–27 hardcode `/fr/admin/...` for all nav items.

**Required Changes**:
- File: `src/frontend/src/components/admin/AdminSidebar.tsx` — use `useLocale()` to build locale-aware paths

**Ready-to-Use Prompt**:
```
Fix the admin sidebar to use locale-aware paths instead of hardcoded `/fr/admin/...` paths.

In `src/frontend/src/components/admin/AdminSidebar.tsx`:
1. Add `import { useLocale } from 'next-intl'` at the top
2. Call `const locale = useLocale()` inside the component
3. Change the `navItems` from a module-level constant to a function that takes `locale` as parameter, returning items with `href: /${locale}/admin/...` paths
4. Update `isActive` checks to use `pathname.startsWith(item.href)` with the locale-aware href

Alternatively, use the next-intl `Link` component with `href="/admin"` (without locale prefix) and let next-intl handle the locale injection automatically.
```

**Verification Criteria**:
- [ ] Admin on `/en/admin/` sees sidebar links pointing to `/en/admin/...`
- [ ] Active state correctly highlights the current page

---

#### TASK-015: Add `previousStartDate` and `offers` to Schema.org Event
**Severity**: Medium
**Category**: Incomplete implementation
**Impact**: Event schema is not fully enriched per spec, reducing structured data quality for search engines.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-017
- Requirement: "previousStartDate (éditions passées), offers (billetterie)."

**Current State**:
`buildEventJsonLd()` in `src/frontend/src/app/[locale]/page.tsx` omits `previousStartDate` and `offers`.

**Required Changes**:
- File: `src/frontend/src/app/[locale]/page.tsx`
  - Pass `editions` (previous editions with `startDate`) to `buildEventJsonLd()`
  - Pass `tiers` (ticket tiers) to build `offers` array
  - Extend `buildEventJsonLd()` to include both

**Ready-to-Use Prompt**:
```
Extend the Schema.org Event JSON-LD on the homepage to include `previousStartDate` and `offers` per spec RG-017.

In `src/frontend/src/app/[locale]/page.tsx`:

1. Fetch previous editions: use `getEditions()` (already imported in the Footer) and filter for editions with a startDate that are before the current edition's year.

2. Update `buildEventJsonLd()` to accept `previousEditions` and `tiers` parameters.

3. Add `previousStartDate` as an array of ISO date strings from past editions' `startDate` values.

4. Add `offers` as an array of `Offer` schema objects from ticket tiers:
   ```json
   {
     "@type": "Offer",
     "name": "Blind Bird",
     "price": "40",
     "priceCurrency": "EUR",
     "availability": "https://schema.org/InStock",
     "url": "https://billetweb.fr/..."
   }
   ```
   Map `AVAILABLE` status to `InStock`, `SOLD_OUT` to `SoldOut`, `COMING_SOON` to `PreOrder`.

5. Validate the result with Google's Rich Results Test.
```

**Verification Criteria**:
- [ ] `previousStartDate` array present in JSON-LD
- [ ] `offers` array present with correct Offer schema objects
- [ ] Google Rich Results Test shows no errors

---

### Low Priority Tasks

#### TASK-016: Wire up image upload in article editor
**Severity**: Low
**Category**: Incomplete implementation
**Impact**: Editors cannot upload images directly; must host images externally and paste URLs manually.

**Specification Reference**:
- Document: `docs/specs/lot-1-fondations.md`
- Section: RG-143
- Requirement: "éditeur WYSIWYG permettant... l'ajout de photos."

**Current State**:
An `ImagePickerDialog` component and a `/api/admin/images` backend route exist. The article editor does not use `ImagePickerDialog` for the `imageUrl` field or within the TipTap content.

**Required Changes**:
- File: `src/frontend/src/app/[locale]/admin/articles/[id]/page.tsx` — integrate `ImagePickerDialog` for the featured image field
- File: `src/frontend/src/components/admin/RichTextEditor.tsx` — add image insertion via `ImagePickerDialog` within TipTap

**Ready-to-Use Prompt**:
```
Wire up the ImagePickerDialog for article image management in the admin.

In `src/frontend/src/app/[locale]/admin/articles/[id]/page.tsx`:
1. For the `imageUrl` field, add a button "Choisir une image" that opens `ImagePickerDialog`
2. When an image is selected, set `form.imageUrl` to the selected image URL
3. Show a preview thumbnail of the currently selected image

In `src/frontend/src/components/admin/RichTextEditor.tsx` (after completing TASK-006):
1. Add an "Image" button to the TipTap toolbar
2. When clicked, open `ImagePickerDialog`
3. On image selection, insert the image into the TipTap editor at the cursor position using `editor.chain().focus().setImage({ src: url }).run()`
```

**Verification Criteria**:
- [ ] Article editor allows selecting a featured image from the file manager
- [ ] Selected image URL is saved with the article
- [ ] Images can be inserted inline in article content

---

#### TASK-017: Add "New Edition" button to admin editions list
**Severity**: Low
**Category**: Missing feature
**Impact**: New editions cannot be created from the admin UI; requires direct database access.

**Specification Reference**:
- Document: `docs/fonctionnalites-2026.md`
- Section: §Admin
- Requirement: "Gestion des sessions, speakers, sponsors, articles"

**Current State**:
`src/frontend/src/app/[locale]/admin/editions/page.tsx` lists editions but has no creation flow. `SUIVI-LOT-1.md` improvement backlog notes this gap.

**Required Changes**:
- File: `src/frontend/src/app/[locale]/admin/editions/page.tsx` — add "Nouvelle édition" button and creation form (year field minimum)
- File: `src/backend/src/routes/admin/editions.ts` — verify POST endpoint exists for creating editions

**Ready-to-Use Prompt**:
```
Add an edition creation flow to the admin editions page.

In `src/frontend/src/app/[locale]/admin/editions/page.tsx`:
1. Add a "Nouvelle édition" button in the page header
2. Show an inline form (or modal) when clicked, with fields: Année (number, required), Date de début (date, optional), Statut (select: PREPARATION/ANNOUNCEMENT/SEE_YOU_NEXT_YEAR)
3. On submit, call `POST /api/admin/editions` with the form data
4. On success, navigate to the new edition's detail page

In `src/backend/src/routes/admin/editions.ts`, verify that a POST endpoint exists. If not, add:
- `POST /editions`: creates a new edition with `year` (required), `startDate`, `status`, validates that the year does not already exist (409 conflict)
```

**Verification Criteria**:
- [ ] "Nouvelle édition" button visible in editions list
- [ ] Form validates year uniqueness
- [ ] On success, redirects to new edition detail page

---

#### TASK-018: Fix bleu color token to match design system spec
**Severity**: Low
**Category**: Incorrect implementation
**Impact**: Minor visual deviation from Figma maquettes. Button and link colors are slightly darker than specified.

**Specification Reference**:
- Document: `docs/design-system.md`
- Section: §2 Couleurs secondaires
- Requirement: "Bleu: #507BBD — Boutons CTA principaux"

**Current State**:
`src/frontend/src/app/globals.css` line 20: `--color-bleu: #476DAB` instead of `#507BBD`.

**Required Changes**:
- File: `src/frontend/src/app/globals.css` — change `--color-bleu` from `#476DAB` to `#507BBD`

**Ready-to-Use Prompt**:
```
Fix the bleu color token in `src/frontend/src/app/globals.css` to match the design system specification.

Change line 20 from:
  --color-bleu: #476DAB;
To:
  --color-bleu: #507BBD;

After this change, verify that button and border colors across the site still pass WCAG AA contrast ratios (the Lighthouse accessibility audit should remain at score ≥ 90). The color #507BBD against white (#FFFFFF) has a contrast ratio of approximately 3.0:1, which meets the 3:1 threshold for large text and UI components but NOT the 4.5:1 threshold for small text. If contrast issues arise, adjust the specific text uses rather than reverting the token.
```

**Verification Criteria**:
- [ ] `--color-bleu` is `#507BBD` in globals.css
- [ ] Lighthouse accessibility score remains ≥ 90
- [ ] Button appearance matches Figma maquettes

---

#### TASK-019: Add `offers` display on Schema.org, fix dashboard article count
**Severity**: Low
**Category**: Incorrect implementation
**Impact**: Dashboard shows total article count including drafts, which is potentially misleading for editors.

**Specification Reference**:
- Document: `docs/fonctionnalites-2026.md`
- Section: §Dashboard — statistiques globales

**Current State**:
`src/frontend/src/app/[locale]/admin/page.tsx` line 52 fetches `/articles?limit=1` with no status filter, returning total count including drafts.

**Required Changes**:
- File: `src/frontend/src/app/[locale]/admin/page.tsx` — fetch counts for both published and draft articles separately

**Ready-to-Use Prompt**:
```
Update the admin dashboard to show separate counts for published and draft articles.

In `src/frontend/src/app/[locale]/admin/page.tsx`, change the articles fetch from:
  `adminFetch<{ total: number }>("/articles?limit=1")`
To two parallel fetches:
  `adminFetch<{ total: number }>("/articles?limit=1&status=PUBLISHED")`
  `adminFetch<{ total: number }>("/articles?limit=1&status=DRAFT")`

Update the `GeneralStats` interface and the dashboard display to show both counts as separate StatCards: "Articles publiés" and "Brouillons".
```

**Verification Criteria**:
- [ ] Dashboard shows "Articles publiés" and "Brouillons" as separate counts
- [ ] Counts are accurate (match database state)

---

## PART 5: Task Tracking Table

| Task ID | Task Name | Description | Priority | Status |
|---------|-----------|-------------|----------|--------|
| [TASK-001](#task-001-implement-preparation-and-see_you_next_year-homepage-modes) | Homepage: PREPARATION & SEE_YOU_NEXT_YEAR modes | Implement the two missing annual status modes on the homepage | Critical | Not Started |
| [TASK-002](#task-002-add-s-maxage-cache-control-headers-on-public-pages) | HTTP Cache-Control s-maxage headers | Add s-maxage headers to all public pages for CDN caching | Critical | Not Started |
| [TASK-003](#task-003-add-speaker-session-sponsor-venue-room-models-to-prisma-schema) | Prisma: Lot 2 data model | Add Speaker, Session, Sponsor, Venue, Room, TimeSlot models | ~~Critical~~ Lot 2 | Not Started |
| [TASK-004](#task-004-implement-language-suggestion-banner-browser-language-detection) | Language suggestion banner | Browser language detection with non-blocking banner | High | Not Started |
| [TASK-005](#task-005-install-and-configure-font-awesome) | Font Awesome integration | Replace custom SVGs with Font Awesome icons | High | Not Started |
| ~~TASK-006~~ | ~~TipTap WYSIWYG for articles~~ | ~~Supprimé — déjà fonctionnel~~ | ~~High~~ | Résolu |
| [TASK-007](#task-007-add-article-urls-to-sitemap) | Dynamic sitemap (articles + tags) | Add article and tag URLs to the XML sitemap | High | Not Started |
| [TASK-008](#task-008-add-default-ogimage-and-twitterimage-to-global-metadata) | OG image on all pages | Add default og:image and twitter:image to global metadata | High | Not Started |
| [TASK-009](#task-009-implement-brotligzip-compression-on-backend) | Brotli/Gzip compression | Enable compression on Fastify backend | High | Not Started |
| [TASK-010](#task-010-implement-analytics--real-user-monitoring-with-plausible) | Analytics / RUM (Plausible) | Deploy Plausible in Coolify + integrate script | High | Not Started |
| [TASK-011](#task-011-fix-hardcoded-langfr-on-root-html-element) | Fix lang attribute on html | Dynamic lang attribute per locale on root html element | Medium | Not Started |
| [TASK-012](#task-012-replace-footer-text-logo-with-actual-svg-logo) | Footer SVG logo | Replace text placeholder with actual DevFest Toulouse logo | Medium | Not Started |
| [TASK-013](#task-013-add-breadcrumblist-schemaorg-markup-to-breadcrumb-component) | BreadcrumbList Schema.org | Add structured data JSON-LD to Breadcrumb component | Medium | Not Started |
| [TASK-014](#task-014-fix-admin-sidebar-locale-hardcoding) | Admin sidebar locale fix | Use locale-aware paths in admin sidebar navigation | Medium | Not Started |
| [TASK-015](#task-015-add-previousstartdate-and-offers-to-schemaorg-event) | Schema.org Event enrichment | Add previousStartDate and offers to homepage Event schema | Medium | Not Started |
| [TASK-016](#task-016-wire-up-image-upload-in-article-editor) | Article image upload | Wire up ImagePickerDialog for article featured image | Low | Not Started |
| [TASK-017](#task-017-add-new-edition-button-to-admin-editions-list) | New Edition creation in admin | Add edition creation form to admin editions list | Low | Not Started |
| [TASK-018](#task-018-fix-bleu-color-token-to-match-design-system-spec) | Fix bleu color token | Correct #476DAB to #507BBD per design system | Low | Not Started |
| [TASK-019](#task-019-add-offers-display-on-schemaorg-fix-dashboard-article-count) | Dashboard article count fix | Show published vs draft article counts separately | Low | Not Started |

**Status Legend:**
- Not Started: Task has not been initiated
- In Progress: Task is currently being worked on
- Completed: Task has been completed and verified

---

## PART 6: Execution Guide

### How to Execute Tasks

Each task includes a **Ready-to-Use Prompt** that can be pasted directly into a new Claude Code session. Before running any prompt:

1. Read the current state section to understand what exists
2. Run `docker compose up` to have the local dev environment available for testing
3. Use the TDD workflow: write code + tests, run tests, verify in browser, commit, push
4. After completing a task, re-run the verification checklist

**Recommended execution order** (dependencies):
- TASK-003 must be completed before any Lot 2 work
- TASK-006 should be completed before TASK-016 (image upload in TipTap)
- TASK-001 can be worked on in parallel with TASK-003
- TASK-002 is independent and can be done immediately

### Verification Checklist

After completing all critical and high-priority tasks:

- [ ] TASK-001: All 3 homepage modes render correctly in the browser
- [ ] TASK-002: HTTP response headers contain correct Cache-Control values
- [ ] TASK-003: `prisma migrate dev` succeeds, seed creates sample speakers/sponsors
- [ ] TASK-004: Language banner appears on locale mismatch, dismisses and stays dismissed
- [ ] TASK-005: Stats and social icons render Font Awesome icons
- [ ] TASK-006: Article editor shows TipTap toolbar, content saves and renders as HTML
- [ ] TASK-007: `/sitemap.xml` includes article URLs
- [ ] TASK-008: All pages have og:image in view-source
- [ ] TASK-009: `curl -H "Accept-Encoding: br" http://localhost:4000/api/editions/current -I` shows `Content-Encoding: br`
- [ ] TASK-010: Core Web Vitals events fire in browser Network tab

### Re-analysis Instructions

After completing all or a batch of tasks, re-run this analysis by:

1. Opening a new Claude Code session in this project
2. Running the `/spec-compliance` command (if the skill is configured) or asking:
   "Analyze the codebase against the spec documents in docs/ and update the compliance report at docs/analysis-report-2026-04-04.md"
3. Update the Status column in the Task Tracking Table above
4. Add new tasks if new discrepancies are found
