---
name: qualify-issue
description: Qualifie techniquement une issue GitHub du repo GDGToulouse/Site-Devfest-Toulouse-2026 — investigue le code pour trouver la cause racine, poste un commentaire de qualification structuré (sans écraser le body), et pose OBLIGATOIREMENT les labels (type bug/enhancement + domaine). Trigger phrases — « qualifie l'issue #X », « qualifie l'issue X », « analyse l'issue #X », « investigue l'issue #X », « regarde les issues non qualifiées », « qualifie les bugs récents ». Ne PAS trigger pour juste lire/résumer/lister des issues.
---

# Qualification d'issue GitHub — repo DevFest Toulouse 2026

Objectif : transformer une issue laconique (souvent un simple constat utilisateur) en une **qualification technique** exploitable — cause racine identifiée dans le code, fichiers/lignes réels cités, correctif proposé, labels posés.

Repo cible : `GDGToulouse/Site-Devfest-Toulouse-2026`. CLI : `gh` (authentifiée). Langue : **français**.

La qualification **complète** l'issue via un commentaire — elle n'écrase **jamais** le body original (le constat du déclarant reste la référence).

## Règle absolue — les labels

**Toute issue qualifiée DOIT repartir avec ses labels posés.** C'est non négociable et fait partie de la définition de « qualifiée ». Une qualification sans label est incomplète. Voir Step 5 et [references/labels.md](references/labels.md).

---

## Pre-flight

Si l'utilisateur donne un numéro, lire l'issue et ses commentaires avant tout :

```bash
gh issue view <number> --comments
```

Si la demande est « regarde les issues non qualifiées » (sans numéro), lister d'abord les candidates :

```bash
gh issue list --state open --limit 50 --json number,title,comments,labels \
  --jq '.[] | "\(.number)\t[\(.comments|length)c \(.labels|length)L]\t\(.title)"'
```

Une issue est **non qualifiée** si elle n'a ni commentaire de qualification, ni label. Distinguer :
- **bugs / petites améliorations** récents → à qualifier (cœur de cette skill)
- **user stories de backlog** (specs de features à écrire) → relèvent plutôt de la rédaction de spec ; ne pas les qualifier sauf demande explicite.

En cas de lot, **confirmer le périmètre** avec l'utilisateur avant de lancer plusieurs investigations.

---

## Step 1 — Investiguer la cause racine

C'est le cœur du travail. Ne jamais qualifier sur des suppositions.

- Pour **une** issue : explorer directement (`Grep`, `Read`, `Glob`) ou lancer un agent `Explore`.
- Pour **plusieurs** issues indépendantes : lancer un agent `Explore` **par issue en parallèle** (un seul message, plusieurs `Agent`), chacun avec un prompt ciblé décrivant le symptôme et les pistes à vérifier.

Structure du repo (voir [CLAUDE.md](../../../CLAUDE.md)) :
- `src/frontend/` — Next.js (App Router) : `src/app/[locale]/`, `src/components/`, `src/lib/`, `messages/`
- `src/backend/` — Fastify : `src/routes/` (dont `routes/admin/`), `src/services/`, `src/lib/`, `prisma/schema.prisma`

**Vérifier toi-même les points critiques d'une investigation déléguée.** Un agent peut se tromper (ex. affirmer une règle CSS qui n'existe pas). Avant de citer une ligne comme cause racine, l'avoir lue — surtout quand l'agent signale lui-même une inférence.

Livrable de cette étape : une **cause racine confirmée**, avec `fichier:ligne` réels, et un correctif proposé.

## Step 2 — Déterminer les labels

À partir de la nature confirmée :
- **Type** (obligatoire, exactement 1) : `bug` si quelque chose est cassé, `enhancement` si c'est une amélioration/nouvelle fonctionnalité. `bug` et `enhancement` sont mutuellement exclusifs.
- **Domaine** (recommandé) : `frontend`, `backend`, `admin`, `i18n`, `seo`, `a11y`… selon le sous-système. Voir [references/labels.md](references/labels.md).
- **Flag** : `user-story` si l'issue décrit une US plutôt qu'un défaut ponctuel.

Si un label domaine pertinent n'existe pas encore, **proposer de le créer** (Step 5) plutôt que d'en coller un approximatif.

## Step 3 — (si nécessaire) Interviewer sur les choix ouverts

Si la qualification révèle une décision qui appartient à l'utilisateur (scope d'une amélioration, articulation de plusieurs comportements, ampleur d'un fix systémique), poser 1-3 questions via `AskUserQuestion` — options mutuellement exclusives, un « (Recommandé) » par défaut.

Ne pas bloquer sur des détails tranchables par un défaut raisonnable : choisir, le mentionner, continuer.

## Step 4 — Poster la qualification en commentaire

Rédiger le commentaire selon [templates/qualification.md](templates/qualification.md), puis poster via un **fichier** (le markdown multi-ligne passe mal en inline) écrit dans le scratchpad :

```bash
gh issue comment <number> --body-file "<scratchpad>/issue-<number>.md"
```

> Ne jamais construire le commentaire avec un heredoc combiné à `gh` dans un seul appel Bash (souvent bloqué par les permissions). Écrire le fichier avec l'outil `Write`, puis appeler `gh ... --body-file <chemin>`.

**Ne JAMAIS** appeler `gh issue edit --body …` : le body original est intouchable.

## Step 5 — Poser les labels (OBLIGATOIRE)

Vérifier que les labels existent, créer les manquants (après accord si c'est un nouveau domaine) :

```bash
gh label list --limit 100
gh label create "admin" --color "5319e7" --description "Interface d'administration"
```

Puis poser les labels sur l'issue :

```bash
gh issue edit <number> --add-label bug --add-label admin
```

Confirmer :

```bash
gh issue view <number> --json number,title,labels --jq '{n:.number, labels:[.labels[].name]}'
```

**Une issue qualifiée sans label posé n'est pas terminée** — revenir à cette étape avant de conclure.

## Step 6 — Récapituler

Pour un lot, présenter un tableau de synthèse (numéro, type, cause racine en une phrase, complexité) et lister les labels posés. Signaler :
- les **bugs systémiques** (une même cause touche plusieurs endroits — ex. un pattern répété sur tous les champs optionnels d'un formulaire) ;
- les **décisions en attente** (questions de scope non tranchées) ;
- toute erreur d'un agent que tu as corrigée (fiabilité).

---

## Conventions transverses

- **Langue** : français (code/commits en anglais, cf. CLAUDE.md).
- **Liens** : `[fichier.tsx](src/frontend/src/...)` ou `[fichier.ts:42](src/backend/src/...#L42)`, relatifs à la racine du repo ; `#NN` pour les issues liées.
- **Citer du code vérifié** : `Read`/`Grep` avant d'affirmer une ligne comme cause racine.
- **Pas de secrets** : jamais de tokens, mots de passe, `DATABASE_URL`, secrets OAuth/SMTP dans un commentaire.
- **Git** : commandes `gh`/`git` chacune dans son propre appel Bash, jamais chaînées avec `&&` ni `cd`.
- **Pas de signature** « Generated with Claude Code » dans les commentaires d'issue.

## What NOT to do

- **Ne pas conclure une qualification sans poser les labels** (Step 5) — c'est la règle qui a motivé cette skill.
- **Ne pas écraser le body** d'une issue (`gh issue edit --body` interdit).
- **Ne pas qualifier sur des suppositions** — cause racine vérifiée dans le code, ou dire explicitement ce qui reste incertain.
- **Ne pas faire aveuglément confiance à un agent d'exploration** — vérifier les points critiques.
- **Ne pas poser `bug` ET `enhancement`** sur la même issue (mutuellement exclusifs).
- **Ne pas qualifier en masse les user stories de backlog** sans demande explicite.
- **Ne pas chaîner les commandes git/gh** dans un seul appel Bash.

## Référence

- Labels du repo : [references/labels.md](references/labels.md)
- Template de commentaire : [templates/qualification.md](templates/qualification.md)
