# Integration

## External services

- **Sessionize** : import du programme depuis l'admin (`src/backend/src/lib/sessionize-import.ts`), par URL d'API ou JSON collé
- **Billetweb** : billetterie ; l'admin importe les tarifs et lit les disponibilités par l'API (`src/backend/src/routes/admin/tickets.ts`), avec `BILLETWEB_USER` et `BILLETWEB_KEY` — absentes de `.env.example`
- **OpenStreetMap** : tuiles de la carte du lieu, via Leaflet (`src/frontend/src/components/venue/`)
- **Google Gemini** (free tier) : traduction FR ⇄ EN proposée aux éditeurs (`src/backend/src/lib/translation/`) ; en free tier Google peut entraîner ses modèles sur les données envoyées, donc aucune donnée personnelle n'y passe — `docs/traduction-ia.md`
- **SMTP** : e-mails transactionnels (liens magiques, invitations sponsor, liens de modification) via Nodemailer (`src/backend/src/lib/email.ts`) ; MailHog en local
- **Webhooks sortants** : soumissions du formulaire de contact (`contact-webhook.ts`, consommé par n8n/Zapier/Make — le format du payload est un contrat) et alertes sur erreur 5xx (`alert-webhook.ts`, #118). URL stockée dans `SiteSetting`
- **Plausible** : mesure d'audience en production, script chargé par `next-plausible` quand `NEXT_PUBLIC_PLAUSIBLE_SRC` est défini
- **YouTube** : replays en façade (`YouTubeFacade.tsx`), miniatures servies par l'optimiseur d'images Next plutôt que chargées depuis Google

## Calling conventions

- Toute URL saisie dans l'admin (webhook, import Sessionize) passe par `validateWebhookUrl` avant le fetch : rejet des hôtes privés, loopback et link-local, contre le SSRF sur le réseau Coolify partagé (#306)
- Les webhooks ont un délai de 10 s et ne lèvent jamais d'erreur ; les alertes sont dédupliquées par signature sur 5 min, en mémoire
- Gemini : quotas RPM/RPD/TPM tenus par un token bucket en mémoire ; un 429 remonte en `quota_exhausted` avec `Retry-After`
- L'appel Sessionize n'a pas de délai d'expiration
