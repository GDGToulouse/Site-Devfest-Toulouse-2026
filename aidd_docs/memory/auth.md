# Auth

## Authentication

- better-auth, configuré dans `src/backend/src/lib/auth.ts` : e-mail + mot de passe, OAuth Google et GitHub (comptes liés), lien magique à usage unique
- Inscription fermée : `user.create.before` n'accepte qu'une adresse de `ADMIN_EMAILS` ou une invitation sponsor en cours, **dont la boîte est prouvée** : par le fournisseur OAuth, ou par le jeton via `POST /api/sponsor-invitation/:token/sign-up`, seule inscription par mot de passe d'un sponsor. Une adresse `ADMIN_EMAILS` n'a que l'OAuth (#674) et reçoit alors `ADMIN` ; sinon c'est `seed.ts` qui crée son compte au démarrage, vérifié et sans mot de passe, et le premier admin entre par lien magique, « Mot de passe oublié » ou OAuth. Tout le reste est refusé **avant** création, pour ne laisser aucune ligne orpheline (#362, #658)
- `requireEmailVerification` (#673) : `sign-up/email` répond le même 200 sans session, que l'adresse ait un compte, soit refusée ou en obtienne un ; un refus du hook ne lève plus d'erreur. Un mot de passe ne connecte qu'un compte `emailVerified` (403 sinon) ; un compte non vérifié entre par lien magique. Les seeds écrivent donc leurs comptes en base, vérifiés, sans passer par `signUpEmail`
- Le lien magique connecte à un compte existant, il n'en crée jamais (`disableSignUp`)
- Depuis better-auth 1.7, le premier lien magique d'un compte à `emailVerified = false` **efface son mot de passe et ses comptes liés**. Tout chemin qui prouve la boîte mail (acceptation d'invitation sponsor) doit poser `emailVerified` ; un nouveau type de compte aussi (#514)
- Les speakers n'ont pas de compte : ils passent par le lien `/edit/<token>`, valable 30 jours

- Agents IA (MCP, #514) : better-auth est aussi serveur OAuth (`mcp()` + `jwt()` + `cimd()`), connexion sur `/connect`, consentement sur `/connect/consent`, découverte sous `/.well-known/` à la racine. Pièges : `clientPrivileges`/`resourcePrivileges` à `false` (sinon tout compte connecté crée des clients OAuth) ; les listes optionnelles des tables OAuth sont en `Json?`, car une liste Prisma ne stocke pas `null` et le fournisseur lit `null` comme « sans restriction » (`lib/oauth-nullable-lists.ts`)
- Côté Claude Code, `.mcp.json` déclare les trois environnements (`devfest-prod`, `devfest-beta`, `devfest-dev-j`, adresses seules). Chacun se connecte par `/mcp` → Authenticate, avec son compte sur l'environnement visé (les bases ne sont pas partagées) ; le jeton reste sur sa machine. Contrôle : `GET /api/admin/session` répond le compte et `source: "mcp"`. Les écritures de `devfest-prod` touchent la prod directement : ne jamais ranger ses outils dans les permissions toujours accordées

## Authorization

- `User.role` : `ADMIN`, `EDITOR`, `SPONSOR`. **`EDITOR` est la valeur par défaut et ouvre le back-office** : tout compte tiers doit porter un rôle neutre explicite (`SPONSOR` n'accorde rien). À refaire à l'identique pour les speakers (#363). Contrôle : `select role, count(*) from "user" group by role;` — un compte tiers en `EDITOR` est un défaut
- Back-office : `requireAdmin` / `requireAdminRole` (`src/backend/src/lib/admin-guard.ts`), autorisation fine dans les handlers
- Espace sponsor : garde séparée `requireSponsorAccess(minimum)` sur `SponsorContact.accessRole` (`RESPONSABLE` > `EDITEUR` > `STAND`), dans `src/backend/src/lib/sponsor-guard.ts`
- better-auth supprime les champs qu'il ne connaît pas : `role` doit être déclaré dans `user.additionalFields` (`input: false`), sinon la valeur par défaut `EDITOR` s'impose sans erreur. Un test doit asserter le rôle **stocké**, pas l'appel du hook

Règles complètes : `.claude/rules/security.md`.
