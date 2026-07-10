# Template — commentaire enrichissant (Mode REFINE)

Format à utiliser **systématiquement** pour les commentaires de version rédigée. Le commentaire **complète** le body — il ne le remplace pas (ne jamais `gh issue edit --body`).

```markdown
## Version rédigée de l'issue

### Contexte

<1-3 paragraphes : situation actuelle, écart, ce que l'utilisateur veut.
Citer fichiers et lignes réels du repo.>

État actuel — [<fichier>](src/frontend/src/components/<X>.tsx) :
- L. NN : <ce qui est là>

### Périmètre

- <Ce qui est in, décisions de l'interview comme bullets actionnables>
- <Inclure les choix par défaut recommandés et validés par l'utilisateur>

### Tâches

- [ ] <Action concrète 1, formulation impérative>
- [ ] <Action concrète 2>
- [ ] <Test / validation (tsc, lint, Chrome DevTools si UI)>

### Critères d'acceptation

- [ ] <Comportement observable du POV utilisateur>
- [ ] <Rendu FR/EN si UI · Pas de régression sur X>

### Hors scope

- <Ce qui ressemble mais relève d'une autre issue>

### Liens

- Front : [<fichier>](src/frontend/src/app/<X>.tsx) · Back : [<route>](src/backend/src/routes/<X>.ts)
- Spec : [docs/...](docs/...)
- Issue origine : #NN · Couplée à : #NN
```

## Commentaire de mise à jour ponctuelle

Pour un commentaire qui ne rejoue pas le body en entier (résultat d'investigation, changement d'état) :

```markdown
**[YYYY-MM-DD] <résumé en une ligne>**

<Contenu : nouvelle info, résultat, décision prise, état actualisé.
Citer les fichiers / mesures concrets.>

Sources :
- <URL ou chemin>
```

## Règles communes

- **Jamais** appeler `gh issue edit --body …` — le body original est intouchable en mode REFINE
- Le commentaire complète, ne répète pas ce qui est déjà dans le body ou les commentaires précédents
- Citer la date au format ISO `[YYYY-MM-DD]` quand le commentaire actualise un état
- Pas de signature « Generated with Claude Code » ou équivalent
- Pas de credentials, tokens, mots de passe, secrets
- MAJ titre / labels / milestone via `gh issue edit` (sans `--body`) dans un call séparé — voir SKILL.md Step 5
