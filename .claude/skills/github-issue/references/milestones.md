# Milestones « Lot N » — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Le périmètre initial du site est découpé en **5 lots** = 5 milestones GitHub. Un milestone mesure **la couverture du périmètre d'un lot** — pas une version, pas le flux de maintenance.

## D'abord : cette issue a-t-elle un milestone ?

> **Test** : *« peut-on déclarer le Lot terminé en laissant cette issue ouverte ? »*
>
> - **Non** → l'issue relève du périmètre du Lot → la rattacher (tableau ci-dessous).
>   Vaut aussi pour un **bug qui empêche la feature d'être « done »** (ex. #205, import
>   Sessionize incomplet → reste dans le Lot 2).
> - **Oui** → **pas de milestone**. C'est le cas des bugs et améliorations **découverts
>   après la livraison du Lot** (ex. #197 perf LCP, #133 césure — détachés du Lot 1).
>   Le label (`bug`, `enhancement`) suffit ; l'issue apparaîtra dans les notes de la
>   release qui l'embarque.

Ne **jamais** créer de milestone fourre-tout (`Backlog`, `v1.x`, `Maintenance`) : sans fin, la progression ne veut rien dire. Règle complète : [`.claude/rules/git-workflow.md`](../../../rules/git-workflow.md) § « Issues, milestones et versions ».

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

Les 5 lots ont désormais des issues. Les Lots 1 et 2 sont largement livrés — d'où la vigilance sur le test ci-dessus : les issues qui arrivent maintenant sur leur périmètre sont le plus souvent des **bugs post-livraison**, donc **sans milestone**.

Une fois un lot livré, son milestone se ferme et **ne se rouvre pas**. Ne pas y ranger de nouvelles issues pour « garder l'outil vivant ».
