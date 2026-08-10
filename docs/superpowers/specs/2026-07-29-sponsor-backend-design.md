# Sponsor backend on the identity/participation model — design

**Date** : 2026-07-29
**Issue** : #130 (123b), sous-étape 2/4 de #123
**Prérequis** : #129 livré — `Sponsor` est une identité à slug global, `EditionSponsor` porte la participation.
**Spec parente** : [2026-07-29-sponsor-identity-design.md](2026-07-29-sponsor-identity-design.md)

## Problème

#129 a changé le modèle sans toucher aux consommateurs. `pnpm typecheck` échoue avec ~90 erreurs sur 20 fichiers, la CI est rouge, et la branche n'est pas mergeable. #130 réécrit la couche backend pour que l'application fonctionne à nouveau.

## La règle qui gouverne tout le design

**La fiche sponsor met en avant l'édition en cours ; les autres années ne sont que des tags.**

C'est une règle **temporelle**, pas structurelle. Elle décide de trois choses d'un coup, au lieu de trois logiques distinctes à retenir :

| Donnée | Édition à la une | Éditions passées |
|---|---|---|
| Niveau de sponsoring (`tier`) | mis en avant | absent de la fiche — visible sur la page récap de l'édition |
| Offres d'emploi | affichées | jamais |
| Participation | — | tag « année », cliquable vers `/editions/<year>` |

Corollaire retenu explicitement : **aucune offre passée ne s'affiche jamais.** Il n'y a donc pas d'édition à « choisir » pour filtrer — seule celle à la une peut porter des offres vivantes.

## Endpoints publics

### `GET /api/sponsors` — contrat inchangé

La requête part de `EditionSponsor` (`where: { editionId, publicationStatus: "PUBLISHED", sponsor: notDeleted }`) et projette `sponsor` + `tier`. Tri par rang de tier conservé (RG-221). **Zéro impact frontend.**

C'est cette page — le mur de sponsors d'une édition — qui porte le niveau de sponsoring.

### `GET /api/sponsors/:slug` — le vrai changement

Deux résolutions désormais **indépendantes** :

1. **L'entreprise**, par slug global. Plus de `getFeaturedEdition()` dans cette requête.
2. **L'édition à la une**, résolue séparément, pour la mise en avant uniquement.

Le `404` change de sens : il ne survient plus que si l'entreprise n'existe pas, est en corbeille, ou n'a aucune participation publiée. **Il ne dépend plus de l'édition à la une** — c'est l'objet du chantier, une fiche d'entreprise reste consultable hors édition.

Deux évolutions du contrat :

```ts
tier: SponsorTierRef | null   // était: SponsorTierRef
editions: number[]            // nouveau — années de participation, tri desc
```

`tier` et `jobOffers` sont renseignés **si et seulement si** l'entreprise participe à l'édition à la une **et** que `areOffersVisible()` passe pour celle-ci. Sinon `tier: null`, `jobOffers: []`. Pas d'édition à la une du tout → même résultat, sans erreur.

`speakers` reste inchangé : la relation passe déjà par `SpeakerEdition` depuis #353.

### `GET /api/job-offers` — contrat inchangé

La page récap reste entièrement scopée à l'édition à la une. Elle ne liste que des offres vivantes par construction. Seul le chemin de requête change (via la participation).

## Endpoints admin

Les 7 endpoints de [admin/sponsors.ts](src/backend/src/routes/admin/sponsors.ts) (412 lignes) suivent le découpage appliqué aux speakers dans #351 :

- **liste** — une ligne par entreprise avec ses participations ; filtre `editionId` optionnel via `editions: { some: { editionId } }`
- **create** — crée l'identité **et** sa participation. Slug déjà pris → **409 avec l'id existant**, proposant de rattacher plutôt que dupliquer. C'est ce qui empêche les doublons de se reformer.
- **update** — sépare champs d'identité (touchent toutes les années) et champs de participation (locaux à l'année)
- **delete** — corbeille sur l'identité (`deletedAt`), inchangé ; la revue de #129 a confirmé que le mécanisme générique continue de fonctionner
- **bulk** — cible des participations, pas des identités. Même garde-fou que côté speakers : sans année explicite, une action de masse toucherait des éditions que l'admin ne regarde pas.
- **rattacher / détacher une édition** — deux endpoints nouveaux, calqués sur `speakerEdition.upsert` / `deleteMany`

**Les endpoints de contacts ne bougent pas** (`/contacts`, `/resend`, `/lock`) : les contacts restent sur l'identité.

**Le magic-link est hors sujet côté sponsor.** Depuis #250 les tokens vivent sur `SponsorContact`, qui n'a pas bougé. L'objectif « token porté par la participation » écrit dans #129 ne concerne plus que les speakers.

## Imports et seed

`sessionize-import.ts` ne touche pas aux sponsors — rien à faire. `seed-dev.ts` a été porté en #129.

## Tests

La moitié invisible du travail : **15 fichiers, ~22 erreurs**, presque toutes des fixtures construisant un sponsor avec `editionId`/`tierId` au premier niveau.

`sponsor-test-helpers.ts` est le point le plus rentable : `createSponsorWithToken()` prend un `Prisma.SponsorUncheckedCreateInput`, donc le porter une fois débloque plusieurs fichiers d'un coup. **À faire en premier** — il donne un filet avant de toucher aux routes.

**Règle** : les assertions existantes ne changent pas, **sauf** sur `/api/sponsors/:slug` (`tier` nullable, `editions` ajouté). Ce sont elles qui prouvent que les shapes sont préservées ailleurs. Si un test réclame de changer son assertion, c'est le signal qu'on a cassé quelque chose.

Tests nouveaux : slug global servant plusieurs années ; 409 sur homonyme ; rattachement/détachement ; `tier: null` hors édition à la une ; aucune offre passée exposée.

## Frontière avec #132

`tier` devenant nullable et `editions` apparaissant, la page publique `/sponsors/<slug>` casse. Le découpage initial mettait tout le front dans #132.

**Décision : cette page est portée dans #130.** Livrer un champ nullable en laissant un consommateur le lire comme non-nullable crée un état intermédiaire cassé qui se fait oublier — et le projet interdit les shims de compatibilité.

Périmètre front de #130, strictement : la fiche sponsor publique + le type `SponsorDetail` dans `types.ts`. Le reste de #132 (non-régression, JSON-LD `Organization`, OG) reste hors périmètre.

## Ordre d'exécution

1. `sponsor-test-helpers.ts` — débloque plusieurs fichiers de test, donne un filet
2. Endpoints publics — les plus simples, contrat quasi inchangé
3. Endpoints admin — le gros du travail
4. Page front sponsor + `SponsorDetail`
5. Les 15 fichiers de test restants

## Risques

**Le 404 qui change de sens.** Aujourd'hui `/sponsors/:slug` répond 404 sans édition à la une ; après, 200 avec `tier: null`. Voulu, mais un test existant peut encoder l'ancien comportement. À vérifier, pas à supposer.

**Les shapes préservées ailleurs.** `/api/sponsors` et `/api/job-offers` ne doivent pas bouger d'un octet.

**Le quota d'offres par tier.** `SponsorTier.jobOfferQuota` se lit sur le tier **de la participation**. Une entreprise Gold en 2024 et Platinum en 2026 a deux quotas différents selon l'année.

## Hors scope

- `/editions/:year/sponsors` et la section sponsors d'une édition passée → **#370**
- Back-office sponsor authentifié, rôles par sponsor → **#362**
- Hall of sponsors → idée conservée, non implémentée
- Admin front (liste dédoublonnée, fiche en deux blocs) → **#131**
