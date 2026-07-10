# Milestones « Lot N » — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Le travail est découpé en **5 lots** = 5 milestones GitHub. **Rattacher chaque issue au bon Lot** est une convention forte de ce repo. En cas d'ambiguïté, demander à l'utilisateur.

Vérifier les intitulés exacts (ils peuvent évoluer) avant de poser un milestone :

```bash
gh api repos/GDGToulouse/Site-Devfest-Toulouse-2026/milestones --jq '.[].title'
```

## Les lots et leur périmètre

| Milestone | Périmètre | Exemples d'issues |
|---|---|---|
| **Lot 1 — Fondations & Billetterie** | Socle technique, home, billetterie, identité, contenu éditorial de base, écosystème, carrousel « Derrière le DevFest » | hero, billetterie, actualités, paramètres back-office, carrousel home |
| **Lot 2 — Speakers, Sessions & Sponsors** | Modèle de données + CRUD admin + pages publiques pour speakers, sessions/talks, sponsors, catégories ; liens de modification ; import Sessionize | CRUD speakers, page sponsor, OG dynamiques, import Sessionize |
| **Lot 3 — Programme** | Grille horaire par salle/track, sessions cliquables avec détail complet, filtres (niveau/format/langue/catégorie/recherche), export agenda (ICAL/PDF) | grille programme, filtres de sessions, export ICAL |
| **Lot 4 — Contenu complémentaire** | Pages éditions précédentes / historique, hall of replays, galerie photos, FAQ, équipe, infos pratiques, à propos | historique conférences, hall of replays, FAQ |
| **Lot 5 — Jour J** | Fonctionnalités temps réel le jour de l'événement (statut « en cours », live) | annonces live, statut jour J |

> Le périmètre exact de chaque lot dérive de [docs/fonctionnalites-2026.md](../../../docs/fonctionnalites-2026.md). Consulter ce fichier quand le rattachement n'est pas évident.

## Choisir le bon lot — heuristique

- La feature concerne **les données speakers/sessions/sponsors elles-mêmes** (modèle, CRUD, fiche) → **Lot 2**.
- La feature **exploite** ces données dans une **vue programme** (grille, filtres, agenda) → **Lot 3**.
- La feature **valorise l'historique** (éditions passées, replays, galerie) ou ajoute du **contenu annexe** (FAQ, équipe, infos pratiques) → **Lot 4**.
- La feature touche au **socle**, à la **home**, à la **billetterie** ou aux **réglages** → **Lot 1**.
- La feature est **temps réel le jour J** → **Lot 5**.

## Note

Les Lots 1, 2 et 4 ont déjà des issues livrées ; les Lots 3 et 5 sont encore vides (à décomposer le moment venu). Quand on crée la première issue d'un lot vide, c'est normal — pas besoin de demander confirmation du milestone pour autant, mais signaler que le lot démarre.
