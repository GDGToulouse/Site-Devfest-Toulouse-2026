# Backlog

## Supports

| Support | Authority for | Role |
| --- | --- | --- |
| GitHub Issues | issues, labels, milestones | tout le travail planifié et les bugs |
| GitHub Releases + `CHANGELOG.md` | ce qui est parti en prod, et quand | historique des livraisons |

## Representation

| Artifact | Support | Native representation |
| --- | --- | --- |
| Horizon de livraison | GitHub Issues | milestone `asap`, `next` ou `next-year` |
| Bug | GitHub Issues | label `bug` |
| Évolution | GitHub Issues | label `enhancement` |
| Doc / question | GitHub Issues | label `documentation`, `question` |

## Workflow

| Support | Native status | Meaning |
| --- | --- | --- |
| GitHub Issues | ouverte, sans `corrigé` | reste à faire |
| GitHub Issues | ouverte, label `corrigé` | correctif mergé sur `dev-{initiale}`, pas encore en prod |
| GitHub Issues | fermée | en production — fermée par le `Closes #` de la PR de promotion vers `main` |

## Planning

- Milestone: horizon par rapport à la prochaine édition, seule date de planning. `asap` = en prod avant l'édition (le contenu des prochaines versions), `next` = bientôt sans lien avec l'édition, `next-year` = après l'édition ; aucun = pas encore planifiée. Ni milestone par version, ni fourre-tout
- Priority: labels `priorité haute` / `priorité très faible`, pour l'ordre à l'intérieur d'un milestone
- Les milestones `Lot 1`-`Lot 5` sont le découpage du périmètre initial 2026 (`docs/priorisation-developpement.md`) : plus de nouvelle issue dedans

## Relations

- Cross-support: une PR feature écrit `Refs #N` (ne ferme rien) ; seule la PR de promotion vers `main` écrit `Closes #N`

Règles complètes : `docs/cycle-de-vie-issues.md`. Rédaction et qualification : skills `github-issue` et `qualify-issue`.
