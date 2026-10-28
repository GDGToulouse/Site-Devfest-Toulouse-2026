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
- Billetweb répond la plupart de ses erreurs (droits, quota) en **200** avec un champ `error` : tester la forme du corps, pas le statut. `/attendees` exclut les billets annulés sans `disabled=1`, et renvoie `disabled: "2"` pour une commande supprimée, valeur absente de sa doc : tout ce qui n'est pas `"0"` est annulé. Ses dates sont en heure murale de Paris, écrites avec une espace (`2026-09-01 10:00:00`) que `parseWallTime` ne lit pas telle quelle (#638). Tests en écriture sur l'événement caché « Test JDR Arrivées » (`src/backend/scripts/seed-billetweb-test-event.ts`), jamais sur le vrai
- L'appel Sessionize n'a pas de délai d'expiration
- Sessionize donne les horaires en heure murale de Paris, **sans fuseau** : les lire avec `parseWallTime` (`lib/zoned-time.ts`), jamais `new Date()`, le conteneur tourne en UTC. Ses salles ne portent pas nos noms : l'admin les associe une fois par édition (`SessionizeRoom`), et un réimport réécrit créneau et salle (#519). L'import liste ce qui a disparu de Sessionize sans rien modifier (#509)
