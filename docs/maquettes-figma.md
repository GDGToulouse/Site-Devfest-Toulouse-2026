# Maquettes Figma — Site DevFest Toulouse 2026

Maquettes de référence pour le design du site, réalisées sur Figma et exportées en SVG dans `docs/maquettes/`.

---

## Accès

- **Fichier Figma** : [DevFestToulouse-2025](https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499) (page « Site web »)
- **Exports SVG** : `docs/maquettes/*.svg` (référence locale durable)

---

## Pages maquettées

Toutes les maquettes sont en version desktop (1440px). Le template commun est : Header (60px) → Breadcrumb (sauf accueil) → Contenu → Footer (496px).

### Pages publiques principales

| Page | Route | Fichier SVG | Hauteur | Description |
|------|-------|-------------|---------|-------------|
| Accueil | `/home` | `home.svg` | 6436px | Hero, chiffres clés, sponsors, à propos, articles |
| Conférences | `/conferences` | `conferences.svg` | 1842px | Liste des sessions en grille avec breadcrumb « Programme » |
| Détail conférence | `/conference/:slug` | `conference.slug.svg` | 1842px | Détail d'une session (titre, speaker, description, salle, horaire) |
| Speakers | `/speakers` | `speakers.svg` | 1842px | Grille de cards speakers |
| Détail speaker | `/speaker/:slug` | `speaker.slug.svg` | 1842px | Fiche speaker (photo, bio, réseaux sociaux, sessions associées) |
| Partenaires | `/partners` | `partners.svg` | 1842px | Grille de sponsors par niveau (Platinum, Gold, autres) |
| Détail partenaire | `/partner/:slug` | `partner.slug.svg` | 1408px | Fiche sponsor : description à gauche (616px), logo + sociaux à droite (512px) |
| Actualités | `/actualites` | `actualites.svg` | 1842px | Grille de 7 ArticleCards (4 colonnes, 2 lignes) |
| Détail article | `/actualite/:slug` | `actualite.slug.svg` | 2119px | Article complet : titre, contenu riche, paragraphes et sous-titres |

### Pages de contenu

| Page | Route | Fichier SVG | Hauteur | Description |
|------|-------|-------------|---------|-------------|
| Contact | `/contact` | `contact.svg` | 1949px | Formulaire (prénom, nom, email, téléphone, objet, message) + encart latéral (délais, réseaux sociaux) |
| Code de conduite | `/code-de-conduite` | `code-de-conduite.svg` | 2119px | Contenu textuel riche avec titre principal et sous-sections |
| Mentions légales | `/mentions-legales` | `mentions-legales.svg` | 2119px | Contenu textuel avec sections légales |

---

## Composants partagés

| Composant | Présent sur | Description |
|-----------|-------------|-------------|
| Header | Toutes les pages | Logo + navbar (Programme, Speakers, Partenaires, Actus) + réseaux sociaux + 2 CTAs |
| Footer | Toutes les pages | Logo + réseaux sociaux + 3 colonnes de liens + CTA contact + barre basse |
| Breadcrumb | Toutes sauf accueil | Fil d'Ariane contextuel (position : marge gauche 100px, top 124px) |
| ArticleCard | Accueil, Actualités | Carte 300×400px (thumbnail, titre, auteur, date, « Lire ») |
| PartnerCard | Accueil, Partenaires | Carte sponsor avec bandeau couleur, logo et nom |
| MainCallToAction | Accueil, Contact, Partenaires, Footer | Bouton d'action (Large/Small, Principal/Secondaire) |
| Socials | Header, Footer, Partenaire détail, Contact | 4 icônes réseaux sociaux (LinkedIn, YouTube, X, Bluesky) |
| StatIcon | Accueil | Icônes chiffres clés (Calendar, Users, Mic, Handshake) |

---

## Structure détaillée par page

### Page d'accueil (`home.svg` — 6436px)

1. **Header** (60px)
2. **HeroSection** (850px) — image de fond arrondie à gauche, titre « DevFest Toulouse » (vert + terre cuite), description, date, lieu, 2 CTAs
3. **StatisticsWrapper** (800px) — encart blanc arrondi avec chiffres clés (journée, participants, conférences, stands), illustration La Grave
4. **PartnersSection** (2425px) — titre « Ils soutiennent le #DevFestToulouse », CTA, grille Platinum (2 colonnes, 340×481px) + grilles Gold/autres (4 colonnes, 340×240px), illustration croix occitane
5. **AboutUs** (1024px) — « Derrière le #DevFestToulouse », image + texte, CTAs écosystème (ToulouseTech, CloudToulouse)
6. **Articles** (765px) — « Dernières actualités », lien « Lire plus d'articles », 4 ArticleCards
7. **Footer** (496px)

### Pages de liste

Toutes suivent le même template :

- Header (60px) + Breadcrumb (à 124px du top) + Grille de contenu + Footer (496px)
- Largeur de contenu : ~1240-1344px, marge latérale ~48-100px

| Page | Disposition de la grille |
|------|--------------------------|
| Actualités | 4 colonnes d'ArticleCards (300×400px), gap 48px, 2 lignes = 7 articles |
| Conférences | Grille de session cards |
| Speakers | Grille de speaker cards |
| Partenaires | Hiérarchie par niveau : Platinum (grands) puis Gold/autres (petits) |

### Pages de détail — deux colonnes

| Page | Colonne gauche (616px) | Colonne droite (512px) |
|------|------------------------|------------------------|
| Partenaire détail | Description longue (multi-paragraphes) | Logo (512×300px) + liens sociaux |
| Contact | Formulaire (6 champs + submit) | Infos pratiques (délais, réseaux sociaux) |

### Pages de détail — contenu riche

| Page | Structure |
|------|-----------|
| Article détail | Breadcrumb + titre H2 + contenu riche (paragraphes, sous-titres H4/H5) sur 1152px de large |
| Code de conduite | Breadcrumb + titre H2 + sections avec sous-titres + paragraphes sur 1152px |
| Mentions légales | Breadcrumb + titre H2 + sections légales sur 1152px |

### Pages de détail — profil

| Page | Structure |
|------|-----------|
| Speaker détail | Breadcrumb + photo + nom/entreprise/ville + bio + réseaux sociaux + sessions associées |
| Conférence détail | Breadcrumb + titre + speakers + description + métadonnées (format, catégorie, niveau, langue, salle, horaire) |

---

## Éléments de formulaire (page Contact)

| Champ | Type | Layout |
|-------|------|--------|
| Prénom | Text input | Côte à côte avec Nom (292px chacun) |
| Nom | Text input | Côte à côte avec Prénom |
| Email | Text input | Pleine largeur (616px) |
| Téléphone | Text input | Pleine largeur |
| Objet | Select/dropdown | Pleine largeur |
| Message | Textarea | Pleine largeur (400px de haut) |
| Envoyer | MainCallToAction | Centré sous le formulaire |

---

## Pages non encore maquettées

- Programme / Agenda (grille horaire par salle)
- FAQ
- Équipe
- Lieu (carte, accès)
- Billetterie
- À propos / Historique (frise chronologique)
- CFP (Call for Papers)
- Galerie photos
- Hall of replays
- Passport digital des stands
- Page 404
- Espaces authentifiés (admin, speaker, sponsor)
- Versions mobile et tablette

---

## Notes de design

- Toutes les maquettes sont en version **desktop** (1440px) ; mobile et tablette ne sont pas maquettées
- Les illustrations utilisent des éléments locaux (La Grave, croix occitane) renforçant l'identité toulousaine
- Les routes utilisent le français (`/actualites`, `/conference`, `/code-de-conduite`) — l'adaptation bilingue (`/fr/...`, `/en/...`) sera gérée par le framework
- Les SVG dans `docs/maquettes/` constituent la référence visuelle durable, indépendante de l'accès Figma
