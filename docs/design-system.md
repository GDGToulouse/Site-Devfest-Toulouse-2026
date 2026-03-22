# Design System — Site DevFest Toulouse 2026

Référence unifiée couvrant la charte graphique, les guidelines de marque, le style guide, les design tokens, le UI Kit et le content style guide. Basé sur la charte graphique DevFest Toulouse 2024 et les maquettes Figma 2025.

Source des maquettes : [Figma DevFestToulouse-2025](https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499)

---

## 1. Brand Guidelines

### Identité

Le DevFest Toulouse est la plus grande conférence tech du bassin toulousain, organisée par le GDG Toulouse. L'identité visuelle s'ancre dans deux univers :

- **Toulouse** : la brique (terre cuite), le spatial (lettres en lévitation), la croix occitane, La Grave
- **Tech / DevFest mondial** : le logo DevFest officiel, la palette Google, les icônes pixel/web

### Logo

Le logo se compose de deux éléments :
- Le **logo DevFest** officiel (chevrons `<>`)
- Le **typogramme « TOULOUSE »** en dessous, avec des lettres en lévitation évoquant le spatial, agrémentées de carrés symbolisant l'univers, le web, les étoiles et le pixel

Toulouse prend visuellement le pas en occupant plus d'espace.

#### Déclinaisons

| Variante | Usage |
|----------|-------|
| **Brique** (Light Mode) | Fond clair, usage principal |
| **Bicolore** (Light Mode) | Fond clair, variante |
| **Brique** (Dark Mode) | Fond sombre |
| **White** (Dark Mode) | Fond sombre, monochrome blanc |
| **Minimal** | Espaces contraints (favicon, avatar, réseaux sociaux) |

#### Règles d'usage

- Toujours respecter la zone de protection autour du logo
- Ne pas déformer, pivoter ou modifier les couleurs du logo
- Sur fond photographique, utiliser un overlay ou un conteneur blanc semi-transparent
- Le logo dans le header utilise la version minimale (avatar) ; le footer utilise la version complète

### Ton et voix

- **Communautaire** : « par les devs, pour les devs »
- **Convivial** : « Sans bug depuis 2016 » (tagline footer)
- **Local** : références toulousaines (chocolatines, La Grave, croix occitane)
- **Accessible** : pas de jargon excessif, bilingue FR/EN

---

## 2. Palette de couleurs

### Couleurs principales

Les nuances principales représentent directement Toulouse (brique) et leur complémentaire (vert).

| Nom | Hex | RGB | Rôle |
|-----|-----|-----|------|
| **Bismarck** | `#B94420` | 185, 68, 32 | Accent sombre chaud, liens auteur |
| **Terre cuite** | `#EC6839` | 236, 104, 57 | Couleur identitaire, titres H1, CTA hover |
| **Incarnadin** | `#F4A598` | 244, 166, 152 | Accent clair chaud |
| **Malachite** | `#109E6E` | 16, 158, 110 | Couleur identitaire verte, footer, titres accentués |
| **Émeraude** | `#41B38E` | 66, 179, 142 | Bandeau sponsors Platinum |
| **Menthe** | `#8BCBB7` | 139, 203, 183 | Accent vert clair |
| **Eau** | `#C0E1D7` | 192, 225, 215 | Fond vert très clair |

### Couleurs secondaires

| Nom | Hex | RGB | Rôle |
|-----|-----|-----|------|
| **Bleu** | `#507BBD` | 80, 123, 189 | Boutons CTA principaux |
| **Bleu 2** | `#63C6F2` | 99, 198, 242 | Accent bleu clair |
| **Bleu 3** | `#C4E6F1` | 196, 230, 241 | Fond bleu très clair |
| **Vert 1** | `#31A853` | 49, 168, 83 | Palette Google |
| **Vert 2** | `#72BA69` | 114, 186, 105 | Palette Google |
| **Vert 3** | `#CDE3C0` | 205, 227, 192 | Palette Google |
| **Orangé** | `#F8AB06` | 248, 171, 6 | Palette Google |
| **Jaune** | `#FFD428` | 255, 212, 40 | Bandeau sponsors Gold |
| **Jaune clair** | `#FFE8A5` | 255, 232, 165 | Accent jaune |
| **Rouge** | `#E84336` | 232, 67, 54 | Erreurs, alertes |
| **Rose** | `#EE7CAD` | 238, 124, 173 | Bandeau sponsors Silver/autres |
| **Rose clair** | `#F8D8D8` | 248, 216, 216 | Accent rose |

### Neutres

| Nom | Hex | RGB | Rôle |
|-----|-----|-----|------|
| **Noir** | `#1D1D1B` | 29, 29, 27 | Texte principal, titres |
| **Gris** | `#777776` | 119, 119, 118 | Texte navigation |
| **Gris clair** | `#8E8E8D` | 142, 142, 141 | Texte secondaire (dates, mentions) |
| **Gris placeholder** | `#808080` | 128, 128, 128 | Texte tertiaire (baselines sponsors) |
| **Blanc** | `#FFFFFF` | 255, 255, 255 | Fond de page, texte sur fond sombre |
| **Blanc cassé** | `#FDF0EB` | 253, 240, 235 | Texte liens footer |

### Couleurs sémantiques

| Usage | Couleur | Hex |
|-------|---------|-----|
| Boutons CTA (principal) | Bleu | `#507BBD` |
| Boutons CTA (secondaire) | Bleu outline | `#507BBD` border |
| Fond footer | Malachite | `#109E6E` |
| Titre « DevFest » | Malachite | `#109E6E` |
| Titre « Toulouse » | Terre cuite | `#EC6839` |
| Lien cliquable (body) | Bismarck | `#703B27` |
| Lien cliquable (footer) | Blanc cassé | `#FDF0EB` |
| Auteur article | Bismarck | `#B94420` |
| Sponsor Platinum | Émeraude | `#41B38E` |
| Sponsor Gold | Jaune | `#FFD428` |
| Sponsor Silver/autre | Rose | `#EE7CAD` |

---

## 3. Typographie

### Police principale — Google Sans

Police géométrique sans empattement créée par Google (anciennement connue sous le nom Product Sans). Disponible sur [Google Fonts](https://fonts.google.com/specimen/Google+Sans) sous licence SIL Open Font License depuis novembre 2025.

C'est la typographie utilisée pour le logo DevFest officiel et la police dominante du site.

| Variante | Usage |
|----------|-------|
| **Google Sans Bold** | Titres, boutons, chiffres clés, noms |
| **Google Sans Regular** | Corps de texte, descriptions, navigation, labels |
| **Google Sans Italic** | Baselines sponsors (Platinum) |

#### Chargement web

```html
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

```css
font-family: 'Google Sans', sans-serif;
```

### Police secondaire — CCSignLanguage

Police manuscrite utilisée en seconde lecture pour évoquer le partage et la convivialité.

| Usage | Contexte |
|-------|----------|
| Accroches, citations | Éléments de communication print et réseaux sociaux |

> Note : CCSignLanguage n'apparaît pas dans les maquettes web. Son usage est réservé aux supports de communication (réseaux sociaux, visuels, print).

---

## 4. Design Tokens

### Typographie — Échelle

| Token | Font | Taille | Poids | Line Height | Usage |
|-------|------|--------|-------|-------------|-------|
| `heading-1` | Google Sans | 112px | Bold | 100% | Hero titre (DevFest, Toulouse) |
| `heading-2` | Google Sans | 64px | Bold | 120% | Titres de sections |
| `heading-3` | Google Sans | 48px | Bold | normal | Sous-titres (« Derrière le ») |
| `heading-4` | Google Sans | 40px | Bold | 120% | Noms sponsors Platinum, statistiques valeurs |
| `heading-5` | Google Sans | 36px | Bold | normal | Sous-sections (« Plongez dans… ») |
| `description` | Google Sans | 32px | Regular | 140% | Descriptions, texte hero |
| `description-bold` | Google Sans | 32px | Bold | 140% | Mots accentués dans descriptions |
| `card-title-l` | Google Sans | 40px | Bold | 120% | Titre sur carte Platinum |
| `card-title-m` | Google Sans | 32px | Bold | 120% | Titre sur carte Gold/autre |
| `card-title-s` | Google Sans | 24px | Bold | 110% | Titre article card |
| `stat-value` | Google Sans | 64px | Bold | 140% | Chiffre statistique |
| `stat-label` | Google Sans | 24px | Regular | 120% | Label statistique |
| `body` | Google Sans | 16px | Regular | 160% | Texte courant, navigation, footer |
| `body-bold` | Google Sans | 16px | Bold | 100% | Boutons, labels importants |
| `footer-heading` | Google Sans | 20px | Bold | 130% | Titres colonnes footer |
| `footer-text` | Google Sans | 16px | Regular | 160% | Liens footer |
| `caption` | Google Sans | 12px | Bold | 120% | Auteur article |
| `small` | Google Sans | 10px | Regular | 120% | Date, « by » |

### Espacement

| Token | Valeur | Usage |
|-------|--------|-------|
| `space-xs` | 4px | Micro-espacement |
| `space-s` | 8px | Padding interne petit |
| `space-m` | 12px | Gaps icônes, padding boutons |
| `space-l` | 16px | Gaps navigation, padding standard |
| `space-xl` | 24px | Gaps entre sections proches |
| `space-2xl` | 32px | Padding conteneurs, gaps CTA |
| `space-3xl` | 48px | Gaps grilles d'articles |
| `space-4xl` | 64px | Padding sections |
| `space-5xl` | 80px | Gap entre titre et contenu statistiques |

### Rayons de bordure

| Token | Valeur | Usage |
|-------|--------|-------|
| `radius-s` | 12px | Boutons petits (header) |
| `radius-m` | 16px | Cartes sponsors, conteneurs texte |
| `radius-l` | 18px | Boutons CTA grands |
| `radius-xl` | 20px | Cartes statistiques |
| `radius-2xl` | 24px | Logo placeholder |
| `radius-3xl` | 32px | Article cards, footer, conteneurs |
| `radius-4xl` | 40px | Encart statistiques, coins hero |
| `radius-5xl` | 56px | Image « À propos » |
| `radius-hero` | 64px | Image hero |

### Ombres

| Token | Valeur | Usage |
|-------|--------|-------|
| `shadow-header` | `0 4px 12px rgba(29,29,27, 0.10)` | Header fixe |
| `shadow-card` | `0 12px 16px 4px rgba(29,29,27, 0.14)` | Article cards |
| `shadow-section` | `0 4px 64px 4px rgba(29,29,27, 0.12)` | Encarts flottants (stats, footer) |

### Largeurs

| Token | Valeur | Usage |
|-------|--------|-------|
| `page-width` | 1440px | Largeur de référence desktop |
| `content-width` | 1240px | Largeur du contenu (footer barre basse) |
| `content-padding` | 100px | Marge latérale du contenu |
| `card-width-article` | 300px | Largeur article card |
| `card-height-article` | 400px | Hauteur article card |
| `card-width-sponsor-l` | 340px | Largeur carte sponsor (Platinum) |
| `card-height-sponsor-l` | 481px | Hauteur carte sponsor (Platinum) |
| `card-width-sponsor-m` | 340px | Largeur carte sponsor (Gold/autre) |
| `card-height-sponsor-m` | 240px | Hauteur carte sponsor (Gold/autre) |

---

## 5. Iconographie

### Style

Les icônes suivent un style **croquis / esquisse** (hand-drawn), déclinable en trois couleurs :

| Couleur | Hex | Usage |
|---------|-----|-------|
| Bismarck | `#B94420` | Sur fond clair |
| Terre cuite | `#EC6839` | Sur fond clair, accentuation |
| Malachite | `#109E6E` | Sur fond clair, variante verte |

### Icônes fonctionnelles — Font Awesome

Les icônes fonctionnelles du site utilisent [Font Awesome](https://fontawesome.com/) (licence gratuite, compatible open source / commercial).

#### Chiffres clés (statistiques)

| Icône | Font Awesome | Usage |
|-------|-------------|-------|
| Calendar | `fa-calendar-days` | Journée / Date |
| Users | `fa-users` | Participants |
| Mic | `fa-microphone` | Conférences |
| Handshake | `fa-handshake` | Stands / Partenaires |

#### Réseaux sociaux

Présents dans le header (24px) et le footer (48px) :

| Réseau | Font Awesome | Ordre |
|--------|-------------|-------|
| LinkedIn | `fa-brands fa-linkedin` | 1 |
| YouTube | `fa-brands fa-youtube` | 2 |
| X / Twitter | `fa-brands fa-x-twitter` | 3 |
| Bluesky | `fa-brands fa-bluesky` | 4 |

Toutes ces icônes sont disponibles dans le plan gratuit de Font Awesome 7.

---

## 6. Illustrations

Les maquettes intègrent des illustrations locales renforçant l'identité toulousaine :

| Illustration | Emplacement | Description |
|--------------|-------------|-------------|
| **La Grave** | Section statistiques (gauche) | Silhouette du dôme de La Grave, bâtiment emblématique de Toulouse |
| **Croix occitane** | Section sponsors (coin haut droit) | Croix occitane stylisée, légèrement pivotée (~22°) |

Ces illustrations sont monochromes et utilisent les couleurs de la charte.

---

## 7. UI Kit — Composants

### Boutons

| Variante | Taille | Style | Usage |
|----------|--------|-------|-------|
| **Principal** | Large | Fond bleu (#507BBD), texte blanc, bold 24px, radius 18px, padding 20px 32px | CTAs page (« Devenir Partenaire », « Proposer un talk ») |
| **Principal** | Small | Fond bleu (#507BBD), texte blanc, bold 16px, radius 12px, padding 12px 18px | CTAs header, footer |
| **Secondaire** | Large | Bordure 3px bleu (#507BBD), texte bleu, bold 24px, radius 18px, padding 20px 32px | CTA secondaire hero |
| **Secondaire** | Small | Bordure 2px bleu (#507BBD), texte bleu, bold 16px, radius 12px, padding 12px 18px | CTA secondaire header |

### Header

- Hauteur : 60px
- Fond : blanc avec ombre `shadow-header`
- Gauche : logo (avatar 48px) + navbar (4 liens, Product Sans Regular 16px, gris #777776, tracking 0.4px)
- Droite : réseaux sociaux (4 icônes 24px) + 2 CTAs (Small)

### Footer

- Fond : Malachite (#109E6E), radius 32px, ombre `shadow-section`
- Haut gauche : logo complet DevFest Toulouse (333×150px)
- Sous le logo : « Suivez l'aventure en ligne : » + 4 icônes réseaux (48px)
- Centre : CTA « Contactez nous » (Small)
- Haut droite : 3 colonnes (Navigation, Écosystèmes tech, Éditions précédentes)
- Barre basse : fond blanc 75% opacité, radius 18px, texte tagline + liens (Mentions légales, Code de conduite, Plan du site)

### Breadcrumb

- Présent sur toutes les pages sauf l'accueil
- Position : sous le header, marge gauche 100px, top 124px

### Article Card

- Dimensions : 300×400px
- Fond : blanc, radius 32px, ombre `shadow-card`
- Thumbnail : 280×210px, radius 26px, centré en haut (marge 10px)
- Titre : Product Sans Bold 24px, noir, max 260px de large
- Auteur : « by » (Regular 10px gris) + nom (Bold 12px Bismarck #B94420)
- Pied de carte : date (Regular 10px gris) + « Lire » (Regular 16px noir, tracking 0.4px)

### Partner Card

#### Platinum (grande)

- Dimensions : 340×481px, radius top 16px
- Bandeau couleur en haut : 24px, Émeraude (#41B38E)
- Contenu centré : logo (267×200px, radius 24px), nom (Bold 40px), baseline (Italic 16px gris)

#### Gold / Autres (moyenne)

- Dimensions : 340×240px, radius top 16px
- Bandeau couleur en haut : 24px (Jaune #FFD428 pour Gold, Rose #EE7CAD pour autres)
- Contenu centré : logo (200×150px, radius 24px), nom (Bold 32px)

### Statistique

- Encart blanc, radius 40px, ombre `shadow-section`
- Titre : texte mixte (Regular + Bold coloré : « tech » en Malachite, « Toulousain » en Terre cuite)
- 4 blocs : icône (48px) + valeur (Bold 64px) + label (Regular 24px)
- Blocs de 298×192px, radius 20px

### Éléments de formulaire (page Contact)

| Élément | Style |
|---------|-------|
| Text input | Label au-dessus, largeur 616px (ou 292px en demi-largeur) |
| Select dropdown | Même style que text input, avec icône chevron |
| Textarea | Largeur 616px, hauteur 400px |
| Label | Product Sans Regular, au-dessus du champ |
| Bouton submit | MainCallToAction centré sous le formulaire |

---

## 8. Patterns de mise en page

### Template commun

Toutes les pages suivent le même squelette :

```
Header (60px, fixe)
└── Breadcrumb (sauf accueil, position : left 100px, top 124px)
    └── Contenu (largeur variable selon le type de page)
        └── Footer (496px, fond Malachite, radius 32px)
```

### Hero (page d'accueil)

- Image de fond : coins arrondis gauches (radius 64px), overlay sombre 30%, occupe la partie droite (1024×768px)
- Titres : « DevFest » (Malachite, 112px) et « Toulouse » (Terre cuite, 112px) sur fond blanc avec coins arrondis
- Description : blocs blancs empilés avec texte 32px, coin arrondi bottom-right
- CTAs : alignés en bas à gauche

### Pages de liste

Structure commune : breadcrumb + grille de cards + footer.

| Page | Grille | Card |
|------|--------|------|
| Actualités | 4 colonnes, gap 48px | ArticleCard 300×400px |
| Conférences | Grille de session cards | Card avec titre, speaker, catégorie |
| Speakers | Grille de speaker cards | Card avec photo, nom, entreprise |
| Partenaires | Hiérarchie par niveau | PartnerCard Platinum (340×481px) + Gold/autres (340×240px) |

### Pages de détail — deux colonnes

| Page | Colonne gauche (616px) | Colonne droite (512px) |
|------|------------------------|------------------------|
| Partenaire | Description longue (multi-paragraphes) | Logo (512×300px) + liens sociaux |
| Contact | Formulaire (6 champs + submit) | Infos pratiques (délais, réseaux sociaux) |

### Pages de détail — contenu riche

Pour les articles, le code de conduite et les mentions légales :

- Largeur de contenu : 1152px, marge gauche 100px
- Titre principal : H2 (64px Bold)
- Sous-sections : H4/H5 (36-40px Bold)
- Corps de texte : 16px Regular, line-height 1.6
- Paragraphes séparés par des espacements réguliers

### Pages de détail — profil

| Page | Structure |
|------|-----------|
| Speaker | Photo + nom/entreprise/ville + bio + réseaux sociaux (Socials) + liste des sessions |
| Conférence | Titre + speaker(s) + description + métadonnées (format, catégorie, niveau, langue, salle, horaire) |

---

## 9. Content Style Guide

### Langue

- Français par défaut, anglais en alternative
- Tous les contenus éditoriaux existent dans les deux langues
- Les noms propres (DevFest, speakers, sponsors) ne sont pas traduits

### Titres et textes

- Les titres de sections utilisent un format accrocheur avec hashtag : « Ils soutiennent le **#DevFestToulouse** »
- Le hero utilise une description conversationnelle : « La conférence Toulousaine par les **devs** et pour les **devs**. »
- Le footer utilise un ton léger : « Sans bug depuis 2016 »

### Conventions typographiques

| Élément | Convention |
|---------|-----------|
| Nom de l'événement | DevFest Toulouse (majuscules D et F) |
| Hashtag | #DevFestToulouse (camelCase) |
| Dates | Format long : « 13 novembre 2025 » |
| Lieu | Nom court : « Diagora Labège » |
| Boutons CTA | Impératif ou infinitif : « Devenir partenaire », « Proposer un talk », « Contactez nous » |
| Liens de navigation | Nom court sans article : « Programme », « Speakers », « Partenaires », « Actus » |

### Réseaux sociaux

Ordre d'affichage constant : LinkedIn, YouTube, X/Twitter, Bluesky.

### SEO et meta

- Chaque page a un `<title>` unique au format : `Nom de page — DevFest Toulouse 2026`
- Les descriptions meta sont concises (< 160 caractères)
- Les images OG respectent 1200×630px minimum

---

## 10. Inventaire des assets (`docs/assets/`)

### Logo

Disponible en 2 variantes (Principal et Secondaire/Minimal), chacune en 5 déclinaisons couleur :

| Déclinaison | Light/Dark | Fichiers |
|-------------|------------|----------|
| Brique Light Mode | Light | SVG, PNG, JPG, EPS, PDF |
| Bicolor Light Mode | Light | SVG, PNG, JPG, EPS, PDF |
| Bicolor Dark Mode | Dark | SVG, PNG, JPG, EPS, PDF |
| White Dark Mode | Dark | SVG, PNG, JPG, EPS, PDF |
| Noir Blanc | Neutre | SVG, PNG, JPG, EPS, PDF |

- **Web** : utiliser les SVG dans `docs/assets/Logo/Principal/RVB/svg/` et `docs/assets/Logo/Secondaire/RVB/svg/`
- **Print** : utiliser les EPS/PDF dans `docs/assets/Logo/*/CMJN/`

### Illustrations style croquis

30 illustrations déclinées en 3 couleurs (Bismarck, Malachite, Terre cuite) = **90 fichiers PNG**.

Organisées dans `docs/assets/{Bismarck,Malachite,TerreCuite}/`.

#### Illustrations utilisées dans les maquettes

| Illustration | Emplacement | Fichier |
|--------------|-------------|---------|
| La Grave | Section statistiques (accueil) | `LaGraveIlluDevFest.png` |
| Croix occitane | Section sponsors (accueil) | `CroixOccitaneIlluDevFest.png` |

#### Catalogue complet des illustrations

| Catégorie | Illustrations |
|-----------|---------------|
| **Monuments** | La Grave, Pont Neuf |
| **Symboles** | Croix occitane, Violette, Étoile |
| **Personnages** | Geek, Geeke |
| **Nourriture** | Burger, Croissant, Café, Cocktail, Boisson fraîche, Sandwich, Miam |
| **Tech/Web** | Site Web, Site Web 2, DevFest |
| **Décoration** | Flèche (×3), Soulignement (×3), Accolade droite/gauche, Entouré (×3), Expression, Exclamation, Point d'exclamation |
| **Événement** | Communauté, Sponsors, Micro, Vestiaire, Toilette |
| **Divers** | Tracteur, Monde Agri, Plane |

> Note : les illustrations sont en PNG uniquement. Pour le web, une conversion en SVG serait souhaitable à terme pour le poids et la scalabilité.

---

## 11. Récapitulatif des fichiers de référence

| Document | Contenu |
|----------|---------|
| `docs/maquettes-figma.md` | Inventaire des maquettes Figma et structure des pages |
| `docs/maquettes/*.svg` | Exports SVG de toutes les maquettes (référence visuelle durable) |
| `docs/assets/` | Logo (SVG/PNG/EPS), illustrations croquis (PNG, 3 couleurs) |
| `docs/design-system.md` | Ce document (design system complet) |
