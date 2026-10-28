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
- Billetweb répond la plupart de ses erreurs (droits, quota) en **200** avec un champ `error` : tester la forme du corps, pas le statut. `/attendees` exclut les billets annulés sans `disabled=1`, et renvoie `disabled: "2"` pour une commande supprimée, valeur absente de sa doc : tout ce qui n'est pas `"0"` est annulé. Ses dates sont en heure murale de Paris, écrites avec une espace (`2026-09-01 10:00:00`) que `parseWallTime` ne lit pas telle quelle (#638). Tests en écriture sur l'événement caché « Test JDR Arrivées » (`src/backend/scripts/seed-billetweb-test-event.ts`), jamais sur le vrai. L'API ne crée ni champ ni formulaire (back-office seulement) ; `update_product` écrit bien un champ par billet non visible du participant (« Numéro de badge », id 196822 sur le compte), clé par **id** à l'écriture, mais `/attendees` le relit par **nom** dans `custom`, et l'absente tant qu'il n'a jamais été rempli. Une écriture avance le `last_update` du billet. `update_product` prend ~2 s par lot de 100 : l'écriture des numéros de badge (#639) tourne après la réponse 202, car le relais de Next coupe une requête à 30 s (`socket hang up`) pendant que le backend continue. `delete_order` veut `data: [id, …]` en entiers : un objet `{ id }` est ignoré **sans erreur**. Compostage (#642, `lib/billetweb-checkin.ts`) : `POST /event/{id}/check` avec `data: [{ id, used: 1, lane }]` répond `[{ product_id, state }]` pour les billets pris et omet un id inconnu sans erreur ; `used_date_unix` est **ignoré** (Billetweb garde l'heure de l'appel), et `used: 0` décomposte en gardant date et poste. Jamais sur le chemin du scan : relancé chaque minute par `node-cron` tant qu'il reste des billets scannés non acquittés
- L'appel Sessionize n'a pas de délai d'expiration
- Sessionize donne les horaires en heure murale de Paris, **sans fuseau** : les lire avec `parseWallTime` (`lib/zoned-time.ts`), jamais `new Date()`, le conteneur tourne en UTC. Ses salles ne portent pas nos noms : l'admin les associe une fois par édition (`SessionizeRoom`), et un réimport réécrit créneau et salle (#519). L'import liste ce qui a disparu de Sessionize sans rien modifier (#509)
