# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnement sémantique](https://semver.org/lang/fr/).

Chaque version correspond à une **mise en production** (tag `vX.Y.Z` + release
GitHub). Voir [`docs/mise-en-production.md`](docs/mise-en-production.md).

## [Non publié]

_Changements mergés sur `dev` (beta), pas encore en production._

## [1.2.0] - 2026-07-14

Première grande vague de contenu et de sécurité : le Lot 2 complet (speakers,
sessions, sponsors), le durcissement du lien de modification avant son ouverture
aux intervenants, et une série de correctifs de performance et de SEO.

### Ajouté

- **Lot 2 — Speakers, Sessions & Sponsors** : CRUD complet, vues transverses
  « Données », page édition en synthèse avec raccourcis vers les fiches, sélection
  multiple et actions groupées (#121, #122, #201).
- **Langue de contact** des speakers et sponsors : emails du lien de modification
  et page `/edit/[token]` rendus dans la langue du destinataire (FR/EN), pilotée
  par un champ dans l'admin (#224).
- **Monitoring** : Core Web Vitals réels envoyés à Plausible + alertes des erreurs
  5xx par webhook (#118).
- **Rotation nocturne des speakers à la une** : tirage aléatoire chaque nuit (#214).
- **Pages « éditions précédentes »** hébergeant l'historique des conférences (#63).
- **Import Sessionize** des avatars de speakers, rapatriés dans `/uploads/` (#205).
- Nav « Conférences » et liste publique des sessions de l'édition (#203, #207).

### Corrigé

- **Sécurité — durcissement du lien de modification** (#223) : `PUT /api/edit/:token`
  était le seul endpoint non authentifié écrivant en base et rendu sur les pages
  publiques, sans aucune validation. Une URL `javascript:` y passait jusqu'à un
  `href` public. Ajout d'un schéma de corps, d'une allowlist des protocoles d'URL,
  d'une whitelist des liens sociaux, d'un rate limit dédié, d'une expiration des
  tokens à 30 jours et d'un envoi transactionnel de l'email.
- **Performance — LCP à 20,6 s** sur la home : l'image du hero (3,4 Mo servis bruts)
  passe par `next/image`, soit **44 Ko en AVIF sur mobile, 76× plus léger** (#197).
- **SEO — Schema.org Event** : retrait du `superEvent` invalide (2 erreurs critiques
  en Search Console) et ajout des champs recommandés (#185).
- **SEO — image OG** : l'image générée écrasait l'`og:image` personnalisée de
  l'admin ; elle est désormais respectée (#183).
- **Billetterie** : le statut des billets Billetweb n'était pas correctement mis à
  jour et n'était pas modifiable dans l'admin (#161).
- Navigation vers tous les articles d'une édition archivée (#178).
- Purge du cache admin : le backend renvoyait un contrat incohérent, l'UI affichait
  « Erreur » à tort (#181).
- Césure du mot « dev » qui revenait à la ligne (#133).

### Modifié

- Refonte de la sidebar admin (groupes + édition en cours) (#120).
- Densification de l'espacement vertical des sections de la home (#135).

## [1.1.3] - 2026-07-10

Correctif d'infrastructure : prépare des déploiements sans coupure.

### Ajouté

- Sonde de vitalité `GET /api/healthz` côté site : répond `200` sans rendre de
  page ni appeler l'API, pour que la santé du site ne dépende pas de celle de
  l'API (#192).
- Healthchecks Docker sur les conteneurs du site et de l'API. Sans eux, Coolify
  ne pouvait pas savoir quand le nouveau conteneur était prêt : il arrêtait
  l'ancien d'abord et le site public renvoyait **503 pendant une minute à chaque
  déploiement**.

### Note

Le healthcheck est un **prérequis** : il faut encore activer *Zero Downtime
Deployment* sur l'application Coolify pour supprimer réellement les 503.

## [1.1.2] - 2026-07-09

Correctif d'infrastructure : permet à la production et à la bêta de cohabiter sur
le réseau Docker partagé sans se marcher dessus.

### Corrigé

- Les variables lues par `next build` (`BACKEND_URL`, `BASE_URL`,
  `NEXT_PUBLIC_PLAUSIBLE_SRC`) sont désormais passées en **arguments de build**.
  Faute de quoi le `routes-manifest.json` figeait la valeur par défaut du
  `Dockerfile` (`http://backend:4000`) au lieu de l'alias propre à
  l'environnement, et les *rewrites* Next.js pointaient sur le nom nu `backend`
  (#189).
- Conséquence de ce défaut, apparue lorsque les deux backends ont rejoint le
  réseau partagé `coolify` : ils répondaient tous deux au nom `backend`, et la
  **production servait des requêtes depuis la base de données de la bêta**.

## [1.1.1] - 2026-07-09

Correctif d'infrastructure : rétablit l'envoi des emails, cassé en production
depuis un redéploiement.

### Corrigé

- Le backend n'était pas rattaché au réseau Docker partagé `coolify` : le service
  `postfix` ne résolvait plus et **tout envoi d'email échouait** (formulaire de
  contact, réinitialisation de mot de passe, liens de modification). Une clé
  `coolify:` nue sous le `networks:` d'un service se sérialise en `coolify: null`,
  et Compose ignore alors silencieusement le rattachement (#184).
- L'alias réseau propre à l'environnement est désormais posé sur le réseau partagé
  `coolify` — et non plus sur `default`, qui est privé au stack et n'y protégeait
  de rien — évitant la collision avec le backend des autres projets Coolify.

## [1.1.0] - 2026-07-07

Alignement de la production sur la beta : promotion du travail accumulé sur `dev`
et des correctifs récents.

### Ajouté

- Billetterie : synchronisation du statut « épuisé » depuis Billetweb + possibilité
  de forcer manuellement le statut d'un tarif dans l'admin (#161).
- Admin : badge de version + environnement (`vX.Y.Z · env`) dans la sidebar (#171).
- Procédure de mise en production versionnée : `CHANGELOG`, tags/releases, skill
  `deploy-to-prod`, garde-fous (rollback, backup, smoke tests) (#171, #176).

### Corrigé

- Actualités : pagination par 12 pour remplir la grille 4 colonnes (#165).
- Admin : possibilité de vider les champs optionnels d'une édition (#166).
- Éditeur : préfixe `https://` sur les liens sans schéma pour éviter les liens
  relatifs cassés (#167).
- SEO : la beta reste hors Google mais redevient partageable sur les réseaux
  sociaux (aperçu Open Graph) (#169).

### Modifié

- Documentation de mise en production enrichie (versioning, rollback, backup,
  fenêtre de déploiement, smoke tests, migration de données opt-in).

## [1.0.0] - 2026-07-06

Première mise en production du site DevFest Toulouse 2026, en remplacement de
l'ancien site WordPress.

### Ajouté

- Site public bilingue (FR/EN) : accueil, actualités, billetterie, sponsors,
  éditions passées, contact, pages de contenu.
- Back-office admin complet : éditions, articles, pages, billetterie, messages
  de contact, utilisateurs, clés API, paramètres.
- SSR + cache HTTP, SEO (Schema.org, Open Graph), accessibilité (WCAG 2.1 AA).
- Authentification admin (better-auth : email/password + Google + GitHub).

[Non publié]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.3...dev
[1.1.3]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/releases/tag/v1.0.0
