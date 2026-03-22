# Lot 2 — Speakers, Sessions & Sponsors

**Échéance** : 19 juin 2026
**Objectif** : les speakers sélectionnés et les sponsors sont publiés simultanément.

**Prérequis** : Lot 1 livré et en production.

---

## Table des matières

1. [Règles de gestion](#règles-de-gestion)
2. [User stories — Speakers](#user-stories--speakers)
3. [User stories — Sponsors](#user-stories--sponsors)
4. [User stories — Page d'accueil (compléments)](#user-stories--page-daccueil-compléments)
5. [User stories — Authentification](#user-stories--authentification)
6. [User stories — Espaces connectés](#user-stories--espaces-connectés)
7. [User stories — Admin](#user-stories--admin)
8. [Parcours utilisateur](#parcours-utilisateur)
9. [Cas limites et erreurs](#cas-limites-et-erreurs)
10. [Questions ouvertes](#questions-ouvertes)

---

## Règles de gestion

### Speakers

| # | Règle |
|---|-------|
| RG-200 | Un speaker est associé à une ou plusieurs sessions d'une édition donnée. |
| RG-201 | Les informations obligatoires d'un speaker sont : nom, photo. Les informations facultatives sont : entreprise, ville, biographie (FR + EN), liens sociaux. |
| RG-202 | Un speaker peut être marqué « en vedette » pour apparaître sur la page d'accueil. |
| RG-203 | La biographie d'un speaker est bilingue (FR + EN). |
| RG-204 | Un speaker est associé à un sponsor si son entreprise est partenaire de l'édition (lien automatique via le nom d'entreprise, confirmable par l'admin). |
| RG-205 | La page de détail d'un speaker liste ses sessions de l'édition courante. |
| RG-206 | Le slug d'un speaker est dérivé de son nom complet (ex. « marie-dupont ») et est unique par édition. |
| RG-207 | La photo du speaker est redimensionnée et optimisée (WebP, taille max 400x400px). |
| RG-208 | L'image OG d'un speaker est générée dynamiquement : photo + nom + branding DevFest (1200x630px). |

### Sessions

| # | Règle |
|---|-------|
| RG-210 | Une session a obligatoirement : titre (FR + EN), description (FR + EN), au moins un speaker, un format, une catégorie, une langue. |
| RG-211 | Les formats possibles sont : Conférence (40 min), Quickie (15 min), Keynote. |
| RG-212 | Les niveaux possibles sont : Débutant, Intermédiaire, Confirmé. Si non renseigné, le niveau est considéré « Tous niveaux ». |
| RG-213 | Une session appartient à une catégorie parmi celles définies pour l'édition courante. |
| RG-214 | Le slug d'une session est dérivé du titre (ex. « kotlin-multiplatform-en-production »). |
| RG-215 | L'image OG d'une session est générée dynamiquement : titre + speaker(s) + catégorie + branding DevFest. |
| RG-216 | Les champs salle et créneau horaire ne sont pas obligatoires dans le Lot 2 (assignés dans le Lot 3 — Programme). |

### Sponsors

| # | Règle |
|---|-------|
| RG-220 | Un sponsor est associé à une édition avec un niveau de sponsoring. |
| RG-221 | Les niveaux de sponsoring sont ordonnés par importance décroissante : Platinum, Gold, Silver, Soutien, Communauté. |
| RG-222 | Les informations obligatoires d'un sponsor sont : nom, logo, niveau de sponsoring. Les informations facultatives sont : site web, description (FR + EN), liens sociaux. |
| RG-223 | L'affichage des sponsors sur la page liste et sur la page d'accueil respecte la hiérarchie des niveaux : Platinum d'abord (grandes cartes), puis Gold (cartes moyennes), puis les autres (cartes moyennes). |
| RG-224 | Les cartes sponsors ont un bandeau coloré selon le niveau : Platinum → Émeraude (#41B38E), Gold → Jaune (#FFD428), Silver/autres → Rose (#EE7CAD). |
| RG-225 | La description d'un sponsor est bilingue (FR + EN). |
| RG-226 | La page de détail d'un sponsor affiche les speakers travaillant pour cette entreprise (lien via RG-204). |
| RG-227 | Le slug d'un sponsor est dérivé de son nom (ex. « ovhcloud »). |
| RG-228 | Le logo du sponsor est redimensionné et optimisé (format originel respecté, taille max adaptée au niveau : 267x200px pour Platinum, 200x150px pour les autres). |
| RG-229 | L'image OG d'un sponsor est son logo. |
| RG-230 | Chaque édition définit quels niveaux de sponsoring sont ouverts. Seuls ces niveaux sont proposés lors de la création d'un sponsor. |

### Authentification

| # | Règle |
|---|-------|
| RG-240 | Les rôles utilisateur sont : admin, speaker, sponsor. |
| RG-241 | L'authentification se fait par email + mot de passe ou via un fournisseur OAuth (Google). |
| RG-242 | Un utilisateur avec le rôle speaker est lié à exactement un speaker. |
| RG-243 | Un utilisateur avec le rôle sponsor est lié à exactement un sponsor. |
| RG-244 | Un speaker ou sponsor ne peut éditer que sa propre fiche. |
| RG-245 | Les sessions de tokens utilisent des JWT avec expiration courte (15 min) et refresh token (7 jours). |
| RG-246 | Les mots de passe sont hashés avec bcrypt (ou argon2). Jamais stockés en clair. |
| RG-247 | Après 5 tentatives de connexion échouées en 15 minutes, le compte est temporairement bloqué (30 minutes). |

---

## User stories — Speakers

### US-200 : Page liste des speakers

**En tant que** visiteur,
**je veux** voir la liste de tous les speakers du DevFest 2026,
**afin de** découvrir qui interviendra.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Speakers.
- [ ] Grille de speaker cards (4 colonnes desktop, 2 tablette, 1 mobile).
- [ ] Chaque card affiche : photo, nom, entreprise.
- [ ] Clic sur une card → page de détail du speaker.
- [ ] Les speakers sont triés par ordre alphabétique du nom.
- [ ] `<title>` : « Speakers — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

### US-201 : Page détail d'un speaker

**En tant que** visiteur,
**je veux** consulter la fiche détaillée d'un speaker,
**afin de** connaître son parcours et ses sessions.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Speakers > {Nom du speaker}.
- [ ] Photo du speaker.
- [ ] Nom, entreprise, ville.
- [ ] Biographie complète (dans la langue de la page).
- [ ] Liens sociaux (Twitter, GitHub, LinkedIn, Bluesky, site web) — icônes cliquables.
- [ ] Liste des sessions associées au speaker (titre, format, catégorie) — cliquables vers la page de détail session.
- [ ] `<title>` : « {Nom du speaker} — DevFest Toulouse 2026 ».
- [ ] Image OG générée dynamiquement (RG-208).
- [ ] Données structurées Schema.org `Person` (name, image, jobTitle, worksFor, sameAs).

### US-202 : Section Speakers en vedette (page d'accueil)

**En tant que** visiteur,
**je veux** voir des speakers en vedette sur la page d'accueil,
**afin de** découvrir les intervenants phares.

**Critères d'acceptation :**
- [ ] Section affichée entre la section Sponsors et la section Actualités (ou à l'emplacement défini par le design).
- [ ] Grille de 4 à 8 speakers marqués « en vedette » (RG-202).
- [ ] Chaque speaker affiche : photo, nom, entreprise.
- [ ] Clic → page de détail du speaker.
- [ ] Si aucun speaker n'est marqué en vedette, la section est masquée.
- [ ] Lien « Voir tous les speakers » menant vers la page Speakers.

---

## User stories — Sponsors

### US-210 : Page liste des sponsors

**En tant que** visiteur,
**je veux** voir tous les sponsors du DevFest 2026,
**afin de** connaître les entreprises qui soutiennent l'événement.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Partenaires.
- [ ] Sponsors affichés par niveau hiérarchique (RG-223) :
  - Platinum : grandes cartes (340x481px), bandeau Émeraude, logo (267x200px), nom (40px Bold), baseline en italique.
  - Gold : cartes moyennes (340x240px), bandeau Jaune, logo (200x150px), nom (32px Bold).
  - Silver/autres : cartes moyennes (340x240px), bandeau Rose, logo (200x150px), nom (32px Bold).
- [ ] Clic sur une carte → page de détail du sponsor.
- [ ] CTA « Devenir partenaire » visible (lien vers formulaire/page partenariat).
- [ ] `<title>` : « Partenaires — DevFest Toulouse 2026 ».
- [ ] La page est bilingue FR/EN.

### US-211 : Page détail d'un sponsor

**En tant que** visiteur,
**je veux** en savoir plus sur un sponsor,
**afin de** comprendre son activité et son lien avec la tech.

**Critères d'acceptation :**
- [ ] Breadcrumb : Accueil > Partenaires > {Nom du sponsor}.
- [ ] Layout deux colonnes (desktop) :
  - Gauche (616px) : description longue du sponsor (dans la langue de la page).
  - Droite (512px) : logo (512x300px) + liens sociaux.
- [ ] Liens sociaux : icônes cliquables (Twitter, LinkedIn, site web...).
- [ ] Section « Speakers de {Nom du sponsor} » listant les speakers associés (RG-226), cliquables.
- [ ] `<title>` : « {Nom du sponsor} — DevFest Toulouse 2026 ».
- [ ] Image OG : logo du sponsor (RG-229).
- [ ] Données structurées Schema.org `Organization` (name, logo, url, sameAs).

### US-212 : Section Partenaires (page d'accueil)

**En tant que** visiteur,
**je veux** voir les sponsors du DevFest sur la page d'accueil,
**afin de** connaître les entreprises partenaires.

**Critères d'acceptation :**
- [ ] Titre : « Ils soutiennent le #DevFestToulouse ».
- [ ] CTA « Devenir Partenaire ».
- [ ] Grille de cartes sponsors par niveau (Platinum en grand, puis Gold, puis autres) — même design que la page Partenaires.
- [ ] Illustration croix occitane en fond (coin haut droit).
- [ ] Clic sur une carte → page de détail du sponsor.
- [ ] Si aucun sponsor n'est publié, la section est masquée.

---

## User stories — Authentification

### US-220 : Connexion utilisateur

**En tant que** speaker ou sponsor,
**je veux** me connecter à mon espace personnel,
**afin de** gérer ma fiche.

**Critères d'acceptation :**
- [ ] Page de connexion avec email + mot de passe.
- [ ] Option « Se connecter avec Google » (OAuth).
- [ ] Après connexion réussie, redirection vers l'espace dédié au rôle (dashboard speaker ou sponsor).
- [ ] Après 5 tentatives échouées en 15 min, message « Compte temporairement bloqué. Réessayez dans 30 minutes » (RG-247).
- [ ] Lien « Mot de passe oublié » avec réinitialisation par email.

### US-221 : Déconnexion

**En tant que** utilisateur connecté,
**je veux** me déconnecter,
**afin de** sécuriser mon accès.

**Critères d'acceptation :**
- [ ] Bouton « Déconnexion » visible dans le header (quand connecté).
- [ ] Après déconnexion, redirection vers la page d'accueil.
- [ ] Le JWT et le refresh token sont invalidés.

---

## User stories — Espaces connectés

### US-230 : Speaker — édition de sa fiche

**En tant que** speaker connecté,
**je veux** modifier ma biographie, ma photo et mes liens sociaux,
**afin de** présenter un profil à jour sur le site.

**Critères d'acceptation :**
- [ ] Dashboard speaker avec vue sur sa fiche actuelle.
- [ ] Champs éditables : biographie (FR + EN), photo (upload avec recadrage), entreprise, ville, liens sociaux (ajout/suppression).
- [ ] Prévisualisation de la fiche telle qu'elle apparaîtra sur le site public.
- [ ] Bouton « Enregistrer » — les modifications sont immédiatement visibles (après purge du cache).
- [ ] Le speaker ne peut pas modifier ses sessions (géré par l'admin).
- [ ] Le speaker ne peut pas modifier son nom (géré par l'admin).
- [ ] La photo uploadée est validée : format (JPEG, PNG, WebP), taille max 5 Mo, dimensions min 200x200px.

### US-231 : Sponsor — édition de sa fiche

**En tant que** sponsor connecté,
**je veux** modifier la description et le logo de mon entreprise,
**afin de** contrôler mon image sur le site du DevFest.

**Critères d'acceptation :**
- [ ] Dashboard sponsor avec vue sur sa fiche actuelle.
- [ ] Champs éditables : description (FR + EN), logo (upload), site web, liens sociaux (ajout/suppression).
- [ ] Prévisualisation de la fiche.
- [ ] Bouton « Enregistrer » — modifications immédiates (après purge du cache).
- [ ] Le sponsor ne peut pas modifier son nom ni son niveau de sponsoring (géré par l'admin).
- [ ] Le logo uploadé est validé : format (JPEG, PNG, SVG, WebP), taille max 2 Mo.

---

## User stories — Admin

### US-240 : Gestion des speakers (CRUD)

**En tant qu'** admin,
**je veux** gérer les fiches speakers,
**afin de** publier la liste des intervenants.

**Critères d'acceptation :**
- [ ] Liste des speakers avec recherche et tri.
- [ ] Création d'un speaker : nom, photo, entreprise, ville, biographie (FR + EN), liens sociaux, flag « en vedette ».
- [ ] Modification de tous les champs d'un speaker.
- [ ] Suppression avec confirmation (et dissociation des sessions).
- [ ] Association d'un speaker à un compte utilisateur (pour l'accès connecté).
- [ ] Import depuis Sessionize (si applicable).
- [ ] Après création/modification/suppression, purge du cache des pages impactées.

### US-241 : Gestion des sessions (CRUD)

**En tant qu'** admin,
**je veux** gérer les sessions,
**afin de** publier le contenu des conférences.

**Critères d'acceptation :**
- [ ] Liste des sessions avec recherche, tri et filtres (format, catégorie, langue).
- [ ] Création d'une session : titre (FR + EN), description (FR + EN), speaker(s) (multi-select), format, catégorie, niveau, langue.
- [ ] Modification de tous les champs.
- [ ] Suppression avec confirmation.
- [ ] Import depuis Sessionize (si applicable).
- [ ] Les champs salle et créneau horaire sont disponibles mais non obligatoires (utilisés dans le Lot 3).
- [ ] Après modification, purge du cache des pages impactées.

### US-242 : Gestion des sponsors (CRUD)

**En tant qu'** admin,
**je veux** gérer les fiches sponsors,
**afin de** publier la liste des partenaires.

**Critères d'acceptation :**
- [ ] Liste des sponsors avec recherche et tri.
- [ ] Création : nom, logo, niveau de sponsoring (parmi les niveaux ouverts pour l'édition — RG-230), site web, description (FR + EN), liens sociaux.
- [ ] Modification de tous les champs (y compris le niveau de sponsoring).
- [ ] Suppression avec confirmation.
- [ ] Association d'un sponsor à un compte utilisateur (pour l'accès connecté).
- [ ] Après modification, purge du cache des pages impactées.

### US-243 : API de gestion des conférences

**En tant qu'** admin ou système externe,
**je veux** une API REST pour gérer les sessions et speakers,
**afin de** automatiser l'import depuis Sessionize.

**Critères d'acceptation :**
- [ ] Endpoints CRUD pour les speakers : `GET/POST /api/speakers`, `GET/PUT/DELETE /api/speakers/:id`.
- [ ] Endpoints CRUD pour les sessions : `GET/POST /api/sessions`, `GET/PUT/DELETE /api/sessions/:id`.
- [ ] Authentification requise (JWT, rôle admin).
- [ ] Validation des données en entrée.
- [ ] Réponses JSON avec codes HTTP standard (200, 201, 400, 401, 403, 404, 422).

### US-244 : API de gestion des sponsors

**En tant qu'** admin,
**je veux** une API REST pour gérer les sponsors,
**afin de** pouvoir automatiser ou intégrer.

**Critères d'acceptation :**
- [ ] Endpoints CRUD : `GET/POST /api/sponsors`, `GET/PUT/DELETE /api/sponsors/:id`.
- [ ] Authentification requise (JWT, rôle admin).
- [ ] Validation des données en entrée.
- [ ] Réponses JSON standard.

### US-245 : Gestion des niveaux de sponsoring par édition

**En tant qu'** admin,
**je veux** définir quels niveaux de sponsoring sont ouverts pour l'édition courante,
**afin de** ne proposer que les niveaux pertinents.

**Critères d'acceptation :**
- [ ] Interface admin pour sélectionner les niveaux ouverts parmi : Platinum, Gold, Silver, Soutien, Communauté.
- [ ] Les niveaux non sélectionnés ne sont pas proposés lors de la création d'un sponsor.

### US-246 : Gestion des catégories de sessions

**En tant qu'** admin,
**je veux** définir les catégories (tracks) de l'édition courante,
**afin de** classifier les sessions.

**Critères d'acceptation :**
- [ ] Interface admin pour créer, modifier, supprimer des catégories.
- [ ] Chaque catégorie a un nom (FR + EN) et une couleur associée.
- [ ] Les catégories sont associées à l'édition courante.

---

## User stories — Souhaitable (Lot 2)

### US-250 : Génération de visuels speakers pour les réseaux sociaux

**En tant qu'** admin,
**je veux** générer des visuels de promotion pour chaque speaker,
**afin de** faciliter la communication sur les réseaux sociaux.

**Critères d'acceptation :**
- [ ] Bouton « Générer le visuel » sur la fiche admin d'un speaker.
- [ ] Le visuel inclut : photo du speaker, nom, titre de la session, branding DevFest.
- [ ] Export en PNG 1200x630px (format OG / réseaux sociaux).
- [ ] Possibilité de générer en lot (tous les speakers d'un coup).

---

## Parcours utilisateur

### Parcours 1 : Découverte des speakers

1. Le visiteur arrive sur la page d'accueil.
2. Il voit la section « Speakers en vedette » avec 4-8 speakers.
3. Il clique sur un speaker → page de détail.
4. Il lit la biographie et voit les sessions associées.
5. Il clique sur une session → page de détail session (titre, description, mais pas encore de salle/créneau — Lot 3).
6. Il clique sur « Speakers » dans le breadcrumb → liste complète.
7. Il parcourt la grille et clique sur un autre speaker.

### Parcours 2 : Découverte des sponsors

1. Le visiteur scrolle la page d'accueil et voit la section Partenaires.
2. Il clique sur une carte sponsor Platinum → page de détail.
3. Il lit la description, voit le logo et les liens sociaux.
4. Il voit la section « Speakers de {Sponsor} » — deux speakers travaillent pour ce sponsor.
5. Il clique sur un speaker → page de détail speaker.
6. Il revient aux partenaires via le breadcrumb.

### Parcours 3 : Speaker édite sa fiche

1. Le speaker reçoit un email avec un lien de création de compte.
2. Il crée son compte (email + mot de passe).
3. Il se connecte → redirigé vers son dashboard speaker.
4. Il voit sa fiche actuelle (photo, bio, liens sociaux).
5. Il clique sur « Modifier ».
6. Il met à jour sa biographie en français et en anglais.
7. Il ajoute un lien Bluesky.
8. Il uploade une nouvelle photo (le système la recadre/optimise).
9. Il clique sur « Enregistrer ».
10. Il voit la prévisualisation mise à jour.
11. La fiche publique est mise à jour après purge du cache.

### Parcours 4 : Sponsor édite sa fiche

1. Le sponsor reçoit ses identifiants par email.
2. Il se connecte → dashboard sponsor.
3. Il met à jour la description de son entreprise (FR + EN).
4. Il uploade un nouveau logo.
5. Il enregistre → la fiche publique est mise à jour.

### Parcours 5 : Admin publie les speakers

1. L'admin accède à la section « Speakers » du back-office.
2. Il clique sur « Importer depuis Sessionize » (si disponible) ou crée manuellement.
3. Il crée un speaker : nom, photo, entreprise, bio FR + EN.
4. Il l'associe à une session existante.
5. Il marque certains speakers « en vedette ».
6. Il publie → les pages publiques sont mises à jour.
7. Il crée un compte utilisateur pour le speaker et l'associe.

---

## Cas limites et erreurs

### Speakers

| Cas | Comportement attendu |
|-----|---------------------|
| Speaker sans photo | Un placeholder est affiché (silhouette avec les couleurs DevFest). Le visuel OG utilise le placeholder. |
| Speaker sans session | Le speaker apparaît dans la liste mais sans section « Sessions » sur sa page de détail. |
| Speaker avec plusieurs sessions | Toutes les sessions sont listées sur la page de détail. |
| Deux speakers avec le même nom | Le slug est dédupliqué (ex. « jean-martin-2 »). |
| Speaker supprimé alors qu'il a des sessions | L'admin doit d'abord dissocier les sessions (ou confirmation avec dissociation automatique). |
| Speaker avec biographie dans une seule langue | La version manquante affiche la version disponible (fallback vers l'autre langue). |

### Sponsors

| Cas | Comportement attendu |
|-----|---------------------|
| Sponsor sans description | La page de détail affiche uniquement le logo et les liens sociaux (pas de colonne gauche). |
| Sponsor sans logo | Un placeholder est affiché (carré avec le nom en texte). |
| Aucun speaker associé au sponsor | La section « Speakers de {Sponsor} » est masquée. |
| Tous les sponsors d'un niveau supprimés | Le groupe de ce niveau disparaît de la page Partenaires. |
| Aucun sponsor publié | La section Partenaires de la page d'accueil est masquée. La page Partenaires affiche un message. |

### Authentification

| Cas | Comportement attendu |
|-----|---------------------|
| Email ou mot de passe incorrect | Message générique « Identifiants incorrects » (ne pas préciser lequel est faux). |
| Compte bloqué (5 tentatives) | Message « Compte temporairement bloqué. Réessayez dans 30 minutes ». |
| Token JWT expiré | Tentative de refresh automatique avec le refresh token. Si échec, redirection vers la page de connexion. |
| Speaker tente d'accéder au dashboard admin | Erreur 403, redirection vers son propre dashboard. |
| Utilisateur connecté accède à une page de connexion | Redirection vers son dashboard. |

### Upload d'images

| Cas | Comportement attendu |
|-----|---------------------|
| Image trop lourde (> 5 Mo speaker, > 2 Mo logo) | Message d'erreur « Le fichier est trop volumineux. Taille maximale : X Mo ». |
| Format non supporté | Message d'erreur « Format non supporté. Formats acceptés : JPEG, PNG, WebP ». |
| Image trop petite (< 200x200px pour speaker) | Message d'erreur « L'image doit faire au moins 200x200 pixels ». |

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| QO-020 | Comment se fait l'import depuis Sessionize ? API Sessionize, export JSON/CSV manuel, ou les deux ? | Workflow admin, effort dev |
| QO-021 | Le lien speaker-sponsor (via l'entreprise) est-il automatique (matching par nom d'entreprise) ou manuel (sélection par l'admin) ? | Complexité, fiabilité |
| QO-022 | Les speakers/sponsors reçoivent-ils un email d'invitation automatique pour créer leur compte, ou l'admin leur fournit-il des identifiants ? | Workflow, email transactionnel |
| QO-023 | La génération d'images OG dynamiques se fait-elle à la volée (au premier accès) ou en batch (lors de la publication) ? | Performance, coût |
| QO-024 | Le CTA « Devenir partenaire » mène-t-il vers un Google Form (comme sur le site 2023-2025), vers la page Contact avec l'objet pré-sélectionné, ou vers une page dédiée ? | UX, scope |
| QO-025 | Quel fournisseur OAuth utiliser ? Google uniquement, ou aussi GitHub/LinkedIn ? | Scope authentification |
| QO-026 | Les cartes Platinum doivent-elles afficher une « baseline » (accroche du sponsor). Si oui, ce champ est-il obligatoire pour les Platinum ? | Modèle de données, design |
| QO-027 | Les sessions créées dans le Lot 2 sont-elles visibles publiquement dès leur création, ou y a-t-il un état « brouillon » ? | Workflow publication |
