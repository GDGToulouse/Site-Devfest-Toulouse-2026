# Audit des droits de l'API

Audit du 4 octobre 2026, préalable à l'ouverture du connecteur MCP en production (#514). Le connecteur permet à un agent IA d'appeler n'importe quelle route de l'API avec le jeton de la personne qui l'a autorisé : une route mal gardée devient joignable par un agent. L'audit vérifie donc que chaque route n'ouvre que ce qu'elle doit, à qui elle doit.

## Méthode

1. **Inventaire automatique.** `scripts/route-inventory.ts` lit toutes les routes du vrai serveur avec les gardes qu'elles exécutent, gardes héritées comprises (tableau en fin de document : 215 routes).
2. **Garde-fou permanent.** `src/backend/src/__tests__/route-guards.test.ts` échoue si :
   - une route qui écrit, ou qui vit sous `/api/admin`, `/api/me` ou `/api/sponsor-space`, n'a aucune garde connue. Les exceptions sont listées avec leur raison (`SELF_GUARDED` dans `lib/route-inventory.ts`), et le test vérifie qu'un appel anonyme y est bien refusé ;
   - une route de gestion des comptes ou des clés (`/api/me/api-keys`, `/api/admin/users`, `/api/admin/api-keys`) accepte un jeton d'agent ;
   - une route enregistrée échappe à l'inventaire.
3. **Revue des contrôles dans les routes.** Ce qu'un test de gardes ne voit pas :
   - un identifiant de second niveau qui appartient à quelqu'un d'autre (IDOR) ;
   - l'élévation de rôle dans l'espace partenaire ;
   - les actions d'administration ouvertes aux éditeurs ;
   - les données personnelles renvoyées par les routes publiques.

## Verdict

**Aucun trou connu ne reste ouvert sur ce qu'un agent peut atteindre.** Les trous trouvés qui concernaient le connecteur sont corrigés et couverts par des tests. Les défauts mineurs antérieurs au connecteur sont corrigés aussi (#521 à #524) ; reste un point d'arbitrage, accepté (voir plus bas).

La décision d'ouvrir le connecteur en production revient à Julien (décision du 4 octobre 2026 : avant l'événement si l'audit passe). Elle sera consignée sur #514.

## Constats corrigés

| Constat | Gravité | Correctif |
|---|---|---|
| Un agent pouvait créer une clé d'API sans expiration (`POST /api/me/api-keys`) et garder son accès après le retrait de son consentement. L'agent d'un ADMIN pouvait changer les rôles (`/api/admin/users`). | Haute | `refuseAgents` : 403 pour un jeton d'agent sur les clés et les comptes. Verrouillé par le garde-fou. |
| Tout compte connecté, sponsor compris, pouvait créer des clients OAuth (`/api/auth/oauth2/create-client`). C'est le réglage par défaut du fournisseur. | Haute | `clientPrivileges` et `resourcePrivileges` refusent tout. Les agents s'identifient par leur fiche CIMD. |
| Un compte dont l'adresse n'est pas vérifiée perdait son mot de passe au premier lien magique (better-auth 1.7). C'était le cas de tous les sponsors inscrits par mot de passe. | Moyenne | L'acceptation d'une invitation vérifie l'adresse, et une migration rattrape les comptes existants. |
| Un chemin encodé (`/api/%6De/agents`) passait la liste des routes interdites aux agents. | Faible | Le chemin est décodé avant le contrôle. |
| `PUT /api/admin/profile` sans schéma : un nom qui n'est pas du texte provoquait une erreur 500. | Faible | Schéma de corps ajouté. |
| Un EDITOR pouvait créer, modifier ou supprimer les offres de sponsoring (`/api/admin/sponsor-tiers`), quota d'offres d'emploi et options Platinum compris, alors que la corbeille et le rattachement aux éditions les réservent aux ADMIN. | Moyenne | Écritures réservées aux ADMIN, lecture laissée à l'équipe pour la fiche sponsor ; écran masqué aux EDITOR (#521). |
| La corbeille laissait un EDITOR lister et restaurer un message ou une catégorie de contact qu'un ADMIN seul peut supprimer. | Faible | `contact-messages` et `contact-categories` en `adminOnly` (#522). |
| Le lien de modification d'un speaker ou d'une conférence mis à la corbeille fonctionnait encore. | Faible | `resolveToken` écarte le speaker et les conférences à la corbeille ; restaurer le speaker rouvre le lien (#523). |
| L'invitation d'un collaborateur sponsor n'avait ni schéma ni limite : un corps absent ou mal typé provoquait une erreur 500, une adresse mal formée partait quand même. Même défaut côté admin (`/api/admin/sponsors/:id/contacts`). | Faible | Schéma sur les deux routes (400 en français), et 20 invitations par heure et par sponsor côté espace partenaire, comptées après la garde (#524). |

## Constats ouverts

Aucun ne concerne le connecteur en propre. Ils existaient avant lui, et un agent ne peut rien faire de plus que son utilisateur.

| Constat | Gravité | Proposition |
|---|---|---|
| L'URL de la brochure FR est publique (`GET /api/editions/current`), le formulaire ne conditionne donc pas le téléchargement et le compteur sous-compte. | Faible | **Accepté** (décision du 4 octobre 2026) : la brochure n'est pas un outil de collecte. |

**Note de conception.** L'agent d'un ADMIN a tous les pouvoirs ADMIN, hors comptes et clés : corbeille, paramètres, purge. C'est le principe retenu (l'agent agit avec les droits de la personne). Le resserrer passerait par des scopes OAuth par domaine.

**Écarté après vérification.** La revue signalait qu'une purge déclenchée par un agent serait inscrite au canal ADMIN de l'historique. C'est faux : le canal MCP, fixé par le jeton, n'est jamais remplacé par la route.

## Vérifié sans constat

- **Identifiants de second niveau** : chaque route vérifie que la ressource appartient au parent ou à l'appelant.
  - Offres d'emploi et équipe dans l'espace partenaire.
  - Clés d'API et agents du compte.
  - Sessions du lien de modification.
  - Contacts et offres côté admin.
- **Rôles sponsor** :
  - RESPONSABLE requis pour l'équipe ;
  - EDITEUR requis pour toute écriture ;
  - STAND en lecture seule ;
  - aucun moyen de s'élever soi-même ;
  - le dernier RESPONSABLE est protégé ;
  - un sponsor à la corbeille n'ouvre plus rien.
- **Routes publiques** : sélection explicite des champs, sans `contactEmail`, jeton, champ privé sponsor ni brouillon ; filtres de publication et de corbeille à tous les niveaux.
- **Paramètres publics** : lus par préfixe, sans l'adresse de notification CFP ni les URL de webhook.
- **Jetons d'agent** : émetteur, audience `/api/mcp`, signature, consentement revérifié à chaque appel, compte banni ou à la corbeille refusé.
- **Agents d'un compte banni ou supprimé** : coupés, et le restent si le bannissement est levé.

## Non couvert

- Le détail des routes d'administration des articles, pages, speakers, conférences, programme, import, traduction, fichiers, lieux, éditions et tarifs. Elles ont été vérifiées par sondage, et leur garde par le test.
- Les endpoints OAuth de better-auth eux-mêmes : la bibliothèque est prise telle quelle, en 1.7.7.
- Un client MCP réel connecté à `dev-j` : à faire après le déploiement.

## Inventaire

Généré par `LOG_LEVEL=silent pnpm exec tsx scripts/route-inventory.ts` (conteneur backend). À régénérer quand les routes changent. « Équipe » désigne les comptes ADMIN et EDITOR. Les routes de comptes et de clés refusent en plus tout jeton d'agent.

### Back-office (130)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/api/admin/api-keys` | ADMIN ; refusé aux agents IA |
| DELETE | `/api/admin/api-keys/:id` | ADMIN ; refusé aux agents IA |
| GET | `/api/admin/articles` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/articles` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/articles/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/articles/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/articles/:id` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/articles/:id/translate-fields` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/audit` | ADMIN |
| POST | `/api/admin/cache/purge` | ADMIN |
| GET | `/api/admin/categories` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/categories` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/categories/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/categories/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/categories/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/contact/categories` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/contact/categories` | ADMIN |
| DELETE | `/api/admin/contact/categories/:id` | ADMIN |
| PUT | `/api/admin/contact/categories/:id` | ADMIN |
| GET | `/api/admin/contact/messages` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/contact/messages/:id` | ADMIN |
| POST | `/api/admin/contact/messages/:id/forward` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/contact/messages/:id/read` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/contact/messages/:id/retry-webhook` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/editions` | ADMIN |
| POST | `/api/admin/editions` | ADMIN |
| DELETE | `/api/admin/editions/:id` | ADMIN |
| GET | `/api/admin/editions/:id` | ADMIN |
| PUT | `/api/admin/editions/:id` | ADMIN |
| GET | `/api/admin/editions/:id/key-figures` | ADMIN |
| PUT | `/api/admin/editions/:id/key-figures` | ADMIN |
| GET | `/api/admin/editions/:id/sponsor-tiers` | ADMIN |
| DELETE | `/api/admin/editions/:id/sponsor-tiers/:tierId` | ADMIN |
| PUT | `/api/admin/editions/:id/sponsor-tiers/:tierId` | ADMIN |
| GET | `/api/admin/editions/current` | ADMIN |
| GET | `/api/admin/editions/featured` | ADMIN |
| PUT | `/api/admin/editions/featured` | ADMIN |
| GET | `/api/admin/files` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/files` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/files/:filename` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/files/:filename/generate-alt` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/files/:filename/metadata` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/import/sessionize` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/import/sessionize/:editionId/rooms` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/import/sessionize/:editionId/rooms/:sessionizeId` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/import/sessionize/:editionId/source` | ADMIN |
| GET | `/api/admin/import/sessionize/:editionId/source` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/pages` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/pages` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/pages/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/pages/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/pages/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/profile` | Contrôlé dans la route : renomme l'appelant ; vérifie la session elle-même |
| DELETE | `/api/admin/rooms/:id` | ADMIN |
| PUT | `/api/admin/rooms/:id` | ADMIN |
| GET | `/api/admin/schedule-entries` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/schedule-entries` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/schedule-entries/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/schedule-entries/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/session` | Contrôlé dans la route : dit qui est connecté ; vérifie la session elle-même |
| GET | `/api/admin/settings/cfp` | ADMIN |
| PUT | `/api/admin/settings/cfp` | ADMIN |
| GET | `/api/admin/settings/general` | ADMIN |
| PUT | `/api/admin/settings/general` | ADMIN |
| POST | `/api/admin/settings/test-alert-webhook` | ADMIN |
| POST | `/api/admin/settings/test-webhook` | ADMIN |
| GET | `/api/admin/speakers` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/speakers` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/speakers/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/speakers/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/speakers/:id` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/speakers/:id/edit-link` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/speakers/:id/edit-link` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/speakers/:id/edit-link/lock` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/speakers/:id/editions` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/speakers/:id/editions/:editionId` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/speakers/bulk` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/speakers/rotate-featured` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/sponsor-tiers` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsor-tiers` | ADMIN |
| DELETE | `/api/admin/sponsor-tiers/:id` | ADMIN |
| GET | `/api/admin/sponsor-tiers/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/sponsor-tiers/:id` | ADMIN |
| GET | `/api/admin/sponsors` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsors` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/sponsors/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/sponsors/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/sponsors/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/sponsors/:id/contacts` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsors/:id/contacts` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/sponsors/:id/contacts/:contactId` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/sponsors/:id/contacts/:contactId/access-role` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsors/:id/contacts/:contactId/invite` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/sponsors/:id/contacts/:contactId/lock` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsors/:id/editions` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/sponsors/:id/editions/:editionId` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/sponsors/:id/job-offers/:offerId` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/sponsors/bulk` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/tags` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/tags` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/tags/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/talks` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/talks` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/talks/:id` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/talks/:id` | Équipe (ADMIN, EDITOR) |
| PUT | `/api/admin/talks/:id` | Équipe (ADMIN, EDITOR) |
| POST | `/api/admin/talks/bulk` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/tickets` | ADMIN |
| POST | `/api/admin/tickets` | ADMIN |
| DELETE | `/api/admin/tickets/:id` | ADMIN |
| PUT | `/api/admin/tickets/:id` | ADMIN |
| GET | `/api/admin/tickets/billetweb/events` | ADMIN |
| POST | `/api/admin/tickets/import/billetweb` | ADMIN |
| POST | `/api/admin/translate` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/translate/stats` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/trash` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/trash/:entity` | Équipe (ADMIN, EDITOR) |
| DELETE | `/api/admin/trash/:entity/:id/purge` | ADMIN |
| POST | `/api/admin/trash/:entity/:id/restore` | Équipe (ADMIN, EDITOR) |
| GET | `/api/admin/users` | ADMIN ; refusé aux agents IA |
| POST | `/api/admin/users` | ADMIN ; refusé aux agents IA |
| DELETE | `/api/admin/users/:id` | ADMIN ; refusé aux agents IA |
| PUT | `/api/admin/users/:id` | ADMIN ; refusé aux agents IA |
| PUT | `/api/admin/users/:id/ban` | ADMIN ; refusé aux agents IA |
| GET | `/api/admin/venues` | ADMIN |
| POST | `/api/admin/venues` | ADMIN |
| DELETE | `/api/admin/venues/:id` | ADMIN |
| GET | `/api/admin/venues/:id` | ADMIN |
| PUT | `/api/admin/venues/:id` | ADMIN |
| POST | `/api/admin/venues/:id/rooms` | ADMIN |

### Compte (6)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/api/me/agents` | Tout compte, depuis le navigateur |
| DELETE | `/api/me/agents/:clientId` | Tout compte, depuis le navigateur |
| GET | `/api/me/api-keys` | Équipe (ADMIN, EDITOR) ; refusé aux agents IA |
| POST | `/api/me/api-keys` | Équipe (ADMIN, EDITOR) ; refusé aux agents IA |
| DELETE | `/api/me/api-keys/:id` | Équipe (ADMIN, EDITOR) ; refusé aux agents IA |
| POST | `/api/me/api-keys/:id/rotate` | Équipe (ADMIN, EDITOR) ; refusé aux agents IA |

### Espace partenaire (14)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/api/sponsor-space/:sponsorId` | Contact du sponsor (STAND et plus) ou ADMIN |
| PUT | `/api/sponsor-space/:sponsorId` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| GET | `/api/sponsor-space/:sponsorId/job-offers` | Contact du sponsor (STAND et plus) ou ADMIN |
| POST | `/api/sponsor-space/:sponsorId/job-offers` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| DELETE | `/api/sponsor-space/:sponsorId/job-offers/:offerId` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| PUT | `/api/sponsor-space/:sponsorId/job-offers/:offerId` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| GET | `/api/sponsor-space/:sponsorId/private` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| GET | `/api/sponsor-space/:sponsorId/team` | Contact du sponsor (RESPONSABLE) ou ADMIN |
| POST | `/api/sponsor-space/:sponsorId/team` | Contact du sponsor (RESPONSABLE) ou ADMIN |
| DELETE | `/api/sponsor-space/:sponsorId/team/:contactId` | Contact du sponsor (RESPONSABLE) ou ADMIN |
| PUT | `/api/sponsor-space/:sponsorId/team/:contactId` | Contact du sponsor (RESPONSABLE) ou ADMIN |
| POST | `/api/sponsor-space/:sponsorId/upload` | Contact du sponsor (EDITEUR et plus) ou ADMIN |
| GET | `/api/sponsor-space/me` | Contrôlé dans la route : dit qui est connecté ; vérifie la session elle-même |
| GET | `/api/sponsor-space/mine` | Contrôlé dans la route : liste les sponsors de l'appelant ; vérifie la session elle-même |

### Lien de modification speaker (4)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/api/edit/:token` | Contrôlé dans la route : lien de modification du speaker : le jeton est l'accès |
| PUT | `/api/edit/:token` | Contrôlé dans la route : lien de modification du speaker : le jeton est l'accès |
| PUT | `/api/edit/:token/talks/:talkId` | Contrôlé dans la route : lien de modification du speaker : le jeton est l'accès |
| POST | `/api/edit/:token/upload` | Contrôlé dans la route : lien de modification du speaker : le jeton est l'accès |

### Connecteur MCP (3)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| DELETE | `/api/mcp` | Contrôlé dans la route : toujours 405 : le serveur MCP est sans état |
| GET | `/api/mcp` | Contrôlé dans la route : toujours 405 : le serveur MCP est sans état |
| POST | `/api/mcp` | Contrôlé dans la route : jeton OAuth d'un agent IA, vérifié par la route |

### Public et divers (56)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/api/articles` | Public |
| GET | `/api/articles/:slug` | Public |
| GET | `/api/articles/latest` | Public |
| GET | `/api/auth/*` | better-auth (connexion, OAuth) |
| POST | `/api/auth/*` | better-auth (connexion, OAuth) |
| GET | `/api/auth/providers` | better-auth (connexion, OAuth) |
| GET | `/api/brochure/:token` | Public |
| GET | `/api/categories` | Public |
| GET | `/api/contact/categories` | Public |
| POST | `/api/contact/send` | Contrôlé dans la route : formulaire de contact public : tout le monde peut écrire, débit limité |
| GET | `/api/docs` | Public |
| GET | `/api/docs/` | Public |
| GET | `/api/docs/*` | Public |
| GET | `/api/docs/json` | Public |
| GET | `/api/docs/static/*` | Public |
| GET | `/api/docs/static/index.html` | Public |
| GET | `/api/docs/static/swagger-initializer.js` | Public |
| GET | `/api/docs/yaml` | Public |
| GET | `/api/editions` | Public |
| GET | `/api/editions/:year` | Public |
| GET | `/api/editions/:year/schedule` | Public |
| GET | `/api/editions/:year/schedule.ics` | Public |
| GET | `/api/editions/:year/speakers` | Public |
| GET | `/api/editions/:year/sponsors` | Public |
| GET | `/api/editions/:year/talks` | Public |
| GET | `/api/editions/:year/talks/:slug` | Public |
| GET | `/api/editions/current` | Public |
| GET | `/api/editions/current/sponsor-tiers` | Public |
| GET | `/api/editions/current/ticket-tiers` | Public |
| GET | `/api/health` | Public |
| GET | `/api/job-offers` | Public |
| GET | `/api/maintenance/purge-trash` | Contrôlé dans la route : secret partagé du cron, ou session ADMIN |
| POST | `/api/maintenance/purge-trash` | Contrôlé dans la route : secret partagé du cron, ou session ADMIN |
| GET | `/api/pages` | Public |
| GET | `/api/pages/:slug` | Public |
| GET | `/api/replays` | Public |
| GET | `/api/replays/filters` | Public |
| GET | `/api/settings/carousel` | Public |
| GET | `/api/settings/cfp` | Public |
| GET | `/api/settings/ecosystem` | Public |
| GET | `/api/settings/featured-edition` | Public |
| GET | `/api/settings/identity` | Public |
| GET | `/api/settings/key-figures` | Public |
| GET | `/api/settings/seo` | Public |
| GET | `/api/settings/social` | Public |
| GET | `/api/speakers` | Public |
| GET | `/api/speakers/:slug` | Public |
| GET | `/api/speakers/featured` | Public |
| GET | `/api/speakers/hall-of-fame` | Public |
| GET | `/api/sponsor-invitation/:token` | Public |
| POST | `/api/sponsor-invitation/:token/accept` | Contrôlé dans la route : jeton d'invitation, puis l'e-mail de la session doit correspondre |
| GET | `/api/sponsors` | Public |
| GET | `/api/sponsors/:slug` | Public |
| GET | `/api/sponsors/indexable` | Public |
| GET | `/api/tags` | Public |
| GET | `/api/talks/:slug` | Public |

### Hors API (2)

| Méthode | Route | Qui peut l'appeler |
|---|---|---|
| GET | `/.well-known/*` | better-auth (connexion, OAuth) |
| GET | `/uploads/*` | Public |
