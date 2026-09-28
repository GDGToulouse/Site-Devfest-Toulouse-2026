# Backlog

## Supports

| Support | Authority for | Role |
| --- | --- | --- |
| GitHub Issues | issues, labels, milestones | tout le travail planifié et les bugs |
| GitHub Releases + `CHANGELOG.md` | ce qui est parti en prod, et quand | historique des livraisons |

## Representation

| Artifact | Support | Native representation |
| --- | --- | --- |
| Lot de développement | GitHub Issues | milestone `Lot N` |
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

- Priority: lots de développement et rétroplanning, `docs/priorisation-developpement.md`
- Milestone: seulement si l'issue appartient au périmètre du lot ; jamais de milestone fourre-tout (`Backlog`, `v1.x`)

## Relations

- Cross-support: une PR feature écrit `Refs #N` (ne ferme rien) ; seule la PR de promotion vers `main` écrit `Closes #N`

Règles complètes : `docs/cycle-de-vie-issues.md`. Rédaction et qualification : skills `github-issue` et `qualify-issue`.
