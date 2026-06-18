# Exemples d'issues — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

3 exemples couvrant les cas principaux : **bug**, **enhancement / user story**, **question / décision**. Calqués sur les conventions réelles du repo (issues #64, #99, et un cas Lot 3).

---

## Exemple 1 — `bug`

**Titre** : `OAuth : le clic Google renvoie "null" au lieu de rediriger`

**Labels** : `bug` · **Milestone** : `Lot 2 — Speakers, Sessions & Sponsors`

**Body** :

```markdown
## Contexte / Repro

Sur dev-j, le bouton « Se connecter avec Google » de l'admin n'amorce pas le
flux OAuth.

Étapes :
1. Aller sur https://dev-j.site.devfesttoulouse.fr/fr/admin
2. Cliquer sur le bouton Google
3. La page affiche « null » au lieu de rediriger vers Google

## Comportement attendu vs observé

- **Attendu** : redirection vers l'écran de consentement Google
- **Observé** : réponse `null`, aucune redirection

## Tâches

- [ ] Diagnostiquer l'appel à `/api/auth/sign-in/social`
- [ ] Corriger le déclenchement côté frontend
- [ ] Vérifier la non-régression du login GitHub + email/password

## Critères d'acceptation

- [ ] Le clic Google redirige vers Google puis revient connecté (email allow-listé)
- [ ] Login GitHub OK
- [ ] Un compte hors allowlist est rejeté

## Liens

- Frontend : [AdminLogin.tsx](src/frontend/src/components/admin/AdminLogin.tsx)
- Helper : [admin-api.ts](src/frontend/src/lib/admin-api.ts)
- Backend : [auth.ts](src/backend/src/lib/auth.ts)
```

---

## Exemple 2 — `enhancement` (amélioration back-office)

**Titre** : `Admin — gestion des images du carrousel « Derrière le DevFest »`

**Labels** : `enhancement` · **Milestone** : `Lot 1 — Fondations & Billetterie`

**Body** :

```markdown
## Contexte

Le carrousel d'ambiance du bloc « Derrière le DevFest Toulouse » fonctionne,
mais ses images sont définies **en dur** dans le code (`AboutSection.tsx`) :
ajouter/retirer une photo nécessite un commit + déploiement.

Objectif : gérer ces images depuis le back-office, comme déjà fait pour les
partenaires écosystème et l'identité visuelle.

## Périmètre

### Inclus
- Stockage dans un réglage `SiteSetting` (JSON `[{url, alt}]`), pas de nouvelle table
- Écran admin : ajout via l'ImagePickerDialog existant, alt par image, réordon., suppression
- Lecture publique : `AboutSection` lit le backend au lieu de la constante en dur
- Revalidation de la home à la sauvegarde

### Hors scope
- L'upload/optimisation d'images (déjà géré par `files.ts`)
- Le composant carrousel lui-même (déjà livré)

## Test plan

- [ ] `tsc` + `eslint` OK (front + back)
- [ ] Ajouter 2-3 images via le back-office → visibles sur la home (phase annonce)
- [ ] Réordonner / supprimer → reflété après revalidation
- [ ] `alt` éditable et bien rendu (a11y)
- [ ] Liste vide → bloc texte seul (zéro régression)
- [ ] Vérif via Chrome DevTools MCP, console propre

## Liens

- Public : [AboutSection.tsx](src/frontend/src/components/home/AboutSection.tsx)
- Admin : [settings/page.tsx](src/frontend/src/app/admin/settings/page.tsx)
- Backend : [settings.ts](src/backend/src/routes/settings.ts) · [admin/settings.ts](src/backend/src/routes/admin/settings.ts)
- Infra réutilisée : `ImagePickerDialog`, `SiteSetting`, `files.ts`
```

---

## Exemple 3 — `enhancement` + User Story (Lot 3, vue programme)

**Titre** : `Hall of replays — toutes les conférences vidéo, toutes éditions`

**Labels** : `enhancement` · **Milestone** : `Lot 4 — Contenu complémentaire`

**Body** :

```markdown
## User Story

> **En tant que** visiteur,
> **je veux** parcourir toutes les conférences filmées de toutes les éditions
> **afin de** retrouver et revoir un talk sans naviguer édition par édition.

Cas d'usage :
- Chercher un talk vu il y a 2 ans dont on a oublié l'année
- Découvrir les conférences d'un speaker sur plusieurs éditions

## Périmètre

### Inclus (V1)
- Page `/replays` listant les talks ayant une `videoUrl`, toutes éditions confondues
- Recherche texte (titre, speaker) + filtres année / format / catégorie
- Lien « Revoir » vers la vidéo + indication de l'édition d'origine

### Hors scope V1
- Lecture embarquée des vidéos dans la page (lien externe suffit)
- Galerie photos (issue séparée)

## Critères d'acceptation

- [ ] La page liste toutes les sessions publiées ayant une vidéo, toutes éditions
- [ ] Recherche + filtres fonctionnent côté SSR et restent indexables (SEO)
- [ ] Chaque entrée indique l'édition et ouvre la vidéo
- [ ] Page rendue correctement FR/EN, vérif Chrome DevTools

## Dépendances

- Données historiques importées (#63) — `Talk.videoUrl` peuplé.

## Liens

- Spec : [docs/fonctionnalites-2026.md](docs/fonctionnalites-2026.md) — « Hall of replays »
- Données : [editions.ts](src/backend/src/routes/editions.ts) (routes par année)
- Modèle : [schema.prisma](src/backend/prisma/schema.prisma) — `Talk.videoUrl`
```
