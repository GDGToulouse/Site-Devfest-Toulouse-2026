# Plan — API publique (OpenAPI) + jetons d'API

> **Statut** : proposition, à valider.
> **Date** : 2026-04-16
> **Contexte** : le backend Fastify est actuellement consommé uniquement par le frontend Next.js via cookies de session. On veut ouvrir une API REST documentée + permettre la création de jetons d'API par utilisateur.

---

## Objectifs

1. **API REST documentée** via OpenAPI/Swagger, accessible à tout consommateur externe (partenaires, mobile, scripts d'import, lecture publique…).
2. **Jetons d'API** créés et révoqués par chaque utilisateur (ADMIN ou EDITOR), avec **les mêmes droits que leur propriétaire**.
3. **Vue d'ensemble admin** : les administrateurs voient tous les jetons de tous les utilisateurs et peuvent les révoquer.

## Principes de conception

- **Simplicité d'abord**, raffinements plus tard (rate-limit granulaire, scopes fins, rotation automatique, audit log avancé).
- **Sécurité par défaut** : hash sécurisé des jetons, préfixe visible, clé montrée **une seule fois** à la création.
- **Un seul middleware d'auth** : les routes acceptent indifféremment cookie session ou `Authorization: Bearer <token>`. Le reste du code (guards, contrôleurs) ne voit que `request.user` et `request.user.role`, comme aujourd'hui.
- **Pas de scopes granulaires** dans la v1 : le jeton **hérite du rôle** de son propriétaire. Si l'utilisateur est rétrogradé, ses jetons perdent automatiquement les droits associés.

---

## Lot A — API documentée (OpenAPI / Swagger)

### A1. Ajouter `@fastify/swagger` + UI

- Dépendances : `@fastify/swagger`, `@fastify/swagger-ui` (ou `@scalar/fastify-api-reference` si UI plus moderne souhaitée).
- Route `/api/docs` → UI interactive (publique ou verrouillée, cf. A4).
- Route `/api/openapi.json` → spec JSON brute.
- Métadonnées : titre "DevFest Toulouse 2026 API", version lue depuis `package.json`, description, contact (email contact).

### A2. Annoter les routes existantes avec des schémas JSON Schema

Fastify utilise déjà JSON Schema pour la validation runtime → **double bénéfice**. Pour chaque route (fichiers `src/backend/src/routes/*.ts`), ajouter :

```ts
app.get("/api/editions/current", {
  schema: {
    tags: ["editions"],
    summary: "Édition actuelle mise en avant",
    response: {
      200: { $ref: "Edition#" },
      404: { $ref: "Error#" },
    },
  },
}, handler);
```

Ordre d'annotation proposé (du plus public au plus interne) :
1. **Public lecture** : `editions`, `articles`, `pages`, `settings`, `contact`, `auth/providers`, `health`.
2. **Admin** : `admin/editions`, `admin/articles`, `admin/pages`, `admin/users`, etc.
3. **Auth** : `/api/auth/*` — déjà géré par Better Auth, à documenter en "passe-plat" ou laisser hors de l'OpenAPI.

Schémas réutilisables extraits dans `src/backend/src/schemas/` (Edition, Article, Page, User, Error…). Utiliser `app.addSchema(...)` au démarrage.

### A3. Tagger les routes

Tags proposés : `health`, `editions`, `articles`, `pages`, `settings`, `contact`, `admin-editions`, `admin-articles`, `admin-pages`, `admin-users`, `admin-settings`, `auth`, `api-keys` (pour le lot B).

Ça permettra à la doc UI de regrouper les endpoints par thème.

### A4. Exposition de la doc

**Proposition** : `/api/docs` publique (pour faciliter l'adoption) **mais** l'OpenAPI ne liste **que les routes publiques** + mentionne l'existence des routes admin (sans les détailler ou derrière un toggle). Pour voir la doc admin complète, auth requise.

→ Implémentation : deux instances Swagger, filtrées par tag. Ou une seule spec avec un paramètre `?include=admin` qui nécessite une session.

### A5. CI

- Ajouter un check qui valide que chaque route définit un `schema` OpenAPI (lint custom ou règle simple).
- Publier la spec en artefact Coolify/GitHub Actions pour téléchargement.

---

## Lot B — Jetons d'API

### B1. Schéma Prisma

Ajouter un modèle `ApiKey` et migrer :

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Nom libre donné par l'utilisateur
  name        String

  // Prefix visible (ex. "dft_live_ab12") — permet de reconnaître la clé dans les logs
  // et de l'afficher à l'utilisateur après création (la clé complète n'est jamais ré-affichée)
  prefix      String    @unique

  // Hash de la clé secrète (argon2 ou bcrypt). Jamais la clé en clair.
  hashedKey   String

  // Métadonnées
  lastUsedAt  DateTime?
  expiresAt   DateTime? // null = ne jamais expirer
  revokedAt   DateTime? // null = active

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId])
  @@index([prefix])
}
```

Note : **pas de champ `role` ni `scopes`** — le jeton hérite dynamiquement du rôle de son `user` au moment de chaque requête. Si l'admin passe en EDITOR, tous ses jetons deviennent instantanément EDITOR.

### B2. Format de la clé

Pattern : `dft_<env>_<random>`.

- `dft_` → préfixe projet.
- `<env>` → `live` (prod), `beta`, `dev` (dev-j, dev). Identifie visuellement l'environnement.
- `<random>` → 32+ caractères alphanumériques cryptographiques (`crypto.randomBytes(32).toString("base64url")`).

Exemple : `dft_live_K8xQ2mZpV4nW7rJhBvTdY6LsCfNaGeDu`.

**Stockage** :
- `prefix` = `dft_live_K8xQ2mZp` (12 caractères visibles pour identification).
- `hashedKey` = hash de la clé complète.

### B3. Middleware d'auth unifié

Remplacer/compléter `admin-guard.ts` par un middleware qui essaie **deux stratégies** :

1. **Cookie session** (code actuel via Better Auth).
2. **Bearer token** : parse `Authorization: Bearer dft_...`, cherche par `prefix`, vérifie le hash, charge `user` lié, vérifie `revokedAt` + `expiresAt`, met à jour `lastUsedAt` (throttled pour pas spammer la DB → update si > 1 minute depuis le dernier).

Le reste du code (guards `requireAdmin`, `requireAdminRole`) reste identique : il lit `request.user` peu importe d'où il vient.

### B4. Routes CRUD API keys

Sous `/api/me/api-keys` (utilisateur courant) :

| Méthode | Chemin | Rôle | Description |
|---------|--------|------|-------------|
| `GET` | `/api/me/api-keys` | tous authentifiés | Liste ses propres clés (sans `hashedKey`, sans la valeur) |
| `POST` | `/api/me/api-keys` | tous authentifiés | Crée une clé (body : `name`, `expiresAt?`). **Réponse unique** contenant la clé en clair — jamais plus jamais exposée. |
| `DELETE` | `/api/me/api-keys/:id` | tous authentifiés | Révoque sa propre clé (set `revokedAt`) |

Sous `/api/admin/api-keys` (vue admin) :

| Méthode | Chemin | Rôle | Description |
|---------|--------|------|-------------|
| `GET` | `/api/admin/api-keys` | ADMIN | Liste **toutes** les clés, avec user associé, filtres (user, statut, expiration) |
| `DELETE` | `/api/admin/api-keys/:id` | ADMIN | Révoque n'importe quelle clé |

### B5. UI back-office

**Page `/admin/profile`** : ajouter une section "Mes jetons d'API" — liste, bouton "Nouveau jeton", dialogue de création, affichage one-shot de la clé générée (avec bouton "Copier"), bouton "Révoquer" par ligne.

**Page `/admin/api-keys`** (ADMIN-only) : vue d'ensemble de toutes les clés (table triable, filtres, révocation).

### B6. Rate-limit

Dans la v1, garder le rate-limit global existant par IP (200 req/min). Backlog : rate-limit par clé (ex. 1000 req/min par clé, paramétrable).

### B7. Documentation OpenAPI

Documenter les endpoints `/api/me/api-keys` et `/api/admin/api-keys` avec tag `api-keys`. Ajouter dans la description générale de l'API un bloc expliquant comment utiliser `Authorization: Bearer dft_...`.

---

## Lot C — Documentation & finitions

### C1. Guide utilisateur

Créer `docs/api-publique.md` avec :
- Comment obtenir un jeton.
- Exemples `curl` pour les endpoints les plus courants (lister les éditions, publier un article, récupérer les sponsors).
- Bonnes pratiques : rotation, révocation, scope par rôle.
- Lien vers `/api/docs`.

### C2. README

Ajouter une section "API publique" en tête du README avec le lien vers la doc.

### C3. Versioning

Dans la v1, rester sur `/api/*` sans version. Dès qu'un breaking change pointe, introduire `/api/v2/*` et documenter la politique de dépréciation.

---

## Sécurité

- **Hash des clés** : argon2 (via `@node-rs/argon2` ou `argon2`) plutôt que bcrypt — meilleur pour les chaînes aléatoires longues.
- **Comparaison constante** : `crypto.timingSafeEqual` sur les comparaisons (ou argon2 `verify` qui gère ça).
- **Révocation instantanée** : chaque requête recharge le `revokedAt`/`expiresAt` depuis la DB (pas de cache en mémoire en v1).
- **Audit basique** : `lastUsedAt` mis à jour à chaque requête (throttled). Backlog : table `ApiKeyUsage` avec timestamp + endpoint + status pour audit complet.
- **Rate-limit fail-safe** : garder la limite par IP même avec token (défense en profondeur).
- **Limite de jetons actifs par user** : v1 → illimité. Backlog : max 20 par user (soft) configurable.

---

## Plan de livraison

| Étape | Contenu | Taille |
|-------|---------|--------|
| PR 1 | Lot A1 + A2 (Swagger + annotations des routes publiques) | M |
| PR 2 | Lot A2 (suite) : annotations routes admin | M |
| PR 3 | Lot A3 + A4 (tags + exposition filtrée) | S |
| PR 4 | Lot B1 + B2 + B3 : schéma Prisma + auth middleware | L |
| PR 5 | Lot B4 : routes CRUD `/api/me/api-keys` + `/api/admin/api-keys` | M |
| PR 6 | Lot B5 : UI profile + page admin | M |
| PR 7 | Lot B7 : documentation OpenAPI des endpoints API keys | S |
| PR 8 | Lot C : guide utilisateur + README | S |

**Total estimé** : ~2 semaines à plein temps pour un dev seul, ~3-4 semaines en temps partiel.

---

## Idées pour plus tard (backlog explicite)

Les points suivants sont **volontairement hors scope v1** mais notés pour ne pas être perdus :

- **Scopes granulaires** par token (`read:editions`, `write:articles`, `admin:users`…) en plus du rôle.
- **Rate-limit par clé** (configurable par clé ou par rôle).
- **Rotation automatique** : expiration obligatoire par défaut (ex. 90 jours) avec warning email avant expiration.
- **Audit log complet** : table `ApiKeyUsage` (timestamp, endpoint, status, IP). Exposable à l'utilisateur.
- **Limite de jetons actifs** : max N par user.
- **Webhooks sortants** signés avec secret partagé (différent des API keys).
- **OAuth client credentials** pour les intégrations serveur-à-serveur (alternative aux API keys pour les partenaires majeurs).
- **CORS par clé** : restreindre les origines autorisées pour une clé donnée.
- **IP allowlist** par clé.
- **Preview / introspection de clé** : endpoint `GET /api/me/api-keys/whoami` qui confirme ce que le token peut faire.
- **Spec OpenAPI → SDK client** : génération de clients TypeScript / Python via `openapi-typescript` ou `openapi-generator`.
- **Versioning de l'API** (v1, v2) avec politique de dépréciation documentée.
- **GraphQL en parallèle** si certains consommateurs ont besoin de requêtes complexes.

---

## Impact sur l'existant

- **Zéro breaking change** côté frontend : le frontend continue d'utiliser les cookies. Le nouveau middleware d'auth est additif.
- **Migration Prisma** : ajout du modèle `ApiKey`, rien de destructif.
- **Variables d'environnement** : aucune nouvelle requise (on utilise les secrets existants pour le hash).
- **Infrastructure** : aucune nouvelle dépendance externe (pas de service tiers).
