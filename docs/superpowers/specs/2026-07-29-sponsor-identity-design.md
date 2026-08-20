# Sponsor en entité partagée multi-éditions — design

**Date** : 2026-07-29
**Issues** : #123 (épique) → #129 (socle), #130 (backend), #131 (admin front), #132 (public front)
**Précédent** : #351/#352/#353 ont appliqué la même refonte aux speakers.

## Problème

`Sponsor` porte `editionId` et `@@unique([editionId, slug])` : une entreprise qui sponsorise N éditions existe en N lignes sans lien entre elles. C'est le modèle que #351 a supprimé côté speakers.

## Pourquoi maintenant

Contre-intuitivement, l'absence de données est l'argument pour agir tout de suite.

Le risque de la migration speaker n'était pas dans le `ALTER TABLE` mais dans **la fusion** : 330 lignes à replier en 240 personnes, élection d'un survivant, arbitrage des quasi-doublons (`Tregan`/`Trégan`), repointage de 289 liens `_SpeakerToTalk` **avant** suppression de 90 lignes — sous peine de perte silencieuse par `ON DELETE CASCADE`.

Côté sponsors, aucun de ces risques n'a de support :

- `devfest-history.json` ne contient que `speakers` et `sessions` — **aucun sponsor historique en base** (vérifié en rédigeant #370).
- Les sponsors de démo (`seed-dev.ts`) sont tous sur l'édition courante, slugs distincts.
- Donc **zéro doublon inter-éditions** : rien à fondre.

La migration se réduit à une transformation mécanique 1-pour-1. Les 22 lignes d'aujourd'hui sont le moment le moins cher de toute la vie du projet pour changer ce modèle. Chaque édition ajoutée l'alourdit, et le jour où #370 fait saisir les sponsors 2016-2025, on retombe exactement dans le scénario speaker : doublons réels, fusion à arbitrer, risque de perte.

Le coût du chantier n'est donc pas la migration : c'est la **réécriture des consommateurs**. Du portage de code testable et revue-able, pas un risque de données.

## Répartition des champs

Le critère retenu : **l'historique de cette donnée a-t-il de la valeur ?**

| | Champs |
|---|---|
| **Identité** `Sponsor` | `slug` (→ `@unique`), `name`, `logoUrl`, `websiteUrl`, `descriptionFr/En`, `socialLinks`, `contactEmail`, `locale`, `standContacts`, `deletedAt`, relation `SponsorContact[]` |
| **Participation** `EditionSponsor` | `editionId`, `sponsorId`, `tierId`, `publicationStatus`, `comKitReceived`, `comKitLogoWebUrl`, `comKitLogoPrintUrl`, `comKitCharterUrl`, `comKitNotes`, `platinumPromoIdea`, `platinumCoBuildIdea`, relation `SponsorJobOffer[]` |

Décisions notables :

- **`logoUrl` et descriptions sur l'identité.** Une page d'édition passée affichera donc le logo et le pitch *actuels* de l'entreprise, pas ceux de l'époque. Assumé : cohérent avec `Speaker.photoUrl`, et évite de ressaisir chaque année. Un rebranding réécrit l'archive — accepté.
- **`standContacts` sur l'identité.** C'est l'équipe qui tient le stand, utile uniquement pour scanner pendant l'événement. L'édition finie, la donnée est morte : son historique n'a aucune valeur, donc pas besoin de l'archiver par année. Écrasée à chaque édition. (Si #113 — passport QR — a besoin d'un historique, ce sera une table de scans, pas ce champ.)
- **`SponsorJobOffer` sur la participation.** Une offre est datée par nature et son quota dépend du `tierId` de l'année ; sur l'identité, les offres de 2019 réapparaîtraient en 2026.
- **`SponsorContact` sur l'identité.** Les personnes autorisées à éditer la fiche suivent l'entreprise, pas l'année. Plus simple, et leur code existant reste correct.

## Migration

Aucune fusion : chaque `Sponsor` produit exactement un `EditionSponsor`.

1. `CREATE TABLE "EditionSponsor"` + index + FK, `@@unique([sponsorId, editionId])`
2. `INSERT ... SELECT` — une participation par sponsor, portant les champs annuels
3. Repointer `SponsorJobOffer.sponsorId` → `editionSponsorId`
4. `DROP COLUMN` sur `Sponsor` : `editionId`, `tierId`, `publicationStatus`, les 5 `comKit*`, les 2 `platinum*`
5. `DROP INDEX "Sponsor_editionId_slug_key"` → `CREATE UNIQUE INDEX "Sponsor_slug_key"`

**Garde explicite** : l'étape 5 échouerait si deux éditions partageaient un slug. C'est impossible aujourd'hui, mais la migration le **vérifie** au lieu de le supposer — leçon du `_SpeakerToTalk` en cascade, où une hypothèse tacite pouvait détruire des données sans rien lever.

**Invariants à vérifier des deux côtés** :

- `count(Sponsor)` avant = `count(EditionSponsor)` après
- `count(SponsorJobOffer)` inchangé, chacune rattachée à une participation non nulle
- `count(SponsorContact)` inchangé

Pas de suppression de lignes : une erreur SQL fait échouer la migration en transaction plutôt que de perdre des données silencieusement.

## Backend

**Endpoints publics** — shapes préservées, le front n'est pas touché.

- `GET /api/sponsors` : contrat inchangé. La requête part de `EditionSponsor` (`where: { editionId, publicationStatus: "PUBLISHED", sponsor: notDeleted }`) et projette `sponsor` + `tier`.
- `GET /api/sponsors/:slug` : plus de `getFeaturedEdition()`. Résolution par slug global, réponse enrichie d'un tableau `editions[]` (année + tier), comme la fiche speaker depuis #352. **Les offres d'emploi ne sont servies que pour la participation la plus récente** — afficher celles de 2019 sur une fiche multi-éditions n'aurait pas de sens. Filtrage `areOffersVisible()` conservé.
- `GET /api/editions/:year/sponsors` : nouvel endpoint (#370), pendant exact de `/editions/:year/speakers`.

**Endpoints admin** — même découpage que les speakers dans #351.

- liste : une ligne par entreprise + participations, filtre `editionId` via `editions: { some: { editionId } }`
- create : crée identité + participation ; slug déjà pris → **409 avec l'id existant**, proposant de rattacher plutôt que dupliquer. C'est ce qui empêche les doublons de se reformer.
- update : sépare champs d'identité et champs de participation
- delete : corbeille sur l'identité (`deletedAt`), inchangé
- rattacher / détacher une édition : deux endpoints nouveaux, calqués sur `speakerEdition.upsert` / `deleteMany`
- contacts (`/contacts`, `/resend`, `/lock`) : **inchangés**, les contacts restent sur l'identité

**Magic-link : hors sujet côté sponsor.** Depuis #250 les tokens vivent sur `SponsorContact`. L'objectif « token porté par la participation » écrit dans #129 est **caduc** pour les sponsors — il ne concerne plus que les speakers, où `editToken` est resté sur l'identité.

**Imports / seed** : `sessionize-import.ts` ne touche pas aux sponsors. `seed-dev.ts` crée identité + participation.

**Tests (TDD)** : les tests existants (`public-sponsors.test.ts`, `admin-sponsor-contacts.test.ts`, `sponsor-job-offers.test.ts`) servent de filet — **leurs assertions ne changent pas**, puisque les shapes sont préservées. Nouveaux : slug global servant plusieurs années, 409 sur homonyme, rattachement/détachement, `/editions/:year/sponsors`, non-fuite d'une offre de 2019.

## Admin front

`/admin/sponsors` : une ligne par entreprise avec ses années. Portage direct de `admin/speakers/page.tsx`, helper `currentParticipation(entity, year)` compris.

**Garde-fou repris du précédent speaker** : les actions de masse ciblent **une** participation explicite — sans année sélectionnée, on toucherait des éditions que l'admin ne regarde pas.

`/admin/sponsors/[id]` : bloc **identité** (nom, logo, site, descriptions, réseaux, contacts) + bloc **participation** (tier, publication, kit com, idées Platinum, offres), avec panneau de rattachement d'éditions.

Vigilance :

- La consigne d'upload de logo (#340) est attachée à `logoUrl` → bloc identité. À ne pas perdre en restructurant.
- Le quota d'offres se calcule sur le `tierId` **de la participation**, pas sur un tier « courant ».

## Public front

Le plus léger, par construction : les shapes étant préservées, `/sponsors` et les composants de la home ne changent pas.

`/sponsors/<slug>` gagne la liste des années de sponsoring avec le tier de chaque année. JSON-LD `Organization` conservé, via `jsonLdScript()` qui échappe la sortie (durcissement XSS de `f68541b`).

Réponse au risque nommé par #132 (régression silencieuse) : tests backend verrouillant les shapes + vérification navigateur (Chrome DevTools MCP) sur édition courante **et** passée, FR et EN, console propre.

## Hors scope

- **Hall of sponsors** (liste de tous les sponsors, toutes éditions) : idée conservée, **non implémentée**.
- **Saisie des sponsors historiques** : c'est #370. Ce design la rend possible sans la supposer.

## Découpage

Une PR par sous-issue, dans l'ordre, chacune laissant l'application fonctionnelle :

| PR | Issue | Contenu |
|---|---|---|
| 1 | #129 | Schéma + migration + invariants |
| 2 | #130 | Endpoints publics et admin, seed, tests |
| 3 | #131 | Admin front : liste dédoublonnée, fiche en deux blocs |
| 4 | #132 | Public front + vérification de non-régression |

## Effets sur les autres issues

- **#370 devient plus simple** : le slug étant global, son point ouvert (« quelle fiche servir quand le slug est ambigu ») disparaît. Reste la section sponsors sur la page d'édition passée et la saisie des données. À commenter une fois #129 mergée.
- **#362 (vrai back-office sponsor) n'est pas affecté** : il s'appuie sur `SponsorContact`, qui ne bouge pas. Chantiers indépendants.
