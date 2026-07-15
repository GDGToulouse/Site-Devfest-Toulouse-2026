---
name: github-issue
description: Rédige une issue GitHub cohérente pour le repo GDGToulouse/Site-Devfest-Toulouse-2026 — création d'une nouvelle issue OU enrichissement d'une issue existante via commentaire (sans écraser le body). Interview l'utilisateur sur les détails manquants, applique les conventions du repo (labels bug/enhancement/documentation/question, milestone « Lot N » uniquement si l'issue relève du périmètre du lot), cite de vrais fichiers/lignes du repo et des specs docs/. Trigger phrases — création « crée une issue pour… », « ouvre un ticket… », « ajoute une issue sur… », « ouvre une issue GitHub pour… ». Refine « rédige l'issue #X », « clean up issue #X », « commente l'issue #X », « enrichis l'issue #X », « transforme cette issue ».
---

# Rédaction d'issue GitHub — site DevFest Toulouse

Skill bi-mode :
- **Mode CREATE** : partir d'un brief, générer une issue prête à poster
- **Mode REFINE** : prendre une issue laconique existante, l'enrichir via un commentaire structuré (jamais en écrasant le body)

Repo cible : `GDGToulouse/Site-Devfest-Toulouse-2026` sur `github.com`. CLI : `gh` (authentifiée). Langue : **français**.

> **Contexte projet** : site Next.js (`src/frontend/`) + API Fastify/Prisma (`src/backend/`), bilingue FR/EN. Voir [CLAUDE.md](../../../CLAUDE.md) et les specs `docs/`.
>
> **Milestones « Lot 1 → Lot 5 »** : ils mesurent la couverture du **périmètre initial**, pas les versions. Une issue n'y est rattachée que si elle appartient à ce périmètre. Un **bug ou une amélioration découverts après la livraison du Lot n'ont pas de milestone** — juste un label. Règle complète : [`.claude/rules/git-workflow.md`](../../rules/git-workflow.md) § « Issues, milestones et versions ».

## Pre-flight — éviter le travail dupliqué

Si l'utilisateur a déjà donné le numéro et que tu ne l'as pas encore lu :

```bash
gh issue view <number> --comments
```

Saute les étapes déjà couvertes dans un tour précédent.

---

## Mode CREATE — issue à partir d'un brief

### Step 0 — Vérifier qu'une issue similaire n'existe pas déjà (anti-doublon)

**Obligatoire avant toute rédaction.** Chercher une issue existante couvrant le même sujet.

```bash
# Recherche plein-texte sur titres + bodies, ouvertes ET fermées
gh issue list --repo GDGToulouse/Site-Devfest-Toulouse-2026 --state all --search "<2-4 mots-clés du brief>" --limit 20
# Complément par milestone si le Lot est connu
gh issue list --repo GDGToulouse/Site-Devfest-Toulouse-2026 --state all --milestone "Lot 3 — Programme" --limit 30
```

Lancer **plusieurs** recherches avec des synonymes (ex. « replay », « vidéo », « youtube », « historique »). Inspecter les candidats sérieux avec `gh issue view <n>`.

- **Doublon probable trouvé** → **ne pas créer**. Le signaler à l'utilisateur et **basculer en Mode REFINE** (enrichir l'issue existante par un commentaire) au lieu d'en ouvrir une nouvelle.
- **Doute** → présenter les candidats à l'utilisateur et demander : enrichir l'existante ou créer une nouvelle ?
- **Aucun doublon** → continuer en Step 1.

Ne jamais lancer `gh issue create` sans avoir fait cette recherche.

### Step 1 — Cadrer le contexte

À partir du brief utilisateur :
- Identifier la **nature** → label de type (`bug`, `enhancement`, `documentation`, `question`)
- Déterminer si c'est une **User Story** → la structurer comme telle dans le body (le repo n'a pas de label `user-story` ; le format suffit)
- Décider s'il y a un **milestone**. Test : *« peut-on déclarer le Lot terminé en laissant cette issue ouverte ? »*
  - **Non** (l'issue fait partie du périmètre du Lot, y compris un bug qui l'empêche d'être « done ») → rattacher au Lot → voir [references/milestones.md](references/milestones.md). Demander si ambigu.
  - **Oui** (bug / amélioration découverts **après** la livraison du Lot) → **pas de milestone**, le label suffit.
- Identifier les **specs concernées** dans `docs/` → à citer dans le body (`docs/fonctionnalites-2026.md`, `docs/modele-donnees-metier.md`, etc.)

Voir [references/labels.md](references/labels.md) pour les labels disponibles.

### Step 2 — Inspection rapide des fichiers liés

Avant de citer un fichier ou une ligne, **le lire** (`Read`, `Grep`). Pas d'invention. Structure du repo (voir CLAUDE.md) :
- Frontend : `src/frontend/src/app/[locale]/` (pages publiques i18n), `src/frontend/src/app/admin/` (back-office), `src/frontend/src/components/`, `src/frontend/src/lib/`, `src/frontend/messages/{fr,en}.json`
- Backend : `src/backend/src/routes/` (public) + `src/backend/src/routes/admin/`, `src/backend/src/lib/`, `src/backend/prisma/schema.prisma`

Si le périmètre est flou, **demander** avant de générer le body.

### Step 3 — Interview (`AskUserQuestion`)

2 à 4 questions seulement. Options mutuellement exclusives. **Toujours un « (Recommandé) » par défaut**. Cibles d'interview selon la nature :

- **bug** : étapes de repro, comportement attendu vs observé, environnement (navigateur / URL : local, dev-j, beta, prod), criticité
- **enhancement / user-story** : scope (in/out), critères de « done » observables, impact i18n (FR/EN), SEO, dépendances, milestone
- **documentation** : audience (utilisateur / dev / orga), emplacement (`docs/`, README), langue
- **question** : la décision précise à trancher, indicateurs de réponse

### Step 4 — Générer titre + body

Titre : phrase descriptive en français, claire, sous ~80 chars. Conventions observées dans le repo :
- Bug : décrit le symptôme — `OAuth : le clic Google renvoie "null" au lieu de rediriger`
- Feature : décrit le résultat — `Hall of replays — toutes les conférences vidéo, toutes éditions`
- Préfixe `Domaine — ` toléré quand il clarifie — `Admin — gestion des images du carrousel`
- Préfixe `Lot N — ` toléré pour aligner sur le découpage (fréquent dans ce repo)

Body selon [templates/create.md](templates/create.md).

- **Bug** : `## Contexte / Repro`, `## Comportement attendu vs observé`, `## Tâches`, `## Critères d'acceptation`, `## Liens`
- **User Story / enhancement** : `## Contexte` ou `## User Story`, `## Tâches` ou `## Périmètre`, `## Critères d'acceptation` / `## Test plan`, `## Liens` — sections conditionnelles `## Dépendances`, `## Hors scope`, `## Note`

> **Test plan** : ce repo suit un workflow TDD avec vérif via **Chrome DevTools MCP** (voir `.claude/rules/testing.md`). Inclure une checklist de test qui couvre tsc/lint, tests auto, et vérif fonctionnelle navigateur quand l'issue touche l'UI.

### Step 5 — Vérifier les labels + milestone, puis créer

```bash
gh label list --limit 100
gh api repos/GDGToulouse/Site-Devfest-Toulouse-2026/milestones --jq '.[].title'
```

Afficher l'issue complète au user. Sur confirmation, poster (préférer `--body-file -` avec heredoc pour le markdown multi-ligne) :

```bash
gh issue create \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "Titre descriptif en français" \
  --label "enhancement" \
  --milestone "Lot 4 — Contenu complémentaire" \
  --body-file - <<'EOF'
... body markdown ...
EOF
```

Retourner l'URL. **Signaler les couplages** (mêmes fichiers / specs que d'autres issues — voir Mode REFINE Step 6).

---

## Mode REFINE — enrichir une issue existante

### Step 1 — Lire l'issue + ses commentaires

```bash
gh issue view <number> --comments
```

Noter : titre actuel, body (souvent laconique), labels et milestone déjà posés, commentaires existants.

### Step 2 — Inspection des fichiers liés

Repérer dans le repo les pages / composants / routes touchés. **Vérifier** avant de citer une ligne (`Read`/`Grep`). Si flou → demander.

### Step 3 — Interview (`AskUserQuestion`)

Mêmes règles que Mode CREATE Step 3. **Ne saute jamais l'interview** sous prétexte que la demande semble claire — les body laconiques cachent toujours des choix implicites.

### Step 4 — Poster le rewrite **en commentaire**

**Règle absolue : ne JAMAIS appeler `gh issue edit --body …`** (qui écraserait le body original du déclarant). Le commentaire complète, ne remplace pas.

Format du commentaire : voir [templates/comment.md](templates/comment.md).

```bash
gh issue comment <number> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --body-file - <<'EOF'
... commentaire ...
EOF
```

### Step 5 — MAJ titre + labels + milestone en UN seul call

Si le titre n'est pas clair, ou qu'il manque un label / milestone, corriger en **un seul** `gh issue edit` (sans `--body`) :

```bash
gh issue edit <number> \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "Titre descriptif corrigé" \
  --add-label "enhancement" \
  --milestone "Lot 3 — Programme"
```

Confirmer avec :

```bash
gh issue view <number> --json title,labels,milestone,state
```

### Step 6 — Surface couplings

Si l'issue touche les mêmes fichiers / specs / Lot qu'une autre issue ouverte, le **dire** dans le récap final. Suggérer un bundling éventuel.

```bash
gh issue list --repo GDGToulouse/Site-Devfest-Toulouse-2026 --milestone "Lot 3 — Programme" --state open
```

---

## Conventions transverses

- **Langue** : français (issues, titres). Code/commits/branches en anglais (cf. CLAUDE.md).
- **Pas de secrets** : pas de tokens, mots de passe, clés, `DATABASE_URL`, secrets OAuth/SMTP. Hostnames publics (`*.site.devfesttoulouse.fr`), noms de modèles, versions OK.
- **Liens** : `[AboutSection.tsx](src/frontend/src/components/home/AboutSection.tsx)` ou `[editions.ts:36](src/backend/src/routes/editions.ts#L36)` (relatif au repo) ; `#NN` pour issues liées ; specs `docs/fonctionnalites-2026.md` ; URL pleine pour ressources externes.
- **Label obligatoire min.** : 1 label de type (`bug` / `enhancement` / `documentation` / `question`).
- **Milestone** : optionnel, et réservé au **périmètre d'un Lot**. Un bug ou une amélioration post-livraison n'en ont pas. Jamais de milestone fourre-tout (`Backlog`, `v1.x`, `Maintenance`).
- **Validation utilisateur** : toujours afficher l'issue / commentaire complet AVANT exécution.

## What NOT to do

- **Ne pas créer une issue sans avoir cherché un doublon** (`gh issue list --search …`, Step 0)
- **Ne pas écraser le body** d'une issue existante (jamais `gh issue edit --body` en mode REFINE)
- **Ne pas sauter l'interview**, même quand le brief paraît évident
- **Ne pas inventer de fichiers / lignes** — vérifier avec `Read`/`Grep` d'abord
- **Ne pas assumer la nature (bug vs feature)** — demander si flou
- **Ne pas chaîner les `gh issue edit`** : un seul call pour titre + labels + milestone
- **Ne pas inventer un milestone** — utiliser un Lot existant, ou aucun
- **Ne pas rattacher un bug post-livraison à un Lot** juste pour lui donner un milestone (ça fausse la mesure du périmètre) — le label suffit
- **Ne pas ajouter d'assignee / project** tant que l'utilisateur n'en a pas convenu
- **Ne pas inclure de signature « Generated with Claude Code »** ou équivalent dans le body / commentaire

## Quand cette skill s'applique

Trigger sur l'une des phrases :
- « crée une issue pour … » / « ouvre un ticket … » / « ajoute une issue sur … »
- « rédige l'issue #X » / « clean up #X » / « transforme cette issue »
- « commente l'issue #X » / « enrichis l'issue #X »
- « fais la même chose pour l'issue #X » (suite d'un refine)

**Ne pas trigger** quand l'utilisateur veut juste *lire*, *résumer*, ou *lister* des issues.

## Référence

- Labels du repo : [references/labels.md](references/labels.md)
- Milestones / Lots : [references/milestones.md](references/milestones.md)
- Exemples : [references/examples.md](references/examples.md)
- Templates : [templates/create.md](templates/create.md), [templates/comment.md](templates/comment.md)
