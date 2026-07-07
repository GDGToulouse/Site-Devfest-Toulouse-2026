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
