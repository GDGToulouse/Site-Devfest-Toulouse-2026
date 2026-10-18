# Milestones — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Un milestone dit si une issue est pour la **prochaine édition**, seule date du planning. Règle complète : [`docs/cycle-de-vie-issues.md`](../../../../docs/cycle-de-vie-issues.md) § « Rattachement au milestone ».

| Milestone | Sens |
|---|---|
| `asap` | **Engagé** pour la prochaine édition — le contenu des prochaines versions |
| `next` | **Si possible** pour la prochaine édition, sinon plus tard |
| `next-year` | **Pas pour la prochaine édition** |
| *(aucun)* | Pas encore planifiée |

## Choisir

> **Test** : *« est-ce pour cette édition ? »*
>
> - **Oui, on s'y engage** → `asap` (un bug qui gêne l'édition aussi). Pas réservé au jour J : une amélioration d'admin y va si on s'engage à la livrer.
> - **Si possible, sans garantie** → `next` (ex. une fonctionnalité dont on ne sait pas encore si elle sera faite cette année).
> - **Non** (trop lourd, trop risqué juste avant le salon, inutile avant) → `next-year`.
> - **Ne sait pas** → aucun milestone, et le dire à l'utilisateur.

L'ordre à l'intérieur de `next` et `next-year` se règle par les labels de priorité (`priorité haute`, `priorité très faible`), pas par un autre milestone.

Le choix appartient à l'utilisateur : le proposer dans l'interview (« (Recommandé) » sur l'horizon qui découle du test), ne pas le décider seul.

## Interdits

- Créer un autre milestone : pas de milestone par version (les releases le disent déjà), pas de fourre-tout (`Backlog`, `Maintenance`).
- Ranger une nouvelle issue dans `Lot 1` à `Lot 5` : ils décrivent le périmètre initial 2026 et ne reçoivent plus rien.

Vérifier les intitulés exacts avant de poser un milestone :

```bash
gh api repos/GDGToulouse/Site-Devfest-Toulouse-2026/milestones --jq '.[].title'
```
