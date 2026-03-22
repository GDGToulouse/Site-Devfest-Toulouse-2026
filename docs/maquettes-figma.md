# Maquettes Figma — Site DevFest Toulouse 2026

Maquettes de référence pour le design du site, réalisées sur Figma.

---

## Accès au fichier Figma

- **Fichier** : DevFestToulouse-2025
- **Page** : Site web
- **URL** : https://www.figma.com/design/5dw9ggMfrdFrB9qEKYvHH6/DevFestToulouse-2025?node-id=22-499

---

## Pages maquettées

Le fichier Figma contient les maquettes desktop (1440px) des pages suivantes :

### Pages publiques principales

| Page | Route | Description |
|------|-------|-------------|
| Accueil | `/home` | Hero (titre, date, lieu, CTAs), chiffres clés, section sponsors, à propos / écosystème, dernières actualités, footer |
| Conférences | `/conferences` | Liste des sessions avec grille |
| Détail conférence | `/conference/:slug` | Page de détail d'une session |
| Speakers | `/speakers` | Liste des conférenciers |
| Détail speaker | `/speaker/:slug` | Fiche détaillée d'un speaker |
| Partenaires | `/partners` | Liste des partenaires |
| Détail partenaire | `/partner/:slug` | Fiche sponsor : logo, description, liens sociaux |
| Actualités | `/actualites` | Grille d'articles (cards) |
| Détail article | `/actualite/:slug` | Article complet avec contenu riche |

### Pages de contenu

| Page | Route | Description |
|------|-------|-------------|
| Contact | `/contact` | Formulaire (nom, prénom, email, téléphone, objet, message) + infos pratiques (délais, adresse, réseaux sociaux) |
| Code de conduite | `/code-de-conduite` | Contenu textuel avec paragraphes et sous-titres |
| Mentions légales | `/mentions-legales` | Contenu textuel avec paragraphes et sous-titres |

---

## Composants partagés

Les maquettes utilisent des composants réutilisables (instances Figma) :

| Composant | Présent sur | Description |
|-----------|-------------|-------------|
| Header | Toutes les pages | Barre de navigation principale |
| Footer | Toutes les pages | Pied de page avec liens et réseaux sociaux |
| Breadcrumb | Toutes les pages sauf accueil | Fil d'Ariane contextuel |
| ArticleCard | Accueil, Actualités | Carte d'article (image, titre, extrait) |
| PartnerCard | Accueil, Partenaires | Carte sponsor avec logo |
| MainCallToAction | Accueil, Contact, Partenaires | Bouton d'action principal |
| Socials | Partenaire détail, Contact | Liens vers les réseaux sociaux |

---

## Structure de la page d'accueil

La page d'accueil est la plus riche et se compose de :

1. **Header** — navigation principale
2. **HeroSection** — image, titre « DevFest Toulouse », description, date, lieu, 2 CTAs (principal + secondaire)
3. **StatisticsWrapper** — chiffres clés (journée, participants, conférences, stands) avec illustration locale (La Grave)
4. **PartnersSection** — titre, CTA « Devenir partenaire », grille de sponsors Platinum (grands) + grilles par niveau (plus petits), illustration croix occitane
5. **AboutUs** — section « Derrière le #DevFestToulouse », image, description, liens écosystème (Toulouse Tech Hub, Cloud Toulouse)
6. **Articles** — « Dernières actualités », grille de 4 ArticleCards, lien « Voir plus »
7. **Footer** — pied de page

---

## Pages non encore maquettées

Les pages suivantes sont prévues dans les fonctionnalités mais ne figurent pas encore dans le Figma :

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

---

## Notes de design

- Les maquettes sont en version **desktop** (1440px de large) ; les versions mobile et tablette ne sont pas encore maquettées
- Les illustrations utilisent des éléments locaux (La Grave, croix occitane) renforçant l'identité toulousaine
- Les routes utilisent le français (`/actualites`, `/conference`, `/code-de-conduite`) — l'adaptation bilingue des URLs (`/fr/...`, `/en/...`) sera gérée par le framework
