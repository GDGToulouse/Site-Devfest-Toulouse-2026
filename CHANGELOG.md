# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnement sémantique](https://semver.org/lang/fr/).

Chaque version correspond à une **mise en production** (tag `vX.Y.Z` + release
GitHub). Voir [`docs/mise-en-production.md`](docs/mise-en-production.md).

## [Non publié]

_Changements mergés sur `dev` (beta), pas encore en production._

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

[Non publié]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.1...dev
[1.1.1]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/releases/tag/v1.0.0
