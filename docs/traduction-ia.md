# Traduction FR ⇄ EN assistée par IA

Fonctionnalité de confort permettant aux éditeurs de traduire un contenu d'une langue à l'autre via Google Gemini, depuis le back-office. La traduction est une **proposition éditable** : elle remplit le champ langue cible mais l'éditeur reste responsable de la relecture avant publication.

## Architecture

```
src/backend/src/
├── lib/translation/
│   ├── index.ts            entry point — orchestration translate()
│   ├── gemini-client.ts    appel REST vers Gemini (pas de SDK)
│   ├── prompts.ts          system + user prompts
│   ├── validator.ts        parité balises HTML / placeholders
│   ├── rate-limiter.ts     token bucket RPM/RPD/TPM en mémoire
│   ├── types.ts            interfaces TypeScript
│   └── errors.ts           TranslationError + QuotaExhaustedError
└── routes/admin/translate.ts   POST /api/admin/translate + GET /stats
```

Pas de cache séparé : la traduction renvoyée est sauvegardée directement dans le contenu de l'entité (cf. PR2 — flag `autoTranslated*` sur `Article`). Si l'éditeur reclique sur « Traduire », il refait un appel — c'est un choix explicite.

## Endpoint

### POST `/api/admin/translate`

Auth : `requireAdmin` (ADMIN ou EDITOR).

```json
{
  "content": "<p>Bonjour <strong>monde</strong></p>",
  "sourceLang": "fr",       // "fr" | "en" | "auto"
  "targetLang": "en",       // "fr" | "en"
  "format": "html",         // "html" | "markdown" | "plain"
  "quality": "fast",        // "fast" (Flash-Lite, défaut) | "high" (Flash)
  "glossary": {             // optionnel
    "DevFest": "DevFest",
    "AFUP": "AFUP"
  }
}
```

Réponse 200 :
```json
{
  "translatedContent": "<p>Hello <strong>world</strong></p>",
  "sourceLang": "fr",
  "targetLang": "en",
  "tokensUsed": { "input": 42, "output": 38 },
  "modelUsed": "gemini-2.5-flash-lite",
  "durationMs": 1234
}
```

Erreurs typées :

| HTTP | `error` | Quand |
|------|---------|-------|
| 400  | `invalid_input` | content vide, langues invalides, source = target |
| 413  | `content_too_large` | > 200 000 caractères |
| 422  | `tag_mismatch` / `placeholder_mismatch` | Validation post-traduction échouée 2 fois (modèle a cassé la structure) |
| 429  | `quota_exhausted` | Quota RPM/RPD/TPM saturé. Header `Retry-After` en secondes. |
| 502  | `upstream_error` | Erreur réseau ou erreur 5xx Gemini |
| 503  | `not_configured` | `GEMINI_API_KEY` non définie |

### GET `/api/admin/translate/stats`

Compteurs sur 24h et 7j, status breakdown, top 10 utilisateurs, snapshot du rate limiter (utilisé/limite RPM/RPD/TPM). Sert au dashboard admin pour surveiller la consommation.

## Modèles Gemini

| Quality | Modèle | Quota free tier | Usage |
|---------|--------|-----------------|-------|
| `fast` (défaut) | `gemini-2.5-flash-lite` | 15 RPM, 1000 RPD, 250K TPM | Traduction standard |
| `high`          | `gemini-2.5-flash` | 10 RPM, 250 RPD, 250K TPM | Boost qualité si Flash-Lite déçoit |

Les deux partagent un même `RateLimiter` mono-instance (token bucket en mémoire) configuré sur les limites Flash-Lite : c'est la garde-fou commune. Si on passe multi-instance, remplacer par Redis (interface volontairement minimaliste).

## Préservation du formatage

Le prompt système instruit le modèle à ne **jamais** modifier la structure (balises HTML, syntaxe Markdown, placeholders). Le validateur `validatePreservation()` compare ensuite, sur le résultat reçu :

- HTML : nombre d'occurrences de chaque nom de balise (insensible aux différences `<br>` vs `<br/>`)
- Markdown : nombre de liens `[text](url)`, images `![]()`, fences ` ``` `
- Tous formats : nombre de `{{var}}`, `{var}`, `%s`, `%d`, `${var}`

En cas d'écart, on retente **une fois** avec `temperature=0`. Si toujours KO → `tag_mismatch` / `placeholder_mismatch`.

## RGPD & confidentialité

⚠️ **Free tier Gemini** : les données envoyées peuvent être utilisées pour l'entraînement des modèles Google. Ne pas utiliser pour :

- contenu confidentiel (brouillons internes non destinés au public)
- données personnelles
- secrets, références internes, textes pré-publication sensibles

Pour notre usage (articles de blog, descriptions sponsors, contenu CMS public), c'est acceptable : tout ce qui passe par cet endpoint est destiné à être publié sur le site.

**Migration vers Tier 1 payant** si besoin un jour : 0,10 $/M tokens input sur Flash-Lite (= coût négligeable pour notre volume), garantit la non-utilisation des données pour training. Aucun changement de code requis : juste activer un compte de facturation sur la même clé API.

## Observabilité

Pas de Prometheus. À la place, table `TranslationLog` (un row par appel, succès et échec) lue par l'endpoint `/translate/stats`. Sur le long terme, ça permet :

- compteurs jour/semaine/mois sans relancer l'API
- répartition par status (`success`, `quota_exhausted`, `validation_error`, etc.)
- top utilisateurs (qui consomme le quota)
- hot path pour ajouter `/metrics` Prometheus si on en a besoin un jour

## Configuration

1. Récupérer une clé sur https://aistudio.google.com/apikey
2. Ajouter `GEMINI_API_KEY=AIzaSy...` à l'environnement Coolify (et dans `.env` local pour dev)
3. Sans cette variable, l'endpoint répond `503 not_configured` et le bouton UI est désactivé — c'est le mode "fonctionnalité éteinte" propre

## Backlog post-v1

- Étendre aux entités `ContentPage`, `Article` excerpts, descriptions de plans sponsor, descriptions de speakers, descriptions de sessions
- Cache Redis si on passe multi-instance backend
- Métriques Prometheus si besoin d'alerting global
- Glossaire stocké en BDD (table `TranslationGlossary` éditable depuis le back-office) plutôt que passé à chaque requête
- UI dashboard admin affichant le quota restant + courbe de consommation
