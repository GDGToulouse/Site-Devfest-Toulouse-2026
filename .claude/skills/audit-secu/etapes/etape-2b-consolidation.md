# Audit de sécurité, étape 2b : consolidation (reprise de l'étape 2)

Cette étape reprend l'étape 2 **après sa phase A**, quand les huit agents ont déjà écrit leurs constats mais que la consolidation n'a pas abouti (session interrompue, modèle Opus 5.5 indisponible). Elle ne relance aucun agent et ne fait aucune requête de test : elle relit, trie et rédige. Tout modèle convient (Opus 4.8 OK).

## Prérequis

- `.security-audit/findings/` contient les huit fichiers de la phase A : `acces.md`, `auth.md`, `injection.md`, `client.md`, `fichiers.md`, `metier.md`, `infra.md`, `supply-chain.md`. S'il en manque, arrête-toi et affiche : « Phase A incomplète (fichiers manquants : … ) : lance `/audit-secu 2`. »
- Lis aussi `docs/audit-droits-api.md` : un constat déjà corrigé, ou ouvert et **accepté** dans l'audit précédent, n'est pas re-signalé comme nouveau ; il est cité en annexe.
- Si `.security-audit/findings.json` existe déjà, demande-moi avant de l'écraser.

## Phase B : validation et déduplication

Relis les huit fichiers avec un regard critique : un agent a tendance à surestimer ses constats, et plusieurs agents décrivent souvent la même cause racine depuis leur domaine.

Pour chaque constat :
- statut `Confirmé` (PoC localhost réussie, consignée dans le fichier de l'agent), `Probable` (chemin de code démontré, non testé) ou `Rejeté` (faux positif ou choix produit assumé, une ligne d'explication) ;
- sévérité `critique`, `haute`, `moyenne`, `basse` ou `info`, selon l'impact réel sur ce site (données de speakers, compte admin, réputation de l'événement), pas selon la catégorie théorique ni la sévérité proposée par l'agent ;
- fusion des doublons : même cause racine = un seul constat, qui cite tous les fichiers d'agent d'origine ;
- identifiant stable `SEC-001`, `SEC-002`… par sévérité décroissante.

Un constat qui ne vit pas dans le code (réglage GitHub, configuration Coolify, poste d'un mainteneur) reste un constat : il le dit dans sa recommandation.

## Phase C : livrables

1. `.security-audit/RAPPORT.md` : résumé exécutif (5 lignes max), tableau `id | titre | sévérité | statut | fichier`, puis pour chaque constat retenu : description, impact, localisation `fichier:ligne`, recommandation de correction, références CWE et OWASP. Pour la reproduction, renvoie à la section du fichier d'agent qui la consigne (`findings/<domaine>.md`, identifiant de l'agent) au lieu de la recopier : chaque fait a une seule maison. Les constats `Rejeté` et les rappels de l'audit précédent vont dans une annexe courte.
2. `.security-audit/findings.json` : même contrat que l'étape 2 (`etape-2-analyse.md`, phase C), mêmes règles de rédaction des champs publics, constats `Confirmé` et `Probable` uniquement. `description_advisory` décrit cause, impact et correctif, et renvoie au fichier d'agent pour la reproduction.

Écris `findings.json` au fil de l'eau, par lots de sévérité, plutôt qu'en une seule fois à la fin : une interruption ne perd alors que le lot en cours.

Termine par : le nombre de constats par sévérité, les 3 priorités, et « Étape suivante : `/audit-secu 3` (compatible Opus 4.8). »
