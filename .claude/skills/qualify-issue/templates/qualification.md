# Template — commentaire de qualification

Format à utiliser pour le commentaire posté sur l'issue. Il **complète** le body (le constat du déclarant) — il ne le remplace pas.

Adapter les sections selon la nature. Pour un **bug**, la cause racine et le correctif sont le cœur. Pour une **amélioration**, insister sur le périmètre et les décisions ouvertes.

```markdown
## Qualification technique

**Cause racine** : <une à deux phrases qui expliquent le POURQUOI, pas juste le symptôme.
Pour un bug simple, une seule cause ; pour un bug systémique, nommer le pattern.>

### Détail
1. **<Étape / couche 1>** — `chemin/fichier.ts:LL` : <ce qui s'y passe, extrait de code si utile>.
2. **<Étape / couche 2>** — `chemin/fichier.tsx:LL` : <…>.
3. **<Rendu / effet observable>** — <pourquoi l'utilisateur voit le symptôme décrit>.

### <Bug systémique / Note de scope>  ← section conditionnelle
<Si la même cause touche plusieurs endroits, les lister. Si c'est une amélioration
avec un choix de périmètre, poser la question.>

### Correctif proposé
- **Principal** : <action concrète, fichier:ligne>.
- **Secondaire** : <si un bug connexe a été trouvé au passage>.

### Fichiers concernés
- `chemin/fichier.ts:LL-LL`
- `chemin/fichier.tsx:LL`
```

## Variante — qualification partielle (cause racine non trouvée)

Quand l'investigation n'aboutit pas à une cause certaine, **ne pas maquiller une hypothèse en diagnostic**. Utiliser cette forme :

```markdown
## Qualification technique — partielle, il manque des éléments pour trancher

<Une phrase : ce qui a été exploré, et le fait que la cause n'est pas établie.>

### Ce que j'ai vérifié et écarté

| Piste | Verdict |
|---|---|
| <hypothèse testée> | ✅ **fonctionne** — <preuve concrète : code HTTP, ligne de code, mesure> |

### La piste qui reste

<L'hypothèse la plus plausible, présentée COMME une hypothèse, avec ce qui la
rend crédible et ce qui la rendrait fausse.>

### Ce qui m'aiderait à conclure

<Voir « Poser des questions au déclarant » ci-dessous. Maximum 3, sans jargon,
chacune avec sa valeur par défaut.>
```

Cette variante a autant de valeur qu'une qualification complète : elle évite que la personne suivante refasse les mêmes vérifications.

## Poser des questions au déclarant

Le corps de la qualification (cause racine, `fichier:ligne`, correctif) s'adresse à **qui implémentera** — il reste technique. Les questions posées au déclarant s'adressent à **qui a rencontré le problème** — souvent un organisateur, pas un développeur. Registre différent.

**Quatre règles :**

1. **Trois questions maximum.** Au-delà, on transfère le travail d'investigation au déclarant.
2. **Toujours annoncer une valeur par défaut.** Une question sans défaut oblige à répondre ; une question avec défaut permet de ne répondre que pour corriger. Écrire « sauf indication contraire, je pars du principe que c'est le site en ligne » plutôt que « sur quel environnement ? ».
3. **Aucun jargon.** Voir le lexique dans [references/vocabulaire-utilisateur.md](../references/vocabulaire-utilisateur.md). Ne jamais demander d'ouvrir la console, de lire un onglet réseau ou de distinguer deux chemins de code.
4. **Une capture d'écran vaut mieux que trois questions.** La demander en premier ; elle répond souvent à tout le reste d'un coup.

**Ne poser une question que si sa réponse change le diagnostic.** Si les deux réponses possibles mènent au même correctif, ne pas la poser.

## Règles

- **Citer du code réel et vérifié** (`Read`/`Grep` avant d'affirmer une ligne). Ne pas inventer de chemins ou de numéros de ligne.
- **Expliquer la cause, pas seulement le symptôme** — l'issue décrit déjà le symptôme.
- **Signaler les bugs systémiques** : si le correctif d'un champ s'applique à N champs identiques, le dire (évite un fix partiel).
- **Distinguer ce qui est confirmé de ce qui reste une hypothèse** — si un point n'a pas pu être vérifié, l'écrire explicitement.
- **Pas de secrets** (tokens, mots de passe, `DATABASE_URL`, secrets OAuth/SMTP).
- **Pas de signature** « Generated with Claude Code ».
- Les labels se posent **après** le commentaire, via `gh issue edit --add-label` (jamais `--body`). Voir SKILL.md Step 5.

## Exemple réel (issue #166)

> **Cause racine** : le frontend transforme un champ vidé (`""`) en `undefined` avant l'envoi. `JSON.stringify` supprime alors la clé du payload, et le backend interprète l'absence de clé comme « ne pas modifier » → l'ancienne valeur est réécrite.
>
> Détail : `GeneralTab.tsx:71` (`form.archivedSiteUrl || undefined`) → clé retirée ; `admin/editions.ts:149` retombe sur `existing.archivedSiteUrl`.
>
> Bug systémique : le pattern `|| undefined` touche tous les champs optionnels de `persist()` (`GeneralTab.tsx:63-71`).

→ labels posés : `bug`, `admin`.
