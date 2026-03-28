# Suivi Lot 1 — Fondations & Billetterie

**Branche** : `dev-j`
**Échéance** : 08 avril 2026
**Objectif** : le nouveau site remplace l'ancien. Blind Bird annoncé, CFP mis en avant.

---

## Phase 1 — Socle technique (feature/lot1-tech-foundation)

Pas de pages visibles encore. On pose l'infrastructure.

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 1.1 | Init frontend (Next.js) + backend (Fastify) | — | DONE |
| 1.2 | Docker Compose : frontend + backend + BDD + SMTP (MailHog pour dev) | RG-064 | DONE |
| 1.3 | Structure i18n : routing `/fr/...` `/en/...`, fichiers de traduction, middleware redirect `/` → `/fr/` | RG-030→038, US-103 | DONE |
| 1.4 | Design tokens CSS (couleurs, typographies, espacements, ombres, radius) depuis design-system.md | — | DONE |
| 1.5 | Google Sans : chargement via next/font/local | RG-055 | BLOCKED (fichiers police manquants) |
| 1.6 | Font Awesome : intégration (subset des icônes utilisées) | — | TODO |
| 1.7 | Base de données : schema Prisma v7 (édition, article, palier billetterie, message contact, catégorie contact, page contenu, settings) | — | DONE |
| 1.8 | Auth admin (Better Auth — Google + GitHub OAuth) | — | DONE |
| 1.9 | Headers de sécurité (CSP, HSTS, X-Frame-Options…) | RG-060, US-106 | DONE |
| 1.10 | SEO transverse : metadata, OG, Twitter Card, canonical, hreflang | RG-010→020, US-102 | DONE |
| 1.11 | Breadcrumb composant + Schema.org BreadcrumbList | RG-019 | DONE |
| 1.12 | Sitemap XML + robots.txt | RG-013, RG-014 | DONE |
| 1.13 | Skip to content + landmarks ARIA | RG-041, RG-044, US-104 | DONE |
| 1.14 | Responsive : breakpoints mobile/tablette/desktop | RG-070, RG-071, US-105 | TODO (via Tailwind, opérationnel dès Phase 2) |
| 1.15 | Cache-Control headers (SSR pages) | RG-002→004, US-101 | TODO (à configurer avec les pages réelles) |
| 1.16 | Compression Brotli/Gzip | RG-005 | TODO (config serveur/Coolify) |
| 1.17 | Images : pipeline WebP/AVIF | RG-054 | DONE (config next.config.ts) |
| 1.18 | CI : linter + typecheck | RG-063 | DONE |
| 1.19 | Analytics / RUM (Core Web Vitals) | RG-148 | TODO |

**Critère de fin** : `docker compose up` démarre le site, la route `/fr/` rend une page blanche avec le bon `<title>`, les headers de sécurité sont présents, les tests passent.

---

## Phase 2 — Layout & navigation (feature/lot1-layout)

Header, footer, page 404, sélecteur de langue. Le squelette visuel du site.

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 2.1 | Header : logo, navigation 4 liens, réseaux sociaux, CTAs, sticky, mobile hamburger | US-110 | DONE |
| 2.2 | Footer : logo, réseaux, 3 colonnes liens, CTA contact, barre basse | US-111 | DONE |
| 2.3 | Sélecteur de langue FR/EN (bannière suggestion à faire) | RG-036, RG-037, RG-038 | PARTIAL |
| 2.4 | Page 404 personnalisée | US-180, RG-130→132 | DONE |

**Critère de fin** : le header et le footer sont visibles sur `/fr/` et `/en/`, le menu hamburger fonctionne, la 404 est branded.

---

## Phase 3 — Page d'accueil (feature/lot1-homepage)

Les sections de la page d'accueil en mode "Annonce de l'édition".

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 3.1 | Section Hero : titre, date, lieu, image, CTAs | US-120 | DONE |
| 3.2 | Section Chiffres clés : 4 blocs stats, illustration La Grave | US-121 | DONE |
| 3.3 | Section Sponsors : masquée (pas de données encore, placeholder conditionnel) | RG-083 | DONE |
| 3.4 | Section À propos / GDG Toulouse / Écosystème | US-122 | DONE |
| 3.5 | Section Dernières actualités (4 ArticleCards) | US-123 | DONE |
| 3.6 | Section Billetterie (conditionnelle) | US-125 | DONE |
| 3.7 | Section Replay / Aftermovie (YouTube lazy) | US-124 | DONE |
| 3.8 | Statut annuel : logique conditionnelle (seul "Annonce" pour le lot 1) | RG-080→084, RG-141 | DONE |

**Critère de fin** : la page d'accueil est complète visuellement, les sections conditionnelles se masquent quand les données sont absentes.

---

## Phase 4 — Blog & pages de contenu (feature/lot1-blog)

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 4.1 | Composant ArticleCard | — | DONE (créé en Phase 3) |
| 4.2 | Page liste actualités : grille, pagination 9/page | US-130, RG-098 | DONE |
| 4.3 | Page détail article : contenu riche, breadcrumb | US-131 | DONE |
| 4.4 | Étiquettes (tags) : page de tag, lien depuis les articles | RG-095, RG-096 | DONE |
| 4.5 | Page Code de conduite | US-170, RG-120, RG-121 | DONE |
| 4.6 | Page Mentions légales | US-171, RG-122 | DONE |

**Critère de fin** : on peut naviguer dans les articles, les tags filtrent, les pages statiques sont lisibles en FR et EN.

---

## Phase 5 — Billetterie & CFP (feature/lot1-ticketing)

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 5.1 | Page Billetterie : paliers, états, liens externes | US-140, RG-100→105 | DONE |
| 5.2 | Page CFP : dates, CTA Sessionize, état ouvert/fermé | US-150 | DONE |

**Critère de fin** : la page billetterie affiche les paliers, le CFP renvoie vers Sessionize.

---

## Phase 6 — Contact (feature/lot1-contact)

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 6.1 | Formulaire de contact : champs, validation client + serveur | US-160, RG-110, RG-144 | DONE |
| 6.2 | Catégories dynamiques + "Autre" automatique | RG-111, RG-149→152 | DONE |
| 6.3 | Envoi email SMTP + stockage BDD | RG-114, RG-115 | DONE |
| 6.4 | Protection anti-spam (honeypot) | RG-112 | DONE |
| 6.5 | Encart latéral : délais + réseaux | RG-116 | DONE |

**Critère de fin** : le formulaire envoie un email et stocke en BDD, les catégories sont dynamiques.

---

## Phase 7 — Back-office admin (feature/lot1-admin)

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 7.1 | Layout admin : sidebar, protection par rôle | RG-142 | DONE |
| 7.2 | CRUD articles + éditeur WYSIWYG (TipTap) | US-190, RG-143 | TODO |
| 7.3 | Gestion statut annuel | US-191 | TODO |
| 7.4 | Gestion paliers billetterie + import Billetweb | US-192, RG-145, RG-146 | TODO |
| 7.5 | Gestion CFP (dates, état, lien) | US-193 | TODO |
| 7.6 | Gestion pages contenu statique (CoC, Mentions) | US-194 | TODO |
| 7.7 | Gestion catégories formulaire contact | US-197 | TODO |
| 7.8 | Consultation messages de contact | US-195 | TODO |
| 7.9 | Purge manuelle du cache | US-196 | TODO |
| 7.10 | Gestion chiffres clés (sélection des stats affichées) | US-121 | TODO |

**Critère de fin** : un admin peut publier un article, gérer la billetterie, configurer le contact, et purger le cache.

---

## Phase 8 — Performance & qualité (feature/lot1-perf)

Dernière passe avant mise en production.

| # | Tâche | US/RG | Statut |
|---|-------|-------|--------|
| 8.1 | Lighthouse ≥ 90 sur les 4 catégories (toutes pages) | US-107, RG-050→053 | TODO |
| 8.2 | CSS critique inline, JS code-split par route | RG-056, RG-057 | TODO |
| 8.3 | Tests axe-core sans erreur critique | US-104 | TODO |
| 8.4 | Vérification Schema.org (Rich Results Test) | US-102 | TODO |
| 8.5 | Test navigateur complet (Chrome DevTools MCP) | RG-063 | TODO |
| 8.6 | Test mobile / tablette / desktop | US-105 | TODO |

**Critère de fin** : Lighthouse ≥ 90, zéro erreur axe-core, tous les parcours utilisateur validés dans le navigateur.

---

## Décisions à prendre avant de commencer

| # | Question | Impact | Choix |
|---|----------|--------|-------|
| D-01 | Framework | Structure tout le reste | **Next.js** (App Router, Server Components) |
| D-02 | Base de données | Schema, Docker Compose | **PostgreSQL** |
| D-03 | ORM | Code data access | **Prisma** |
| D-04 | Hébergement | Docker Compose, CI/CD | **VPS + Coolify** (manuel en prod, auto-deploy dev/beta) |
| D-05 | Gestionnaire de paquets | Scripts, CI | **pnpm** |
| D-06 | CSS | Stylisation | **Tailwind CSS** |
| D-07 | Image Docker Node.js | Dockerfile | **node:lts-alpine** |

---

## Journal des sessions

| Date | Session | Avancement |
|------|---------|------------|
| 2026-03-28 | Session 1 | Phase specs terminée. Choix techniques validés. Fichier de suivi créé. |
| 2026-03-28 | Session 2 | Phase 1 terminée : init projets, Docker Compose, design tokens, i18n, Prisma v7, Better Auth, sécurité, SEO, a11y, sitemap, CI. Reste : Google Sans (fichiers manquants), Font Awesome, cache headers, compression, analytics. |
| 2026-03-28 | Session 3 | Phase 3 terminée : homepage complète. Backend API (4 endpoints : editions, articles, ticket-tiers, key-figures). Frontend : Hero, Chiffres clés, À propos, Actualités (ArticleCard), Billetterie, Replay (YouTubeFacade), logique conditionnelle par statut annuel. Seed data, traductions FR/EN, vérification fonctionnelle navigateur. |
| 2026-03-28 | Session 4 | Phase 4 terminée : blog & pages contenu. Backend : endpoints articles paginés, détail, tags, pages contenu. Frontend : liste actualités (grille 4 col, pagination 9/page), détail article (contenu riche HTML, Schema.org Article, breadcrumb, tags cliquables), filtrage par tag, Code de conduite, Mentions légales. Seed étendu (12 articles, 2 ContentPages). |
| 2026-03-28 | Session 5 | Phase 5 terminée : billetterie (paliers avec statuts, prix barrés pour épuisés, CTA Acheter, note redirection Billetweb) et CFP (statut ouvert/fermé dynamique, dates, CTA Sessionize, formats acceptés, sujets). Backend : endpoint CFP settings. |
| 2026-03-28 | Session 6 | Phase 6 terminée : formulaire de contact complet. Validation client+serveur, catégories dynamiques depuis BDD avec "Autre", honeypot anti-spam, envoi email SMTP (nodemailer + MailHog), stockage message en BDD, routage email par catégorie, encart latéral (délais + réseaux sociaux). |
| 2026-03-28 | Session 7 | Tests : 19 tests backend (vitest), tests fonctionnels navigateur (pagination, formulaire contact, CORS). Fix double locale pagination + CORS multi-origin. Phase 7.1 : admin layout avec sidebar, auth shell Better Auth, page login OAuth, admin-guard middleware, dashboard. Reste 7.2→7.10. |

---

## Notes

- Chaque phase = une branche feature depuis `dev-j`
- Workflow TDD : code + tests → commit → tests auto → fix → commit → test navigateur → fix → commit → push
- Consulter Context7 avant d'utiliser toute lib/framework
- Les phases 1-2 sont séquentielles ; les phases 3-6 peuvent être parallélisées après la phase 2
- La phase 7 (admin) dépend des phases 3-6 pour les entités
- La phase 8 est une passe finale transverse
