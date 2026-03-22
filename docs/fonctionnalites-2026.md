# Fonctionnalités du site DevFest Toulouse 2026

Liste brute basée sur l'analyse des éditions 2016 à 2025.

---

## Page d'accueil
- Section hero (bannière plein écran en haut de page) : image ou vidéo de fond, logo DevFest Toulouse, date et lieu de l'événement, bouton d'action principal
- Chiffres clés : participants, sessions, tracks, durée
- Présentation : qu'est-ce que le DevFest Toulouse
- CTA principal : billetterie ou inscription
- Speakers en vedette : grille de 4-8 speakers mis en avant
- Partenaires : logos par niveau de sponsoring
- Dernières actualités : 2-3 articles récents
- Replay vidéo / aftermovie de l'édition précédente
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
- Page ou modale de détail : bio, réseaux sociaux, sessions associées
- Autonomie des speakers : édition de leur propre fiche via un espace dédié
- API de gestion des conférences

## Partenaires / Sponsors
- Logos organisés par niveaux (Platinum, Gold, Silver, Soutien, Communautés)
- Lien vers le site de chaque partenaire
- CTA "Devenir partenaire"
- Fiche détaillée par sponsor
- Autonomie des sponsors : édition de leur propre fiche via un espace dédié
- API de gestion des sponsors

## Blog / Actualités
- Articles avec image, titre, extrait
- Page de détail par article

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
- Lien vers Sessionize pour soumettre un sujet
- Dates d'ouverture/fermeture du CFP

## Contact
- Formulaire : nom, email, objet (dropdown), message

## Code de conduite
- Version française
- Version anglaise

## Mentions légales / RGPD
- Informations association, hébergeur
- Politique de données personnelles

## Footer
- Réseaux sociaux (X/Twitter, Bluesky, LinkedIn, YouTube)
- Contact (email)
- Mentions légales
- Liens vers les éditions précédentes

## Page 404
- Message d'erreur personnalisé + lien retour accueil

## Accessibilité
- Skip to content
- Navigation clavier
- Contrastes suffisants

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
