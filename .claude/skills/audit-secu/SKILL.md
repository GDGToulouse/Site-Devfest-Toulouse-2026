---
name: audit-secu
description: Audit de sécurité défensif du site DevFest Toulouse en 3 étapes (préparation, analyse multi-agents inspirée de Strix, suivi GitHub par advisories privés et issues). Lancement manuel uniquement.
argument-hint: "[1|2|2b|3]"
disable-model-invocation: true
---

# Audit de sécurité du dépôt Site-Devfest-Toulouse-2026

Argument reçu : `$ARGUMENTS`

## Aiguillage

Lis **uniquement** le fichier de l'étape demandée dans le dossier de cette skill (`.claude/skills/audit-secu/`) et applique-le intégralement :

| Argument | Fichier | Modèle |
|---|---|---|
| `1` | `etapes/etape-1-preparation.md` | Tout modèle (Opus 4.8 OK) |
| `2` | `etapes/etape-2-analyse.md` | **Opus 5.5 obligatoire** |
| `2b` | `etapes/etape-2b-consolidation.md` | Tout modèle (Opus 4.8 OK) : reprise de l'étape 2 après sa phase A |
| `3` | `etapes/etape-3-suivi.md` | Tout modèle (Opus 4.8 OK) |

Si l'argument est vide ou différent de `1`, `2`, `2b` ou `3`, n'exécute rien. Lis `.security-audit/01-etat.md`, `.security-audit/findings.json` et `.security-audit/suivi.md` s'ils existent, puis affiche :
- l'état de chaque étape (faite, à faire) ;
- la prochaine commande à lancer (`/audit-secu 1`, `/audit-secu 2` ou `/audit-secu 3`). Si `.security-audit/findings/` contient les huit fichiers d'agents mais que `findings.json` manque, la prochaine commande est `/audit-secu 2b`.

## Règles communes à toutes les étapes

- Je suis mainteneur de ce dépôt : c'est une revue défensive de **notre propre code**.
- Aucune requête de test hors `localhost` / `127.0.0.1`. La production `devfesttoulouse.fr` est hors périmètre.
- Aucune modification du code applicatif, aucun commit, aucune PR.
- Rien n'est publié sur GitHub (issue, advisory) sans mon accord explicite sur la liste préparée (étape 3). Labels et milestones : ceux du projet, aucun n'est créé.
- Tous les fichiers de travail vont dans `.security-audit/`, exclu de git via `.git/info/exclude`.
- Un secret trouvé n'est jamais utilisé et toujours masqué (4 premiers caractères puis `****`).
