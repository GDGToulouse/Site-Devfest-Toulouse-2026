# Design

## System

- Charte DevFest Toulouse, tokens maison, pas de bibliothèque de composants tierce
- Tailwind (v4) en classes utilitaires ; maquettes dans Figma (`docs/maquettes-figma.md`)

## Tokens

- Couleurs, typographies et espacements déclarés dans `@theme` de `src/frontend/src/app/globals.css`
- Palette et kit UI : `docs/design-system.md`

## Components

- Site public : composants rangés par domaine sous `src/frontend/src/components/`
- Back-office : briques partagées sous `src/frontend/src/components/admin/` (`DataTable`, `FormField`, `ConfirmDialog`, `SaveFeedback`, `BilingualInput`, `RichTextEditor`)

## Accessibility

- Cible WCAG 2.1 AA, Lighthouse ≥ 90 et Core Web Vitals au vert (`docs/objectifs-techniques.md`)

## Gotchas

Une classe qui ne génère rien échoue en silence : vérifier au runtime (`getComputedStyle`, règles servies) plutôt que de faire confiance à la classe.

- `rounded-s` / `rounded-e` sont logiques (un seul côté) : `rounded-[12px]` pour les quatre coins
- `scrollbar-none` n'existe pas ici : `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
- Les variantes `print:` n'émettent rien : bascules d'impression écrites à la main dans le `@media print` de `globals.css` (`.print-grid`, `.no-print`)
- Le modificateur important est un suffixe en v4 : `hidden!`, pas `!hidden`
- Jamais de `*/` dans un commentaire CSS (`bg-*/text-*` ferme le commentaire et casse tout le bloc qui suit)
- Pleine hauteur sur mobile : `h-dvh` et un `padding-bottom` de sécurité sur la zone qui défile, sinon le dernier bouton passe sous les barres du navigateur (#257)
- Un `sticky` vertical est mort dans un parent `overflow-x: auto`, et borner la hauteur du parent est une fausse solution. Modèle qui marche : `ScheduleGrid.tsx` (#460), qui duplique la ligne d'en-têtes hors du conteneur
- Faire remplir une cellule de tableau par son contenu (`h-full`) : la hauteur nominale va sur le `<table>` (`h-px`), jamais sur la cellule. Un `h-px` sur une cellule à `rowSpan` passe dans Chrome et Safari, mais Firefox le prend au pied de la lettre et écrase les lignes (#550)
