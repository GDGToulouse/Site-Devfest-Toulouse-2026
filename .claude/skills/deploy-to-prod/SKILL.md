---
name: deploy-to-prod
description: Guide la mise en production du site DevFest Toulouse — promotion dev→main, versioning SemVer, tag git + release GitHub, et rappel des garde-fous (branches protégées, faux conflit squash, config Coolify, migration données). Trigger phrases — « pousse en prod », « mise en prod », « déployer en production », « promouvoir dev vers main », « publier une release », « taguer la version », « bumper la version ». Ne PAS trigger pour un simple push vers dev/beta.
---

# Mise en production — site DevFest Toulouse 2026

Objectif : orchestrer une mise en prod **complète et sûre**, en garantissant les règles du repo : promotion `dev → main` par PR squashée, **versioning SemVer** (bump + tag + release), et les garde-fous appris lors des mises en prod précédentes.

Repo cible : `GDGToulouse/Site-Devfest-Toulouse-2026`. CLI : `gh` + `git` (authentifiés). Langue : **français**.

> **Source de vérité** : [`docs/mise-en-production.md`](../../../docs/mise-en-production.md). Cette skill **applique** et **guide** cette procédure — en cas de doute ou de divergence, la doc fait foi. Lire la doc si un cas n'est pas couvert ici.

## Règles absolues (non négociables)

1. **`main` est protégée** : jamais de push direct, jamais de force-push. Toute arrivée en prod passe par une **PR `dev → main` squashée et approuvée**.
2. **Une mise en prod = une version** : bump SemVer + tag git + release GitHub. Pas de déploiement prod sans nouveau numéro.
3. **La version affichée = la version déployée** : le bump de `APP_VERSION` fait partie de la **PR de promotion**, jamais après.
4. **Confirmer avant tout geste irréversible** : merge vers main, tag poussé, migration de données (écrasement). Montrer la commande, faire valider.

---

## Pre-flight — état des lieux

Avant de proposer quoi que ce soit, établir l'état réel :

```bash
# Qu'est-ce qui partirait en prod ? (diff réel dev vs main)
git fetch origin main dev
git log --oneline origin/main..origin/dev
git diff --stat origin/main..origin/dev

# Dernière version taguée
git tag -l 'v*' --sort=-v:refname | head -1

# Version actuelle dans le code
git show origin/dev:src/backend/src/lib/version.ts | grep APP_VERSION

# MIGRATIONS Prisma qui s'exécuteraient en prod (au boot) — les LIRE
git diff origin/main..origin/dev -- src/backend/prisma/migrations/
```

- **Aucun commit** `origin/main..origin/dev` → rien à promouvoir, s'arrêter.
- Noter le **dernier tag** et la **version code** : cohérents avant de commencer (sinon signaler l'écart).
- **Migrations** : si le diff en contient, repérer les opérations **destructives**
  (`DROP`, `ALTER … DROP COLUMN`, `TRUNCATE`, renommages) → backup DB obligatoire (étape 4),
  et le signaler à l'utilisateur.
- **Secrets** : vérifier qu'aucun secret n'est dans le diff promu (chercher `SECRET`/`KEY`/`PASSWORD`/`TOKEN`).

### Cohérence du label `corrigé`

Les issues traitées portent le label `corrigé` (posé dès l'arrivée du correctif sur
`dev-{initiale}` — cf. [`.claude/rules/git-workflow.md`](../../rules/git-workflow.md)).
Vérifier qu'aucune de celles qui **partent en prod** n'a été oubliée :

```bash
# Issues ouvertes référencées par les commits promus
git log origin/main..origin/dev --pretty=%s | grep -oE '#[0-9]+' | tr -d '#' | sort -u > /tmp/refs.txt
gh issue list --repo GDGToulouse/Site-Devfest-Toulouse-2026 --state open --limit 200 \
  --json number --jq '.[].number' | sort -u > /tmp/open.txt
comm -12 /tmp/refs.txt /tmp/open.txt
```

⚠️ Un `#NN` peut être un **numéro de PR**, pas d'issue — **vérifier chaque candidat**
(`gh issue view <NN>`) avant de conclure. Celles qui sont de vraies issues corrigées et
qui n'ont pas le label : le poser + commenter les commits (voir la règle).

> L'inverse n'est **pas** une anomalie : une issue `corrigé` absente de `main..dev` est
> simplement restée sur une branche `dev-{initiale}` non encore promue vers `dev`. Elle
> partira à la release suivante — ne pas la faire figurer dans les `Closes` de cette PR.

### Fenêtre de déploiement

Rappeler à l'utilisateur : **ne pas déployer à J-1 du DevFest** ni pendant un pic
(ouverture billetterie, annonce), **prévenir l'équipe**, préférer un créneau où
quelqu'un peut réagir. Si le timing est sensible, demander confirmation explicite.

---

## Étape 1 — Choisir le bump SemVer

Analyser les commits promus et proposer un bump, en s'appuyant sur les préfixes Conventional Commits :

| Bump | Déclencheur | Préfixes |
|------|-------------|----------|
| **MAJOR** | Changement cassant, refonte, migration lourde | `feat!`, `BREAKING CHANGE`, refonte modèle |
| **MINOR** | Nouvelle fonctionnalité sans casse | `feat:` |
| **PATCH** | Correctif, doc, chore | `fix:`, `docs:`, `chore:`, `refactor:` |

**Le plus haut l'emporte** (un `feat:` parmi des `fix:` → MINOR).

Utiliser `AskUserQuestion` pour **confirmer le numéro proposé** (l'humain valide toujours le bump) : proposer le calcul en option recommandée + les alternatives.

---

## Étape 2 — Bumper la source de vérité (dans la PR de promotion)

Le bump se fait **sur la branche de promotion**, avant le merge. Mettre à jour les **3** emplacements :

1. `APP_VERSION` dans [`src/backend/src/lib/version.ts`](../../../src/backend/src/lib/version.ts)
2. `version` dans [`src/backend/package.json`](../../../src/backend/package.json)
3. `version` dans [`src/frontend/package.json`](../../../src/frontend/package.json)

Dans la même PR, mettre à jour [`CHANGELOG.md`](../../../CHANGELOG.md) : déplacer les
entrées de `## [Non publié]` vers une nouvelle section `## [X.Y.Z] - AAAA-MM-JJ`
(Ajouté / Corrigé / Modifié). Ce texte sert aussi de notes de release.

> ⚠️ Oublier ce bump = la prod affiche l'ancien numéro. C'est l'erreur la plus fréquente.

---

## Étape 3 — Promouvoir (PR dev → main)

La stratégie de merge vers `main` est **squash**.

### Collecter les issues à fermer

`main` étant la branche par défaut, **seule** cette PR peut fermer les issues (les PR
feature vers `dev-{initiale}` écrivent `Refs #`, qui ne ferme rien). Le squash ayant
effacé les SHA d'origine, le bloc `Closes` de cette PR est le **seul** mécanisme fiable.

```bash
# Issues référencées par les commits promus
git log origin/main..origin/dev --pretty=%B | grep -oE '#[0-9]+' | sort -u
```

Croiser avec les entrées du CHANGELOG (étape 2) — même périmètre. **Montrer la liste à
l'utilisateur pour validation** (un `#123` peut être une simple mention, pas une issue
à fermer), puis ajouter dans le body de la PR :

```markdown
## Issues fermées
Closes #123
Closes #145
```

### ⚠️ Faux conflit `add/add` après squash

Comme les PR vers `dev` sont squashées, les SHA divergent et une PR `dev → main`
directe peut afficher un conflit `add/add` **factice**. Procédure de contournement :

```bash
git checkout dev && git pull origin dev
git checkout -b promote/vX.Y.Z-to-main
git merge origin/main            # résoudre en gardant TOUJOURS la version de dev
# (le bump de version de l'étape 2 se fait ici si pas déjà commité)
git push -u origin promote/vX.Y.Z-to-main
gh pr create --base main --head promote/vX.Y.Z-to-main \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "Release vX.Y.Z" --body-file -
```

- Vérifier le **diff réel** avant merge : `git diff --stat origin/main..HEAD`.
- Merge **après approbation** (main protégée). Confirmer avec l'utilisateur.

---

## Étape 4 — Sauvegarder la base prod (si migration)

**Si le pre-flight a détecté une migration Prisma**, faire un `pg_dump` horodaté
de la prod **avant** de déployer (le backend joue les migrations au boot ; sans
dump, une migration destructrice est irrécupérable). Commandes : voir
[`docs/mise-en-production.md`](../../../docs/mise-en-production.md) §4.

Sans migration, cette étape est facultative.

---

## Étape 5 — Déployer + vérifier

Le déploiement Coolify se déclenche sur le push `main`. Rappeler la config prod
critique (détails : [`docs/mise-en-production.md`](../../../docs/mise-en-production.md) §3) :

- `ENV_NAME=prod`, `BASE_URL`, `BACKEND_URL`, `NEXT_PUBLIC_PLAUSIBLE_SRC` → **Available at Buildtime** cochés.
- `SESSION_SECRET` runtime **obligatoire** en prod (sinon Better Auth crashe au boot).

Vérifier la **version réellement déployée** (garde-fou #171) :

```bash
curl -s https://site.devfesttoulouse.fr/api/health
# → doit renvoyer "version":"X.Y.Z" == le bump de l'étape 2
```

Si la version ne correspond pas : bump oublié ou build non régénéré (Redeploy without cache).

**Smoke tests** — tester les parcours critiques (idéalement dans un navigateur) :
home, **login admin**, **billetterie** (tarifs + statut), **article**, **contact**
(envoi), chargement des **images** `/uploads/`. Détail : [`docs/mise-en-production.md`](../../../docs/mise-en-production.md) §6.

---

## Étape 6 — Taguer + publier la release

**Seulement après déploiement vérifié.** Le tag pointe sur le `main` en prod.

```bash
git checkout main && git pull origin main

# GARDE-FOU : vérifier AVANT de taguer que main porte bien le numéro
git show main:src/backend/src/lib/version.ts | grep APP_VERSION   # == X.Y.Z

git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "vX.Y.Z" --generate-notes
```

Garde-fous :
- Le tag **doit** être identique à `APP_VERSION` — vérifié **avant** le push.
- **Un seul tag par version**, jamais déplacé une fois poussé.
- `--generate-notes` compile les PR mergées depuis le tag précédent.

Vérifier que les `Closes` de l'étape 3 ont bien fermé les issues (le merge dans `main`
les ferme automatiquement — si l'une est encore ouverte, le mot-clé était mal écrit) :

```bash
gh issue view <NN> --repo GDGToulouse/Site-Devfest-Toulouse-2026 --json number,state
```

Fermer à la main celles qui seraient restées ouvertes.

---

## Étape 7 — Migrer les données — **à la demande UNIQUEMENT**

> 🚫 **N'est PAS une étape systématique.** Un déploiement de prod ne migre **jamais**
> les données par défaut — on ne déploie que du **code**. Ne proposer cette étape que
> si l'utilisateur la **demande explicitement** (ex. première mise en prod, sync ponctuelle).

C'est un **écrasement complet** (`pg_dump --clean`) de la base prod par celle de la
beta + copie des uploads (`docker cp`). Voir
[`docs/mise-en-production.md`](../../../docs/mise-en-production.md) §8 pour les commandes.

⚠️ **Confirmer explicitement** avant : identifier le BON conteneur source (vérifier
le `BASE_URL`, pas le hash — beta ≠ dev-j), l'opération **détruit** la base prod actuelle.

---

## En cas de problème — Rollback

Ne pas improviser. Voir [`docs/mise-en-production.md`](../../../docs/mise-en-production.md) (section « Rollback ») :
- **Sans migration** : redéployer le tag précédent (Coolify), vérifier `/api/health`.
- **Avec migration** : redéployer l'ancien code **ne suffit pas** — restaurer le
  dump pris à l'étape 4, puis redéployer. Sans dump, pas de rollback propre.
- Ne **jamais** supprimer/déplacer le tag fautif : créer un correctif `vX.Y.Z+1`.

---

## Checklist finale

- [ ] Fenêtre de déploiement OK (pas J-1 DevFest / pic), équipe prévenue
- [ ] Diff réel `main..dev` revu, **migrations Prisma lues** (destructives repérées)
- [ ] Bump SemVer choisi et **confirmé**
- [ ] `APP_VERSION` + 2× `package.json` + `CHANGELOG.md` mis à jour dans la PR de promotion
- [ ] Issues embarquées listées en `Closes #NN` dans le body de la PR de promotion (validées par l'utilisateur)
- [ ] PR `dev → main` squashée, approuvée, mergée (faux conflit géré si besoin)
- [ ] (si migration) **Backup DB prod** effectué avant déploiement
- [ ] Déploiement Coolify OK, `/api/health` renvoie la **nouvelle** version
- [ ] **Smoke tests** passés (home, login, billetterie, article, contact, images)
- [ ] Tag `vX.Y.Z` poussé (après vérif tag==APP_VERSION) + release GitHub publiée
- [ ] (à la demande seulement) Données migrées beta → prod, uploads compris

## What NOT to do

- **Ne jamais** push direct / force-push sur `main`.
- **Ne jamais** taguer/release **avant** d'avoir vérifié le déploiement.
- **Ne jamais** déplacer un tag déjà poussé (créer un nouveau numéro à la place).
- **Ne jamais** jouer une migration en prod sans **backup DB** préalable.
- **Ne pas** merger la PR de promotion sans le bump de version + CHANGELOG.
- **Ne pas** migrer les données par défaut : c'est **opt-in**, sur demande explicite,
  avec confirmation + vérification du conteneur source (écrase la base prod).
- **Ne pas** exécuter les gestes irréversibles (merge main, push tag, backup/restore,
  migration) sans montrer la commande et faire valider.

## Quand cette skill s'applique

Trigger : « pousse en prod », « mise en prod », « déployer en production »,
« promouvoir dev vers main », « publier une release », « taguer la version ».

**Ne pas** trigger pour un simple merge/push vers `dev` (beta) : ça, c'est le flux
normal de développement, pas une mise en prod.
