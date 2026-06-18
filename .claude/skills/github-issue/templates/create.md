# Template — création d'issue GitHub (Mode CREATE)

Deux structures selon la nature : **bug** (concis, orienté repro) et **user story / enhancement** (orienté valeur + périmètre). Choisir selon le label de type.

---

## A. Body pour un bug (`bug`)

```markdown
## Contexte / Repro

<Quand et comment le problème survient. Étapes numérotées si possible.
Environnement : navigateur / URL (local, dev-j, beta, prod). Citer le fichier
ou la ligne suspectée si identifié.>

Étapes :
1. <action>
2. <action>
3. <ce qui casse>

## Comportement attendu vs observé

- **Attendu** : <ce qui devrait se passer>
- **Observé** : <ce qui se passe réellement, message d'erreur, capture>

## Tâches

- [ ] Diagnostiquer le problème
- [ ] Corriger <fichier / composant>
- [ ] Vérifier la non-régression sur <cas adjacent>

## Critères d'acceptation

- [ ] <Comportement observable corrigé, du POV utilisateur>
- [ ] <Pas de régression sur Z>

## Liens

- Frontend : [<fichier>](src/frontend/src/...) · Backend : [<route>](src/backend/src/routes/...)
- Spec : [docs/...](docs/...) si pertinent
- Issues liées : #NN
```

---

## B. Body pour une user story / enhancement (`enhancement`)

```markdown
## User Story

> **En tant que** <rôle : visiteur / admin / speaker / sponsor / orga>,
> **je veux** <capacité concrète>
> **afin de** <bénéfice / valeur>.

Cas d'usage :
- <situation 1 où la feature sert>
- <situation 2>

## Périmètre

### Inclus (V1)
- <bullet actionnable issu de l'interview>
- <choix par défaut recommandé et validé par l'utilisateur>

### Hors scope V1
- <ce qui ressemble mais relève d'une autre issue>

## Test plan

- [ ] `tsc` + `eslint` OK (front et/ou back)
- [ ] <Tests auto si applicable>
- [ ] <Comportement observable 1, du POV utilisateur>
- [ ] Rendu FR/EN correct (si UI), vérif via Chrome DevTools MCP, console propre

## Liens

- Page / composant : [<fichier>](src/frontend/src/app/...) · [<fichier>](src/frontend/src/components/...)
- Backend : [<route>](src/backend/src/routes/...) · [<lib>](src/backend/src/lib/...)
- i18n : [messages/fr.json](src/frontend/messages/fr.json)
- Spec : [docs/fonctionnalites-2026.md](docs/fonctionnalites-2026.md) ou [docs/modele-donnees-metier.md](docs/modele-donnees-metier.md)
- Issues liées : #NN
```

> Pour une feature simple (non-US), remplacer `## User Story` par `## Contexte`
> et `## Périmètre` par `## Tâches` (checklist). Garder `## Test plan` et `## Liens`.

---

## Sections conditionnelles

N'ajouter que si l'utilisateur a fourni la matière — ne pas remplir de vide.

### Dépendances

```markdown
## Dépendances

- <Issue / donnée / migration prérequise — ex. « #63 (données historiques importées) ».>
```

### Architecture / Implémentation suggérée

```markdown
## Architecture

<Migration Prisma, nouveaux fichiers front/back, endpoints API, clé SiteSetting,
stratégie de cache/revalidation… Amorce pour l'implémenteur, sans figer le design.>
```

### Note de déploiement

```markdown
## Note

<Action manuelle post-merge/déploiement : ex. lancer un script d'import par
instance, déclarer des redirect URIs OAuth par environnement, etc.>
```

### Hors scope (si non déjà dans le périmètre)

```markdown
## Hors scope

- <Ce qui ressemble mais relève d'une autre issue>
```

---

## Règles de rédaction

- Pas de signature « Generated with Claude Code » ou équivalent
- Pas de credentials, tokens, mots de passe, `DATABASE_URL`, secrets OAuth/SMTP
- Citer les fichiers en relatif au repo : `src/frontend/src/...`, `src/backend/src/...`, `docs/...`
- Préférer les liens markdown explicites aux URLs nues
- Checklist d'acceptation / test plan : 2 à 6 items, observables et vérifiables
- `## Contexte` ou la US : concis — déporter les détails techniques dans `## Architecture`
- Bilinguisme : si l'issue touche du texte UI, prévoir un item « rendu FR/EN »
- Respecter le design system (`docs/design-system.md`, tokens Tailwind : malachite, terre-cuite, bismarck…) quand l'issue touche l'UI
```
