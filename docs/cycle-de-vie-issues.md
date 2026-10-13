# Cycle de vie d'une issue

À lire quand on ferme, étiquette ou rattache une issue — pas avant. La mise en production
elle-même est couverte par la skill `deploy-to-prod`, qui construit le bloc `Closes` de la PR de
promotion.

## Issues, milestones et versions

Trois outils, trois questions distinctes — ne pas les mélanger.

| Outil | Répond à | Se ferme quand |
|-------|----------|----------------|
| **Milestone** (`asap`, `next`, `next-year`) | Est-elle pour la prochaine édition ? | `asap` : à l'édition ; les deux autres restent ouverts |
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

Le développement se fait au fil de l'eau, sans planning daté. Une seule date compte : celle
de la prochaine édition. Les milestones rangent les issues par rapport à elle.

| Milestone | Sens | Ordre |
|---|---|---|
| `asap` | **Engagé** pour la prochaine édition : le contenu des prochaines versions, en prod avant l'édition | Traité en premier ; échéance = date de l'édition |
| `next` | **Si possible** pour la prochaine édition, sinon tant pis, ce sera plus tard | Une fois `asap` vidé, dans l'ordre des labels de priorité |
| `next-year` | **Pas pour la prochaine édition** : trop lourd, trop risqué juste avant, ou inutile avant | Ne pas y toucher avant l'édition |
| *(aucun)* | Pas encore planifiée | À ranger lors de la qualification |

- Test : « est-ce pour cette édition ? » Oui, on s'y engage → `asap`. Si possible, sans
  garantie → `next`. Non → `next-year`. Ne sait pas encore → aucun.
- `asap` n'est pas réservé à ce qui sert le jour J : une amélioration d'admin y a sa place si
  on s'engage à la livrer avant l'édition. Une issue dont on ne sait pas encore si elle sera
  faite cette année va dans `next`, pas dans `asap`.
- Le milestone dit **quand**, le label de priorité (`priorité haute`, `priorité très faible`)
  dit **dans quel ordre** à l'intérieur de `next` et `next-year`.
- Un bug suit la même règle : il va dans `asap` s'il gêne l'édition.
- Ces trois milestones sont les seuls. Pas de milestone par version (les releases et le
  CHANGELOG le disent déjà), pas de fourre-tout (`Backlog`, `Maintenance`).
- Après l'édition, `asap` et `next-year` changent de sens : le classement est repris à ce
  moment-là.
- Les milestones `Lot 1` à `Lot 5` décrivent le découpage du périmètre initial de 2026
  (`docs/priorisation-developpement.md`) ; on n'y range plus de nouvelle issue.
