
# Audit de sécurité, étape 2/3 : analyse et validation

## Garde-fou modèle

Cette étape demande le raisonnement d'Opus 5.5. Si tu n'es pas Opus 5.5, **arrête-toi immédiatement** sans rien analyser et affiche : « Étape 2 interrompue : modèle <ton modèle> détecté, Opus 5.5 requis. Relance `/audit-secu 2` quand Opus 5.5 est disponible. » Les étapes 1 et 3 restent utilisables avec un autre modèle. Si la phase A a déjà tourné (les huit fichiers de `.security-audit/findings/` existent), propose plutôt `/audit-secu 2b`, qui reprend à la phase B avec n'importe quel modèle.

## Contexte et autorisation

Je suis mainteneur du dépôt `GDGToulouse/Site-Devfest-Toulouse-2026` (association GDG Toulouse). Je te demande une revue de sécurité défensive de **notre propre code**, équivalente à un audit de code interne combiné à des tests sur une instance locale de développement, pour corriger les failles avant qu'elles soient exploitées.

## Règles d'engagement (strictes)

- **Périmètre** : le code de ce dépôt, son historique, sa configuration, et l'instance **locale** décrite dans `.security-audit/01-etat.md`.
- **Hors périmètre** : la production `devfesttoulouse.fr` et tout autre hôte. Aucune requête hors localhost, aucun scan réseau, aucun brute force, aucun déni de service.
- **Non destructif** : base locale jetable uniquement. Tu ne modifies pas le code applicatif.
- **PoC minimales** : une PoC sert seulement à confirmer qu'un problème est réel (par exemple une requête `curl` vers localhost où le compte de test A lit une ressource du compte de test B). Pas de charge utile offensive générique, pas d'outil réutilisable contre des tiers.
- **Secrets** : jamais utilisés, toujours masqués (4 premiers caractères puis `****`), rotation recommandée.

## Prérequis

Lis `.security-audit/01-cartographie.md`, `.security-audit/01-etat.md`, `.security-audit/comptes-test.md` et les fichiers de `.security-audit/scans/`. Lis aussi `docs/audit-droits-api.md` et `.claude/rules/security.md` : un constat déjà corrigé, ou ouvert et **accepté** dans l'audit précédent (par exemple l'URL publique de la brochure), n'est pas re-signalé comme nouveau. Il est seulement revérifié et cité en annexe. S'ils sont absents, exécute d'abord les tâches 1 à 3 de l'étape 1 en version minimale (cartographie seule), puis continue. Si l'instance locale n'est pas disponible, fais l'analyse en statique seule et classe les constats en `Probable`.

## Phase A : agents spécialisés en parallèle (approche Strix)

Lance 8 sous-agents **dans un seul message** pour qu'ils tournent en parallèle. Chacun reçoit : ces règles d'engagement, le chemin de la cartographie, son domaine ci-dessous, et la consigne d'écrire ses constats dans `.security-audit/findings/<domaine>.md`. Chaque agent part des sorties de scan et des « usages sensibles » de la cartographie, remonte le chemin de code depuis l'entrée utilisateur jusqu'au point sensible, puis vérifie son hypothèse contre localhost quand c'est possible.

1. `acces` **Contrôle d'accès** : IDOR sur chaque ressource identifiée par un id (sponsors, speakers, sessions, jetons, utilisateurs, fichiers) ; escalade horizontale (sponsor A modifie sponsor B) et verticale (compte `SPONSOR` ou lien speaker vers `/admin`, `EDITOR` vers une action réservée à `ADMIN`, contact `STAND` vers une écriture de l'espace partenaire) ; contrôle côté serveur identique à l'UI sur chaque route API ; mass assignment (`role`, `isAdmin`, `ownerId`, `status` acceptés dans un POST/PATCH).
2. `auth` **Authentification et jetons** : attributs des cookies (`HttpOnly`, `Secure`, `SameSite`) ; fixation et invalidation de session au logout ; jetons `dft_` (entropie, stockage haché ou en clair, révocation effective, portée) ; jetons OAuth des agents MCP (consentement, révocation, routes refusées aux agents) ; lien `/edit/<token>` des speakers (expiration, gel, révocation) ; inscription fermée (`user.create.before`, rôle par défaut `EDITOR`, cf. `.claude/rules/security.md`) ; comparaison en temps constant ; flux de réinitialisation ou lien magique ; limitation de débit à la connexion.
3. `injection` **Injections** : requêtes Prisma brutes, filtres dynamiques construits depuis l'entrée, injection de commande, injection de template, path traversal.
4. `client` **Côté client** : HTML non échappé et markdown non sanitisé sur les champs éditables par sponsors et speakers ; XSS stockée visible par l'admin ; open redirect ; pollution de prototype ; en-têtes (CSP, HSTS, X-Frame-Options, Referrer-Policy) ; CORS de l'API.
5. `fichiers` **Fichiers et requêtes sortantes** : uploads (type réel, taille, nom, SVG avec script, dossier servi) ; SSRF sur toute URL fournie par un utilisateur.
6. `metier` **Logique métier et CSRF** : actions sensibles sans protection CSRF ; modération contournable ; conditions de course ; données personnelles exposées par l'API publique (emails, téléphones, champs internes) ; points RGPD.
7. `infra` **Secrets et infrastructure** : résultats gitleaks/trufflehog à confirmer ; `.env.example` ; `.dockerignore` et `.gitignore` incomplets ; conteneurs en root ; ports et base exposés hors du réseau Docker ; Swagger ou debug exposés en production ; erreurs verbeuses.
8. `supply-chain` **Dépendances et CI/CD** : `pnpm audit` à trier selon l'usage réel de la dépendance ; workflows (`pull_request_target`, `${{ github.event.* }}` dans un `run:`, permissions `GITHUB_TOKEN`, actions non épinglées par SHA, secrets exposés aux forks) ; `.mcp.json` et `.claude/` (serveurs MCP, permissions, hooks exécutant des commandes).

## Phase B : validation et déduplication (toi, pas les agents)

Relis tous les fichiers de `.security-audit/findings/` avec un regard critique : un agent a tendance à surestimer ses constats.

Pour chaque constat :
- statut `Confirmé` (PoC localhost réussie), `Probable` (chemin de code démontré, non testé) ou `Rejeté` (faux positif, une ligne d'explication) ;
- sévérité `critique`, `haute`, `moyenne`, `basse` ou `info`, selon l'impact réel sur ce site (données de speakers, compte admin, réputation de l'événement), pas selon la catégorie théorique ;
- fusion des doublons (même cause racine = un seul constat) ;
- identifiant stable `SEC-001`, `SEC-002`… par sévérité décroissante.

## Phase C : livrables

1. `.security-audit/RAPPORT.md` : résumé exécutif (5 lignes max), tableau `id | titre | sévérité | statut | fichier`, puis pour chaque constat retenu : description, impact, localisation `fichier:ligne`, étapes de reproduction, recommandation de correction avec extrait de code si utile, références CWE et OWASP. Les constats `Rejeté` vont dans une annexe courte.
2. `.security-audit/findings.json` : contrat d'échange avec l'étape 3, qui le lira **sans réinterpréter**. Rédige donc toi-même tous les textes publics ici. Un tableau d'objets, constats `Confirmé` et `Probable` uniquement :

```json
[
  {
    "id": "SEC-001",
    "severite": "haute",
    "statut": "Confirmé",
    "titre_public": "Durcissement des contrôles d'accès du module sponsors",
    "composant": "API sponsors",
    "description_publique": "Texte destiné à une issue publique.",
    "titre_advisory": "Titre technique précis",
    "description_advisory": "Description complète en markdown : cause, impact, reproduction, correctif.",
    "cwe": "CWE-639",
    "fichiers": ["src/backend/..."],
    "recommandation": "Correctif concret.",
    "effort": "S"
  }
]
```

Règles de rédaction des champs publics (le dépôt est public) :
- **critique / haute** : `titre_public` et `description_publique` neutres, sans nom de vulnérabilité, sans endpoint précis, sans reproduction. Formulation type « durcissement de… ». Le détail complet va uniquement dans `description_advisory`.
- **moyenne / basse / info** : `titre_public` explicite, `description_publique` complète (description, impact, fichiers, recommandation, références), sans PoC exploitable.

`effort` : `S` (moins d'une heure), `M` (une demi-journée), `L` (plus).

Termine par : le nombre de constats par sévérité, les 3 priorités, et « Étape suivante : `/audit-secu 3` (compatible Opus 4.8). »
