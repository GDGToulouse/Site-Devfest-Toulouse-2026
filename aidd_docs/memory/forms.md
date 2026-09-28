# Forms

## Approach

- Pas de bibliothèque de formulaires : état React local, champs partagés dans `src/frontend/src/components/admin/` (`FormField`, `BilingualInput` pour les paires FR/EN, `RichTextEditor` sur TipTap)
- La validation qui fait foi est côté serveur (JSON Schemas Fastify) ; `adminFetch` (`src/frontend/src/lib/admin-api.ts`) remonte le message du backend tel quel (#262)

## Conventions

- Après un enregistrement, `SaveFeedback` : le succès s'efface, **l'échec jamais** — un message d'erreur qui disparaît se lit comme un succès (#394)
- `adminFetch` renvoie `status: 0` quand la requête n'a pas atteint le backend : ne jamais tester `status >= 400` seul, succès = `200` (mise à jour), `201` (création) ou `204` (suppression) (#428)
- Messages utilisateur en français, sans détail technique : ce qui s'est passé et quoi faire
