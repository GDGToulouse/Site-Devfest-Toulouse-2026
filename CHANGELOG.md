# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnement sémantique](https://semver.org/lang/fr/).

Chaque version correspond à une **mise en production** (tag `vX.Y.Z` + release
GitHub). Voir [`docs/mise-en-production.md`](docs/mise-en-production.md).

## [Non publié]

_Changements mergés sur `dev` (beta), pas encore en production._

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

[Non publié]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.0.0...dev
[1.0.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/releases/tag/v1.0.0
