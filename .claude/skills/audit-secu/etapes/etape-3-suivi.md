# Audit de sécurité, étape 3/3 : suivi GitHub

Cette étape est purement mécanique : tu recopies les textes de `.security-audit/findings.json` dans les gabarits fixes du dossier `gabarits/` de cette skill (`.claude/skills/audit-secu/gabarits/`). Tu **ne réécris pas**, ne reformules pas, n'ajoutes aucun détail technique et ne changes aucune sévérité. Si un champ manque, tu écris `À compléter` à sa place.

Dépôt cible : `GDGToulouse/Site-Devfest-Toulouse-2026` (dépôt public, j'en suis mainteneur).

## Prérequis

1. Lis `.security-audit/findings.json`. S'il est absent ou invalide, arrête-toi et affiche : « findings.json introuvable : lance d'abord `/audit-secu 2`. »
2. Vérifie `gh auth status`. Si non authentifié, arrête-toi et demande-moi de lancer `gh auth login`.
3. Date du jour au format `AAAA-MM-JJ`, notée `<DATE>` ci-dessous.

## Labels et milestones : ceux du projet

Aucun label ni milestone n'est créé : l'audit suit les règles du dépôt (`docs/cycle-de-vie-issues.md`). Le label `security` existe déjà ; ne le recrée pas et ne le modifie pas.

| Sévérité | Labels | Milestone |
|---|---|---|
| `critique`, `haute` | `security`, `bug`, `priorité haute` | `asap` |
| `moyenne` | `security`, `bug` | `next` |
| `basse`, `info` | `security` | aucun |

La sévérité exacte est écrite dans le corps de l'issue (gabarits). Le regroupement de l'audit est porté par l'issue de synthèse, pas par un milestone.

```bash
R=GDGToulouse/Site-Devfest-Toulouse-2026
mkdir -p .security-audit/tmp
```

## Validation avant publication

Le dépôt est public, et rien ne part sans accord (`.claude/rules/git-workflow.md`, opérations distantes). Prépare d'abord **tous** les fichiers dans `.security-audit/tmp/`, puis affiche un tableau `ID | sévérité | titre public | labels | milestone | advisory oui/non`, ainsi que le corps de chaque issue publique. Attends mon accord explicite avant le premier appel `gh` qui crée quelque chose.

Avant chaque création d'issue, vérifie qu'aucune issue ne contient déjà l'identifiant dans son titre (`gh issue list --repo $R --state all --search "<ID> in:title"`). Si elle existe, ne la recrée pas et réutilise son numéro.

## Pour chaque constat, dans l'ordre du fichier

Remplis le gabarit dans `.security-audit/tmp/<ID>-...` et passe-le avec `--body-file` ou `--input` (jamais en argument inline).

### Sévérité `critique` ou `haute`

1. **Advisory privé en brouillon** (visible seulement des mainteneurs) : remplis `gabarits/advisory.json` dans `.security-audit/tmp/<ID>-advisory.json`, puis
   `gh api --method POST repos/$R/security-advisories --input .security-audit/tmp/<ID>-advisory.json`
   Note le `ghsa_id` renvoyé. Si l'appel échoue (droits insuffisants, fonctionnalité désactivée), note `advisory : échec (<code HTTP>)` et continue : le détail reste dans `RAPPORT.md`.
2. **Issue publique neutre** avec `gabarits/issue-haute-critique.md` :
   `gh issue create --repo $R --title "[Sécu][<ID>] <titre_public>" --label security --label bug --label "priorité haute" --milestone asap --body-file .security-audit/tmp/<ID>-issue.md`

### Sévérité `moyenne`, `basse` ou `info`

Pas d'advisory. Issue publique avec `gabarits/issue-moyenne-basse.md`, même format de titre. Labels et milestone selon le tableau plus haut : `--label security --label bug --milestone next` pour `moyenne`, `--label security` seul pour `basse` et `info`.

Après chaque création, ajoute la ligne `<ID> | #<numéro> | <url> | <ghsa_id ou -> ` dans `.security-audit/suivi.md`.

## Issue de synthèse

Crée l'issue `[Sécu] Audit du <DATE> : synthèse` (label `security`, sans milestone) avec `gabarits/issue-synthese.md` : une ligne de case à cocher par issue, triées par sévérité décroissante. Aucun titre de vulnérabilité dans cette synthèse : seulement numéro, identifiant et sévérité.

## Fin

Affiche le contenu de `.security-audit/suivi.md`, l'URL de l'issue de synthèse et la liste des advisories en échec s'il y en a. Ne pousse aucun commit et n'ouvre aucune PR.
