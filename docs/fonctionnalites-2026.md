# Fonctionnalités du site DevFest Toulouse 2026

Liste basée sur l'analyse des éditions 2016 à 2025, alignée sur les maquettes Figma.

---

## Header

- Logo DevFest Toulouse (lien vers l'accueil)
- Navigation principale : Programme, Speakers, Partenaires, Actus (liens simples ou dropdowns — à arbitrer)
- Réseaux sociaux : LinkedIn, YouTube, X/Twitter, Bluesky
- 2 CTAs : « Devenir partenaire » (secondaire, outline) et « Proposer un talk » (principal, lien Sessionize)

## Page d'accueil

- **Section hero** : image de fond avec coins arrondis, titre « DevFest Toulouse » (vert + terre cuite), sous-titre « La conférence Toulousaine par les devs et pour les devs. », date, lieu, 2 CTAs (« Devenir partenaire » + « Proposer un talk »)
- **Chiffres clés** : journée, participants, conférences, stands, tracks, durée — dans un encart blanc arrondi avec ombrage, titre « La plus grande conférence tech du bassin Toulousain », illustration La Grave
- **Partenaires** : titre « Ils soutiennent le #DevFestToulouse », CTA « Devenir Partenaire », grille de sponsors par niveau avec cartes colorées (Platinum en grand avec baseline, autres niveaux en cartes plus petites), illustration croix occitane
- **À propos** : section « Derrière le #DevFestToulouse », image de fond avec overlay, bloc texte sur fond blanc semi-transparent présentant le GDG Toulouse, puis section « Plongez dans notre écosystèmes » avec CTAs ToulouseTech et CloudToulouse
- **Speakers en vedette** : grille de 4-8 speakers mis en avant
- **Dernières actualités** : titre, lien « Lire plus d'articles », grille de 4 ArticleCards
- **Replay vidéo / aftermovie** de l'édition précédente
- Statuts annuels de la page d'accueil, basculables depuis le backend admin :
  - "Édition en préparation" : page minimale, teasing
  - "Annonce de la nouvelle édition" : affichage progressif des informations au fur et à mesure de leur disponibilité (date, lieu, CFP, speakers, programme, billetterie…)
  - "Rendez-vous l'année prochaine" : bilan de l'édition passée, replay, photos

## Programme / Schedule
- Grille horaire par salle/track
- Sessions cliquables avec détail (titre, description, speaker, tags, durée, langue, niveau)
- Formats : keynotes, conférences (40min), quickies (15min)
- Catégories colorées
- Filtrage : par niveau, format, langue, catégorie, recherche texte
- Export agenda (ICAL, PDF)

## Speakers
- Liste complète avec photo, nom, entreprise
- Page de détail : bio, réseaux sociaux, sessions associées
- Autonomie des speakers : édition de leur propre fiche via un espace dédié
- API de gestion des conférences

## Partenaires / Sponsors
- Cartes par niveau de sponsoring avec code couleur :
  - **Platinum** : grande carte (logo, nom, baseline/accroche), bandeau vert (#41B38E)
  - **Gold** : carte moyenne (logo, nom), bandeau jaune (#FFD428)
  - **Autres niveaux** : carte moyenne (logo, nom), bandeau rose (#EE7CAD)
- Page de détail par sponsor : logo, description longue, liens sociaux
- CTA "Devenir partenaire"
- Autonomie des sponsors : édition de leur propre fiche via un espace dédié
- API de gestion des sponsors

## Blog / Actualités
- Liste en grille de cards (thumbnail, titre, auteur, date, lien « Lire »)
- Page de détail par article : contenu riche avec paragraphes et sous-titres
- Breadcrumb sur chaque page

## Lieu
- Nom et description du lieu
- Adresse et lien itinéraire (Google Maps)
- Carte intégrée ou lien vers la carte

## Billetterie
- Paliers de prix (Blind Bird, Early Bird, Normal) avec états sold-out
- Lien vers la plateforme externe

## Équipe
- Grille des organisateurs avec photo, nom, rôle, réseaux sociaux

## FAQ
- Questions/réponses : accès au lieu, formats des talks, billetterie, remboursement

## À propos / Historique
- Présentation du GDG Toulouse
- Frise chronologique des éditions passées
- Liens vers les sites archivés

## Galerie photos
- Lien vers album Google Photos (officiel + collaboratif)

## CFP (Call for Papers)
- Lien vers Sessionize pour soumettre un sujet (CTA dans le header)
- Dates d'ouverture/fermeture du CFP

## Contact
- Formulaire : prénom, nom, email, téléphone, objet (dropdown), message
- Encart latéral : délais de réponse (bénévoles), réseaux sociaux

## Code de conduite
- Contenu textuel avec paragraphes et sous-titres
- Version française et version anglaise

## Mentions légales / RGPD
- Contenu textuel avec paragraphes et sous-titres
- Informations association, hébergeur
- Politique de données personnelles

## Footer
- Logo DevFest Toulouse
- Réseaux sociaux (LinkedIn, YouTube, X/Twitter, Bluesky)
- 3 colonnes de liens :
  - **Navigation** : Programme, Speakers, Partenaires, Actus
  - **Nos écosystèmes tech** : ToulouseTechHub, CloudToulouse
  - **Éditions précédentes** : DevFest Toulouse 2025, 2024, 2023
- CTA « Contactez nous »
- Barre basse : mention « Sans bug depuis 2016 - DevFest Toulouse by GDG Toulouse », liens Mentions légales, Code de conduite, Plan du site

## Page 404
- Message d'erreur personnalisé + lien retour accueil

## Accessibilité
- Skip to content
- Navigation clavier
- Contrastes suffisants
- Breadcrumb sur toutes les pages intérieures

## SEO / Meta tags
- Open Graph (Facebook/LinkedIn)
- Twitter Card
- Schema.org (Event, Organization)
- Balises title/description par page

## Gestion des utilisateurs
- Authentification et rôles (admin, sponsor, speaker)
- Espace dédié pour les sponsors et speakers

## Publications réseaux sociaux
- Génération de visuels/publications pour les sponsors, speakers et conférences
- Faciliter le partage sur les réseaux sociaux

## Hall of replays
- Historique de toutes les conférences du DevFest (toutes éditions)
- Liens vers les vidéos YouTube associées

## Passport digital des stands
- QR code par stand sponsor
- Scan par le participant : le tampon s'ajoute automatiquement
- Barre de progression montrant les stands restants à visiter

## Internationalisation
- Site nativement bilingue français / anglais
- Français comme langue par défaut
- Sélecteur de langue accessible depuis toutes les pages
- Tous les contenus (pages, articles, sessions, fiches speakers/sponsors) disponibles dans les deux langues
- URLs localisées (ex. `/fr/speakers/...`, `/en/speakers/...`)
- Attribut `lang` correct sur `<html>` et sur les blocs de contenu en langue différente

## Responsive
- Mobile-first, breakpoints tablette/desktop
