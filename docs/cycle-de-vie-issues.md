# Cycle de vie d'une issue

À lire quand on ferme, étiquette ou rattache une issue — pas avant. La mise en production
elle-même est couverte par la skill `deploy-to-prod`, qui construit le bloc `Closes` de la PR de
promotion.

## Issues, milestones et versions

Trois outils, trois questions distinctes — ne pas les mélanger.

| Outil | Répond à | Se ferme quand |
|-------|----------|----------------|
| **Milestone « Lot N »** | Le périmètre initial est-il couvert ? | Toutes ses issues sont faites |
| **Release `vX.Y.Z`** | Qu'est-ce qui est parti en prod, et quand ? | Le tag est poussé |
| **Label** (`bug`, `enhancement`…) | De quoi s'agit-il ? | — (filtre, pas compteur) |

### Fermeture des issues

`main` est la branche par défaut : GitHub n'honore les mots-clés de fermeture
(`Closes`, `Fixes`) que sur une PR mergée **dans `main`**. Une PR feature mergée
dans `dev-{initiale}` ne ferme donc **rien**.

- **PR feature → `dev-{initiale}`** : écrire `Refs #123` (lie sans fermer).
- **PR de promotion `dev → main`** : écrire `Closes #123` pour **chaque** issue
  embarquée. Les issues se ferment ainsi au moment exact de la mise en prod.

Les PRs vers `dev` et `main` étant **squashées**, les SHA d'origine disparaissent :
la PR de promotion est le **seul** endroit fiable pour porter les `Closes`. La skill
`deploy-to-prod` collecte les `Refs #` du diff `main..dev` pour construire ce bloc.

### Label `corrigé` — suivi entre le merge et la prod

Une issue corrigée reste **ouverte** jusqu'à la mise en prod (cf. ci-dessus). Sans marqueur,
elle apparaît comme « à faire » alors que le travail est fait. D'où le label `corrigé`.

**Dès l'arrivée du correctif sur `dev-{initiale}`** (merge de la branche feature, ou commit
direct), pour chaque issue traitée :

1. Poser le label `corrigé` sur l'issue.
2. **Commenter l'issue** en citant le ou les commits qui la corrigent (SHA court + sujet).
   Le commentaire porte le *quand* et le *quoi* ; le label ne sert qu'à filtrer.

```bash
gh issue edit <NN> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --add-label "corrigé"
gh issue comment <NN> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --body-file - <<'EOF'
**Corrigé** — mergé sur `dev-j`, en attente de mise en production.

- `<sha>` — `<sujet du commit>`

L'issue sera fermée automatiquement lors de la promotion `dev → main` (release).
EOF
```

> Le label dit que **le correctif est écrit et mergé sur la branche de dev** — pas qu'il est
> déployé en beta ni en prod. C'est voulu : il décrit l'état de l'issue, qui ne change plus.
> L'environnement, lui, se lit dans les branches (`main..dev`) et les releases.

Filtres GitHub correspondants :

| Recherche | Donne |
|---|---|
| `is:issue is:open -label:corrigé` | **Ce qu'il reste à corriger** |
| `is:issue is:open label:corrigé` | Corrigé, en attente de mise en prod |

Le label **n'est jamais retiré** : il décrit l'état de l'issue (`corrigé`), pas un
environnement. À la release, l'issue se ferme via `Closes` et le label reste vrai.

### Rattachement au milestone

- Une issue va dans un milestone **seulement si elle appartient au périmètre du Lot** —
  y compris un bug qui empêche de déclarer le Lot terminé.
- Un **bug ou une amélioration découverts après la livraison du Lot** n'ont **pas**
  de milestone : ils portent un label (`bug`, `enhancement`) et apparaissent dans les
  notes de la release qui les embarque.
- Test : « peut-on déclarer le Lot terminé en laissant cette issue ouverte ? »
  Oui → pas de milestone. Non → milestone.
- Ne **jamais** créer de milestone fourre-tout permanent (`Backlog`, `v1.x`,
  `Maintenance`) : sans fin, la barre de progression ne veut rien dire. Utiliser un label.
