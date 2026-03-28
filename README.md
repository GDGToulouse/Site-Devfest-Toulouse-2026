# Site DevFest Toulouse 2026

Nouveau site web pour le [DevFest Toulouse](https://devfesttoulouse.fr/), conçu pour remplacer le site WordPress (Avada) utilisé de 2023 à 2025 et perdurer dans le temps.

## Objectifs

- Site performant (Lighthouse ≥ 90, Core Web Vitals optimisés)
- Accessible (WCAG 2.1 AA)
- SEO complet (Schema.org, Open Graph, Twitter Cards)
- Gestion autonome par les sponsors et speakers de leurs fiches
- Historique de toutes les éditions (replays, speakers, sessions)

## Documentation

Les spécifications du projet sont dans le dossier `docs/` :

| Document | Description |
|----------|-------------|
| [fonctionnalites-2026.md](docs/fonctionnalites-2026.md) | Liste complète des fonctionnalités |
| [objectifs-techniques.md](docs/objectifs-techniques.md) | Objectifs techniques (rendu, performance, SEO, accessibilité) |
| [historique-sites.md](docs/historique-sites.md) | Analyse des sites des éditions passées (2016–2025) |
| [modele-donnees-historique.md](docs/modele-donnees-historique.md) | Modèle de données de `data/devfest-history.json` |
| [modele-donnees-metier.md](docs/modele-donnees-metier.md) | Modèle de données métier (entités, relations, bilingue) |
| [maquettes-figma.md](docs/maquettes-figma.md) | Inventaire des maquettes Figma et structure des pages |
| [design-system.md](docs/design-system.md) | Design system complet (charte, couleurs, typos, tokens, UI kit) |

## Données historiques

Le fichier `data/devfest-history.json` contient les données de 7 éditions (2016–2019, 2023–2025) : 327 speakers et 282 sessions.

## Licence

Voir [LICENSE](LICENSE).
