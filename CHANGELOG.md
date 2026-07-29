# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet suit le [versionnement sémantique](https://semver.org/lang/fr/).

Chaque version correspond à une **mise en production** (tag `vX.Y.Z` + release
GitHub). Voir [`docs/mise-en-production.md`](docs/mise-en-production.md).

## [Non publié]

_Changements mergés sur `dev` (beta), pas encore en production._

## [1.6.0] - 2026-07-29

Le fonds historique du DevFest devient consultable : **dix éditions de conférences
et d'intervenants** accessibles depuis le site, avec les vidéos quand elles
existent. Pour y arriver, un speaker cesse d'être une ligne par édition pour
devenir une **personne** suivie d'année en année.

### Modifié

- **Un speaker est une personne, plus une ligne par édition** : `Speaker` porte
  désormais l'identité, et `SpeakerEdition` la participation à une année, avec son
  statut de publication et sa mise en avant. Une personne présente sur plusieurs
  éditions n'existe plus qu'une fois (#351).
- **Une personne, une URL** : la fiche speaker vit sur `/speakers/<slug>` quelle
  que soit l'édition, et liste ses conférences par année décroissante. L'ancienne
  URL `/editions/<année>/speakers/<slug>` est supprimée (#352).
- **Le sponsor employeur est rattaché à l'année**, plus à la personne : quelqu'un
  ayant changé d'entreprise entre deux éditions affiche le bon employeur sur
  chacune (#353).
- **Les catégories sont partagées entre éditions** : une même thématique traverse
  les années au lieu d'être recréée à chaque fois (#338).
- **Fiche conférence** : le lecteur vidéo est intégré à la page, à la place du
  bouton « Revoir » qui envoyait ailleurs (#348).
- **Sponsors** : le nom n'est plus répété sous le logo ; il ne s'affiche qu'en
  l'absence de logo (#355).
- **Fiche speaker** : chaque session indique son niveau, sa langue et sa
  catégorie ; le lien de retour nomme l'année vers laquelle il mène (#357, #359).

### Ajouté

- **Hall of fame** (`/hall-of-fame`) : toutes les personnes ayant parlé au DevFest
  Toulouse, toutes éditions confondues, filtrables par année (#352).
- **Hall of replays** (`/replays`) : toutes les conférences filmées, toutes
  éditions, avec filtres et cartes entièrement cliquables (#102, #344, #350).
- **Fiches des éditions passées** : conférences et intervenants des années
  précédentes sont navigables, replays compris (#343).
- **Import de l'historique** : les photos des intervenants sont rapatriées sur le
  site au lieu de pointer vers des URL tierces, et le cache est purgé
  automatiquement en fin d'import (#356, #358).
- **Purge du cache par fiche** : modifier un sponsor ou une conférence met sa page
  publique à jour immédiatement (#360).
- **Admin** : bouton de purge manuelle de la corbeille, sans dépendre d'une tâche
  planifiée (#335).
- **CI** : audit Lighthouse avec seuils de performance sur les pages clés (#238),
  et redescente automatique du numéro de version vers `dev` après le tag (#288).

### Corrigé

- **2017 — les sessions n'étaient rattachées à aucun intervenant** : 44 références
  numériques ont été résolues, et l'import signale désormais toute référence qu'il
  ne sait pas résoudre au lieu de l'ignorer en silence (#361).
- **Une panne du backend devenait une 404 mise en cache** : l'erreur est
  désormais distinguée d'une ressource absente (#345).
- **Admin** : le sélecteur d'images proposait le SVG alors que le backend le
  refusait (#341).
- **Upload de logo sponsor** : les consignes (HD, sans marge, fond transparent)
  sont indiquées à l'endroit où le logo est demandé (#340).

### Sécurité

- **SVG autorisé sans risque** : assainissement des fichiers envoyés et
  durcissement du service de `/uploads/` (#346).

## [1.5.0] - 2026-07-23

Le sponsoring devient un **catalogue d'offres** que l'organisation édite elle-même,
au lieu de quatre niveaux figés dans le code. La suppression n'est plus définitive :
tout passe d'abord par une **corbeille**. S'y ajoutent la page « Lieu & infos
pratiques », un durcissement issu de l'audit de sécurité, et les premiers tests
automatisés du frontend.

### Ajouté

- **Sponsoring — catalogue d'offres éditable** : une offre (nom, sous-titre,
  description, avantages, taille de stand, couleur, échelle de logo, quota
  d'offres d'emploi) se crée et se modifie depuis l'admin. Chaque édition choisit
  les offres qu'elle propose, avec son propre prix et son ordre d'affichage
  (#316, #317, #318, #319, #320).
- **Mur de sponsors repensé** : en-têtes de niveau centrés aux couleurs de l'offre
  et **logos de taille dégressive** selon le rang — le tout piloté par le
  catalogue, sans valeur codée en dur (#321, #323, absorbe #315).
- **Corbeille avant suppression** : les éléments supprimés (12 entités) sont
  conservés puis effaçables définitivement. Consultation, restauration et
  suppression immédiate depuis l'admin ; purge automatique après 30 jours via une
  tâche planifiée externe (#145, #146, #147, #148, #149, #150).
- **Page « Lieu & infos pratiques »** : carte, accès, transports et informations
  pratiques de l'édition, alimentée depuis l'admin (#109).
- **Boutons Supprimer** dans les listes admin des speakers, conférences et
  sponsors, jusque-là absents (#300).
- **Tests frontend** : outillage Vitest + Testing Library et premiers tests de
  composants, plus la couverture des routes publiques et de CRUD admin
  jusqu'alors non testées (#308, partiel).

### Corrigé

- **Sécurité — 3 CVE** sur des dépendances directes (#304).
- **Sécurité — SSRF à l'import Sessionize** et XSS possible via l'upload de SVG,
  désormais refusé (#306).
- **Traduction** : les endpoints renvoyaient des statuts HTTP incohérents (#305).
- **Accueil** : le paragraphe de présentation du GDG manquait un saut de
  ligne avant « Depuis 2016 » (#322).

### Modifié

- **Sponsoring — modèle de données** : l'énumération `SponsorLevel` et le modèle
  `SponsorPlan` fusionnent dans un catalogue `SponsorTier` relié aux éditions.
  Les sponsors existants sont **remappés automatiquement** par la migration.
  L'API publique expose désormais `tier` (et non plus `level`) — frontend et
  backend doivent être déployés ensemble (#317, #321).
- **Dette technique** : suppression du composant `Toast` mort et des duplications
  de références de fichiers et de mapping sponsor (#307).

## [1.4.0] - 2026-07-20

Épique « communication sponsors » : contacts multiples, informations privées,
offres d'emploi et description en WYSIWYG. Côté speakers, l'édition d'une
conférence devient un droit accordé au cas par cas. Les emails passent à la
charte graphique.

### Ajouté

- **Sponsors — contacts secondaires** : plusieurs personnes par sponsor, chacune
  avec son propre lien de modification, son verrou et sa date d'envoi (#250).
- **Sponsors — informations privées** réservées à l'organisation : kit de
  communication (logos web/print, charte, notes) et suivi de réception (#249).
- **Sponsors Platinum** : contenu promotionnel et idées de co-construction (#252).
- **Sponsors — offres d'emploi** à relayer, avec une page publique dédiée
  « Offres d'emploi partenaires » (#251), description bilingue en WYSIWYG (#273).
- **Sponsors — description de la fiche entreprise en WYSIWYG**, comme les
  articles (#270), et ajout de Bluesky aux réseaux de la fiche publique (#253).
- **Speakers — édition de leur conférence** depuis le lien de modification,
  **en lecture seule par défaut** : l'organisation ouvre le droit conférence par
  conférence, et uniquement sur le titre et le résumé (#260, #289).
- **Emails à la charte graphique** : gabarit HTML commun à tous les envois (#269).
- **Icônes des chiffres clés** sélectionnables dans l'admin (#164).
- **Identification du build déployé** : `/api/health` expose le commit court, et
  l'admin l'affiche en badge cliquable vers GitHub (#290).

### Corrigé

- **Articles** : création impossible sans titre EN, et l'erreur réelle n'était
  pas affichée (#262) ; la sauvegarde en brouillon devient permissive, la
  validation stricte s'applique à la publication (#263).
- **Sponsors — « compléments par email »** : ouvre le client mail (`mailto`) au
  lieu d'un formulaire d'envoi (#271).
- **Menu Sponsors** : entrée dupliquée, et « Offres d'emploi » affichée même en
  l'absence d'offre (#276).
- **CI backend instable** : une édition de test datée 2099 captait les fixtures
  des autres tests (#292).

### Modifié

- **Conférences — une seule langue** pour le titre et la description : une
  conférence se donne dans une langue, déjà portée par son champ « langue ». Les
  quatre colonnes bilingues fusionnent en deux ; les URL publiques sont
  inchangées (#293).

## [1.3.0] - 2026-07-18

Grande promotion du Lot 2/3 en production : back-office complet (speakers,
sessions, sponsors, catégories), programme public riche, import Sessionize, et
une série d'améliorations UX/SEO/mobile.

### Ajouté

- **Programme public** : liste des conférences de l'édition en cours, avec
  recherche et filtres (format, niveau, catégorie, langue) dont l'état est
  partagé dans l'URL (#107, #207).
- **Filtres compacts** : niveau et langue repliés derrière « Plus de filtres »
  sur desktop (#246) ; sur mobile, toute la zone de filtres est repliée derrière
  un bouton « Filtres » avec badge du nombre de filtres actifs (#256).
- **Avatars des speakers** en bulles sur les cartes de conférences (#248).
- **Filtres des actualités** par édition et par tag (#179).
- **Fiche speaker** : le speaker consulte ses sessions retenues (lecture seule)
  depuis son lien de modification (#229).
- **Saisie bilingue FR/EN par onglets de langue** dans l'admin et sur la page de
  modification (#222).
- **Web app manifest + `theme-color`** (PWA de base : ajout à l'écran d'accueil,
  barre d'outils mobile aux couleurs de la marque) (#234).
- **Jetons d'API** : rotation d'un jeton en place (#227) et création avec date
  d'expiration (#228).
- **Import Sessionize** : rapatriement local des photos de speakers, et
  reconnaissance des formats/niveaux/langues (#205, #247).

### Corrigé

- **Import Sessionize** : la langue était mal mappée (fausses catégories
  « Français »/« English »), le niveau « Avancé » et le format « Workshop »
  n'étaient pas reconnus ; ajout de la valeur `WORKSHOP` et d'avertissements
  d'import (#247).
- **Contact** : ajout d'un `Reply-To` vers l'adresse du visiteur sur la
  notification, et mise en copie de l'organisation sur la confirmation de
  demande de plaquette (#230).
- **SEO** : `eventStatus` invalide corrigé sur la home (`previousStartDate`
  retiré, #239) et sur les pages bilan (`EventCompleted` → `EventScheduled`,
  #240).
- **Revalidation du cache** inopérante en production, faute de `FRONTEND_URL`
  scopé par environnement (#232).
- **Admin mobile** : bouton « Enregistrer » masqué sous la barre du navigateur
  (#257) ; listes « Données » impossibles à scroller au-delà de ~10 lignes
  (#244) ; scroll des onglets qui décalait la page (#233) ; colonnes FR/EN des
  avantages de plan sponsor qui débordaient (#243).
- **Fiche speaker/sponsor** : page de modification illisible sur PC + upload de
  logo manquant (#241).

### Modifié

- **CI** : exécution des tests backend activée (Postgres + seed) (#236).

## [1.1.3] - 2026-07-10

Correctif d'infrastructure : prépare des déploiements sans coupure.

### Ajouté

- Sonde de vitalité `GET /api/healthz` côté site : répond `200` sans rendre de
  page ni appeler l'API, pour que la santé du site ne dépende pas de celle de
  l'API (#192).
- Healthchecks Docker sur les conteneurs du site et de l'API. Sans eux, Coolify
  ne pouvait pas savoir quand le nouveau conteneur était prêt : il arrêtait
  l'ancien d'abord et le site public renvoyait **503 pendant une minute à chaque
  déploiement**.

### Note

Le healthcheck est un **prérequis** : il faut encore activer *Zero Downtime
Deployment* sur l'application Coolify pour supprimer réellement les 503.

## [1.1.2] - 2026-07-09

Correctif d'infrastructure : permet à la production et à la bêta de cohabiter sur
le réseau Docker partagé sans se marcher dessus.

### Corrigé

- Les variables lues par `next build` (`BACKEND_URL`, `BASE_URL`,
  `NEXT_PUBLIC_PLAUSIBLE_SRC`) sont désormais passées en **arguments de build**.
  Faute de quoi le `routes-manifest.json` figeait la valeur par défaut du
  `Dockerfile` (`http://backend:4000`) au lieu de l'alias propre à
  l'environnement, et les *rewrites* Next.js pointaient sur le nom nu `backend`
  (#189).
- Conséquence de ce défaut, apparue lorsque les deux backends ont rejoint le
  réseau partagé `coolify` : ils répondaient tous deux au nom `backend`, et la
  **production servait des requêtes depuis la base de données de la bêta**.

## [1.1.1] - 2026-07-09

Correctif d'infrastructure : rétablit l'envoi des emails, cassé en production
depuis un redéploiement.

### Corrigé

- Le backend n'était pas rattaché au réseau Docker partagé `coolify` : le service
  `postfix` ne résolvait plus et **tout envoi d'email échouait** (formulaire de
  contact, réinitialisation de mot de passe, liens de modification). Une clé
  `coolify:` nue sous le `networks:` d'un service se sérialise en `coolify: null`,
  et Compose ignore alors silencieusement le rattachement (#184).
- L'alias réseau propre à l'environnement est désormais posé sur le réseau partagé
  `coolify` — et non plus sur `default`, qui est privé au stack et n'y protégeait
  de rien — évitant la collision avec le backend des autres projets Coolify.

## [1.1.0] - 2026-07-07

Alignement de la production sur la beta : promotion du travail accumulé sur `dev`
et des correctifs récents.

### Ajouté

- Billetterie : synchronisation du statut « épuisé » depuis Billetweb + possibilité
  de forcer manuellement le statut d'un tarif dans l'admin (#161).
- Admin : badge de version + environnement (`vX.Y.Z · env`) dans la sidebar (#171).
- Procédure de mise en production versionnée : `CHANGELOG`, tags/releases, skill
  `deploy-to-prod`, garde-fous (rollback, backup, smoke tests) (#171, #176).

### Corrigé

- Actualités : pagination par 12 pour remplir la grille 4 colonnes (#165).
- Admin : possibilité de vider les champs optionnels d'une édition (#166).
- Éditeur : préfixe `https://` sur les liens sans schéma pour éviter les liens
  relatifs cassés (#167).
- SEO : la beta reste hors Google mais redevient partageable sur les réseaux
  sociaux (aperçu Open Graph) (#169).

### Modifié

- Documentation de mise en production enrichie (versioning, rollback, backup,
  fenêtre de déploiement, smoke tests, migration de données opt-in).

## [1.0.0] - 2026-07-06

Première mise en production du site DevFest Toulouse 2026, en remplacement de
l'ancien site WordPress.

### Ajouté

- Site public bilingue (FR/EN) : accueil, actualités, billetterie, sponsors,
  éditions passées, contact, pages de contenu.
- Back-office admin complet : éditions, articles, pages, billetterie, messages
  de contact, utilisateurs, clés API, paramètres.
- SSR + cache HTTP, SEO (Schema.org, Open Graph), accessibilité (WCAG 2.1 AA).
- Authentification admin (better-auth : email/password + Google + GitHub).

[Non publié]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.3...dev
[1.1.3]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GDGToulouse/Site-Devfest-Toulouse-2026/releases/tag/v1.0.0
