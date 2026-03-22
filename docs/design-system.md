# Design System — Site DevFest Toulouse 2026

Référence unifiée couvrant la charte graphique, les guidelines de marque, le style guide, les design tokens, le UI Kit et le content style guide. Basé sur la charte graphique DevFest Toulouse 2024 et les maquettes Figma 2025.

Source de la charte : `docs/CharteGraphique_Devfest2024.pdf`
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

### Police principale — Product Sans

Police géométrique sans empattement créée par Google, utilisée pour le logo DevFest officiel. C'est la typographie dominante du site.

| Variante | Usage |
|----------|-------|
| **Product Sans Bold** | Titres, boutons, chiffres clés, noms |
| **Product Sans Regular** | Corps de texte, descriptions, navigation, labels |
| **Product Sans Italic** | Baselines sponsors (Platinum) |

### Police secondaire — CCSignLanguage

Police manuscrite utilisée en seconde lecture pour évoquer le partage et la convivialité.

| Usage | Contexte |
|-------|----------|
| Accroches, citations | Éléments de communication print et réseaux sociaux |

> Note : CCSignLanguage n'apparaît pas dans les maquettes web. Son usage est réservé aux supports de communication (réseaux sociaux, visuels, print).

### Fallback web

```css
font-family: 'Product Sans', sans-serif;
```

---

## 4. Design Tokens

### Typographie — Échelle

| Token | Font | Taille | Poids | Line Height | Usage |
|-------|------|--------|-------|-------------|-------|
| `heading-1` | Product Sans | 112px | Bold | 100% | Hero titre (DevFest, Toulouse) |
| `heading-2` | Product Sans | 64px | Bold | 120% | Titres de sections |
| `heading-3` | Product Sans | 48px | Bold | normal | Sous-titres (« Derrière le ») |
| `heading-4` | Product Sans | 40px | Bold | 120% | Noms sponsors Platinum, statistiques valeurs |
| `heading-5` | Product Sans | 36px | Bold | normal | Sous-sections (« Plongez dans… ») |
| `description` | Product Sans | 32px | Regular | 140% | Descriptions, texte hero |
| `description-bold` | Product Sans | 32px | Bold | 140% | Mots accentués dans descriptions |
| `card-title-l` | Product Sans | 40px | Bold | 120% | Titre sur carte Platinum |
| `card-title-m` | Product Sans | 32px | Bold | 120% | Titre sur carte Gold/autre |
| `card-title-s` | Product Sans | 24px | Bold | 110% | Titre article card |
| `stat-value` | Product Sans | 64px | Bold | 140% | Chiffre statistique |
| `stat-label` | Product Sans | 24px | Regular | 120% | Label statistique |
| `body` | Product Sans | 16px | Regular | 160% | Texte courant, navigation, footer |
| `body-bold` | Product Sans | 16px | Bold | 100% | Boutons, labels importants |
| `footer-heading` | Product Sans | 20px | Bold | 130% | Titres colonnes footer |
| `footer-text` | Product Sans | 16px | Regular | 160% | Liens footer |
| `caption` | Product Sans | 12px | Bold | 120% | Auteur article |
| `small` | Product Sans | 10px | Regular | 120% | Date, « by » |

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

### Icônes fonctionnelles (statistiques)

Les chiffres clés utilisent des icônes plus simples :

| Icône | Usage |
|-------|-------|
| Calendar | Journée / Date |
| Users | Participants |
| Mic | Conférences |
| Handshake | Stands / Partenaires |

### Icônes réseaux sociaux

Présentes dans le header (24px) et le footer (48px) :

| Réseau | Ordre d'affichage |
|--------|-------------------|
| LinkedIn | 1 |
| YouTube | 2 |
| X / Twitter | 3 |
| Bluesky | 4 |

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

---

## 8. Patterns de mise en page

### Hero (page d'accueil)

- Image de fond : coins arrondis gauches (radius 64px), overlay sombre 30%, occupe la partie droite (1024×768px)
- Titres : « DevFest » (Malachite, 112px) et « Toulouse » (Terre cuite, 112px) sur fond blanc avec coins arrondis
- Description : blocs blancs empilés avec texte 32px, coin arrondi bottom-right
- CTAs : alignés en bas à gauche

### Pages de contenu (Code de conduite, Mentions légales)

- Structure simple : breadcrumb + titre principal (H2) + paragraphes + sous-titres + footer
- Largeur de contenu : 1152px, marge gauche 100px

### Page de détail sponsor

- Layout deux colonnes :
  - Gauche : description longue (616px de large), texte riche multi-paragraphes
  - Droite : logo (512×300px), liens sociaux en dessous
- Breadcrumb en haut

### Page de contact

- Layout deux colonnes :
  - Gauche : formulaire (616px) — prénom/nom côte à côte, email, téléphone, objet (dropdown), message (textarea)
  - Droite : encart (512px) avec 3 blocs — « Délais de réponse » (texte bénévoles), « Nos réseaux » (icônes)
- CTA « Envoyer » centré sous le formulaire

### Grilles

- **Articles** : 4 colonnes, gap 48px
- **Sponsors Platinum** : 2 colonnes
- **Sponsors Gold/autres** : 4 colonnes

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

## 10. Récapitulatif des fichiers de référence

| Document | Contenu |
|----------|---------|
| `docs/CharteGraphique_Devfest2024.pdf` | Charte graphique officielle (logo, couleurs, typos, icônes) |
| `docs/maquettes-figma.md` | Inventaire des maquettes Figma |
| `docs/design-system.md` | Ce document (design system complet) |
