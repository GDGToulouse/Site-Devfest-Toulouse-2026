# API publique — DevFest Toulouse 2026

Le backend expose une API REST documentée via OpenAPI/Swagger, consommable par le site, une application mobile, ou tout client externe (partenaires, scripts, intégrations).

**URL de la doc interactive** : [`/api/docs`](https://devfesttoulouse.fr/api/docs) (Swagger UI)
**Spec JSON brute** : `/api/docs/json` (OpenAPI 3.0.3)

---

## Authentification

Deux mécanismes au choix, traités de manière équivalente par toutes les routes protégées :

| Méthode | Usage typique | Entête |
|---------|---------------|--------|
| **Cookie de session** | Back-office (navigateur, Better Auth) | Automatique après `/admin` login |
| **Jeton Bearer** | Scripts, apps mobiles, intégrations | `Authorization: Bearer dft_…` |

### Obtenir un jeton Bearer

1. Connectez-vous sur [`/admin`](https://devfesttoulouse.fr/admin) avec votre compte.
2. Allez sur **Mon profil** (icône en bas à gauche de la sidebar).
3. Section **Mes jetons d'API** → bouton **Nouveau jeton**.
4. Choisissez un nom descriptif, éventuellement une date d'expiration, puis **Créer**.
5. **Copiez la valeur affichée immédiatement** — elle ne sera plus jamais visible.

Format : `dft_<env>_<32 caractères base64url>` — par exemple `dft_live_K8xQ2mZpV4nW7rJhBvTdY6LsCfNaGeDu`.

### Révoquer un jeton

- **En tant qu'utilisateur** : `/admin/profile` → bouton **Révoquer** en face de la clé.
- **En tant qu'admin** : `/admin/api-keys` donne la vue d'ensemble de toutes les clés de tous les utilisateurs.

La révocation prend effet **immédiatement** — les requêtes en cours sont rejetées avec un `401`.

---

## Niveaux d'accès

Le jeton hérite **dynamiquement** du rôle de son propriétaire au moment de chaque requête.

| Rôle | Peut accéder à |
|------|----------------|
| `ADMIN` | Toutes les routes, y compris `/api/admin/*` (éditions, paramètres, utilisateurs). |
| `EDITOR` | Routes de contenu (articles, pages, fichiers, messages). Pas d'admin systèmes. |

Si un administrateur rétrograde un utilisateur à `EDITOR`, **tous ses jetons perdent instantanément les droits d'admin**. Aucune action supplémentaire n'est requise.

---

## Limites

| Limite | Valeur | Portée |
|--------|--------|--------|
| Rate-limit global | 200 requêtes / minute | Par IP |
| Rate-limit auth | 10 requêtes / minute | Par IP, sur `/api/auth/*` |
| Jetons actifs par utilisateur | 20 | Soft cap (les révoqués ne comptent pas) |

À venir : rate-limit par clé (au lieu par IP), scopes granulaires.

---

## Exemples `curl`

### Lire des ressources publiques (pas d'authentification)

```bash
curl https://devfesttoulouse.fr/api/editions
curl https://devfesttoulouse.fr/api/editions/current
curl https://devfesttoulouse.fr/api/articles/latest?limit=4
```

### Lire ses propres jetons d'API

```bash
curl -H "Authorization: Bearer dft_live_XXXXXXXX" \
     https://devfesttoulouse.fr/api/me/api-keys
```

### Créer un nouvel article (ADMIN ou EDITOR)

```bash
curl -X POST https://devfesttoulouse.fr/api/admin/articles \
  -H "Authorization: Bearer dft_live_XXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "exemple",
    "titleFr": "Titre FR",
    "titleEn": "Title EN",
    "contentFr": "…",
    "contentEn": "…",
    "status": "DRAFT"
  }'
```

### Poster un message de contact (public)

```bash
curl -X POST https://devfesttoulouse.fr/api/contact/send \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "category": "sponsoring",
    "message": "Bonjour, je souhaite sponsoriser l'\''édition 2026."
  }'
```

---

## Codes HTTP

| Code | Signification |
|------|---------------|
| `200` | Succès |
| `201` | Ressource créée |
| `400` | Requête invalide (validation body / query) |
| `401` | Non authentifié (aucun cookie ni Bearer valide) |
| `403` | Authentifié mais droits insuffisants |
| `404` | Ressource inexistante |
| `429` | Rate-limit atteint |
| `500` | Erreur serveur |

Les réponses d'erreur suivent le schéma :
```json
{ "error": "code_court", "message": "description optionnelle" }
```

---

## Bonnes pratiques

- **Ne versionnez pas vos jetons** dans un dépôt Git public. Traitez-les comme un mot de passe.
- **Rotez-les régulièrement** — créez-en un nouveau, basculez vos clients, révoquez l'ancien.
- **Préférez un jeton par application** (un pour le site, un pour le script d'import, etc.) pour pouvoir révoquer ponctuellement.
- **Utilisez la date d'expiration** pour les jetons courts (CI, scripts temporaires).
- **Ne loggez pas la valeur** d'un jeton dans vos systèmes d'observabilité.

---

## Liens utiles

- Documentation OpenAPI interactive : [`/api/docs`](https://devfesttoulouse.fr/api/docs)
- Plan de construction de l'API : [`docs/plan-api-publique-et-jetons.md`](plan-api-publique-et-jetons.md)
- Spécification métier du projet : [`docs/modele-donnees-metier.md`](modele-donnees-metier.md)
