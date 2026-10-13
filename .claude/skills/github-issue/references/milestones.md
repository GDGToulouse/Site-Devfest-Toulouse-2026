# Milestones — repo `GDGToulouse/Site-Devfest-Toulouse-2026`

Un milestone dit **quand** livrer une issue par rapport à la **prochaine édition**, seule date du planning. Règle complète : [`docs/cycle-de-vie-issues.md`](../../../../docs/cycle-de-vie-issues.md) § « Rattachement au milestone ».

| Milestone | Sens |
|---|---|
| `asap` | Doit être en prod **avant** la prochaine édition — le contenu des prochaines versions |
| `next` | À livrer bientôt, sans lien avec la date de l'édition |
| `next-year` | À livrer **après** la prochaine édition |
| *(aucun)* | Pas encore planifiée |

## Choisir

> **Test** : *« faut-il que ce soit en prod le jour de l'édition ? »*
>
> - **Oui** → `asap` (un bug qui gêne l'édition aussi).
> - **Non, mais bientôt** → `next`.
> - **Non, et pas avant** (trop lourd, trop risqué juste avant le salon, inutile avant) → `next-year`.
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
