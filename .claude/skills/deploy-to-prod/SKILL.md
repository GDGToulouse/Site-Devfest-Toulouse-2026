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
```

- **Aucun commit** `origin/main..origin/dev` → rien à promouvoir, s'arrêter.
- Noter le **dernier tag** et la **version code** : ils doivent être cohérents avant de commencer (sinon signaler l'écart).

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

> ⚠️ Oublier ce bump = la prod affiche l'ancien numéro. C'est l'erreur la plus fréquente.

---

## Étape 3 — Promouvoir (PR dev → main)

La stratégie de merge vers `main` est **squash**.

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

## Étape 4 — Déployer + vérifier

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

---

## Étape 5 — Taguer + publier la release

**Seulement après déploiement vérifié.** Le tag pointe sur le `main` en prod.

```bash
git checkout main && git pull origin main
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z \
  --repo GDGToulouse/Site-Devfest-Toulouse-2026 \
  --title "vX.Y.Z" --generate-notes
```

Garde-fous :
- Le tag **doit** être identique à `APP_VERSION`. Vérifier :
  `git show vX.Y.Z:src/backend/src/lib/version.ts | grep APP_VERSION`
- **Un seul tag par version**, jamais déplacé une fois poussé.
- `--generate-notes` compile les PR mergées depuis le tag précédent.

---

## Étape 6 — Migrer les données (si nécessaire)

Uniquement si le contenu prod doit être synchronisé depuis la beta. C'est un
**écrasement complet** (`pg_dump --clean`) + copie des uploads (`docker cp`).
Voir [`docs/mise-en-production.md`](../../../docs/mise-en-production.md) §7 pour les commandes exactes.

⚠️ **Confirmer explicitement** avant : identifier le BON conteneur source (vérifier
le `BASE_URL`, pas le hash — beta ≠ dev-j), l'opération remplace toute la base prod.

---

## Checklist finale

- [ ] Diff réel `main..dev` revu, bump SemVer choisi et **confirmé**
- [ ] `APP_VERSION` + 2× `package.json` bumpés dans la PR de promotion
- [ ] PR `dev → main` squashée, approuvée, mergée (faux conflit géré si besoin)
- [ ] Déploiement Coolify OK, `/api/health` renvoie la **nouvelle** version
- [ ] Tag `vX.Y.Z` poussé + release GitHub publiée
- [ ] (si besoin) Données migrées beta → prod, uploads compris

## What NOT to do

- **Ne jamais** push direct / force-push sur `main`.
- **Ne jamais** taguer/release **avant** d'avoir vérifié le déploiement.
- **Ne jamais** déplacer un tag déjà poussé (créer un nouveau numéro à la place).
- **Ne pas** merger la PR de promotion sans que le bump de version y soit inclus.
- **Ne pas** lancer la migration de données sans confirmation + vérification du conteneur source.
- **Ne pas** exécuter les gestes irréversibles (merge main, push tag, migration) sans montrer la commande et faire valider.

## Quand cette skill s'applique

Trigger : « pousse en prod », « mise en prod », « déployer en production »,
« promouvoir dev vers main », « publier une release », « taguer la version ».

**Ne pas** trigger pour un simple merge/push vers `dev` (beta) : ça, c'est le flux
normal de développement, pas une mise en prod.
