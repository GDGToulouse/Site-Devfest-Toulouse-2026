# Lot 5 — Jour J

**Échéance** : 19 novembre 2026 (jour du DevFest)
**Objectif** : les fonctionnalités liées à l'événement en direct sont prêtes.

**Prérequis** : Lots 1-4 livrés et en production.

---

## Table des matières

1. [Règles de gestion](#règles-de-gestion)
2. [User stories — Passport digital des stands](#user-stories--passport-digital-des-stands)
3. [User stories — Authentification participant](#user-stories--authentification-participant)
4. [User stories — Admin](#user-stories--admin)
5. [User stories — Souhaitables](#user-stories--souhaitables)
6. [Parcours utilisateur](#parcours-utilisateur)
7. [Cas limites et erreurs](#cas-limites-et-erreurs)
8. [User stories — Édition en préparation (page d'accueil)](#user-stories--édition-en-préparation-page-daccueil)
9. [Questions ouvertes](#questions-ouvertes)

---

## Règles de gestion

### Passport digital des stands

| # | Règle |
|---|-------|
| RG-500 | Le passport digital est un parcours ludique incitant les participants à visiter les stands des sponsors. |
| RG-501 | Chaque sponsor participant dispose d'un QR code unique affiché sur son stand physique. |
| RG-502 | Le participant scanne le QR code via un scanner intégré au site (utilisation de l'API caméra web). |
| RG-503 | Le scan ajoute automatiquement un « tampon » sur le passport digital du participant. |
| RG-504 | Le passport affiche une barre de progression : nombre de stands visités / nombre total de stands participants. |
| RG-505 | Le passport digital nécessite une authentification (le participant doit être connecté pour que ses tampons soient sauvegardés). |
| RG-506 | Chaque QR code ne peut être validé qu'une seule fois par participant (scan multiple = pas de doublon). |
| RG-507 | Le QR code encode une URL unique du type `https://devfesttoulouse.fr/passport/scan/{token}` où `{token}` est un identifiant unique par sponsor. |
| RG-508 | Le scan est validé côté serveur pour éviter les fraudes (vérification du token, vérification que le participant est authentifié, vérification du non-doublon). |
| RG-509 | Les sponsors participants au passport digital sont un sous-ensemble des sponsors de l'édition (sélectionnés par l'admin). |
| RG-510 | Le passport digital n'est actif que le jour de l'événement (ou une période définie par l'admin). |

### Authentification participant

| # | Règle |
|---|-------|
| RG-520 | Le rôle « participant » est ajouté au système d'authentification (en plus de admin, speaker, sponsor). |
| RG-521 | Un participant s'inscrit avec son email + mot de passe ou via OAuth (Google). |
| RG-522 | L'inscription participant est ouverte à tous, sans vérification de billet. |
| RG-523 | Le participant connecté a accès à son passport digital. |
| RG-524 | Le participant ne peut pas accéder aux dashboards admin, speaker ou sponsor. |

### Bascule de statut post-événement

| # | Règle |
|---|-------|
| RG-530 | Après l'événement, l'admin bascule le statut annuel de « Annonce de l'édition » vers « Rendez-vous l'année prochaine ». |
| RG-531 | En mode « Rendez-vous l'année prochaine », la page d'accueil affiche : bilan (chiffres clés de l'édition), aftermovie, galerie photos, replays, lien vers les éditions précédentes. |
| RG-532 | La section billetterie est masquée en mode « Rendez-vous l'année prochaine ». |
| RG-533 | Le CTA « Proposer un talk » est remplacé par un CTA « Revoir les talks » (lien vers le Hall of replays). |
| RG-534 | Le passport digital est désactivé après la fin de l'événement. |
| RG-535 | Les données du passport digital (scans par participant) sont conservées 12 mois maximum après l'événement pour les statistiques, puis supprimées automatiquement. Cette durée est mentionnée dans la politique RGPD. |
| RG-536 | Les QR codes des stands sont statiques : générés une fois et imprimés. Ils ne sont pas renouvelables dynamiquement. |
| RG-537 | En mode « Rendez-vous l'année prochaine », les pages Speakers, Sponsors et Programme restent accessibles comme archives consultables (pas de redirection 404). |
| RG-538 | Il n'y a pas de page « Après le DevFest » séparée : la page d'accueil en mode bilan (RG-531) remplit ce rôle. |

---

## User stories — Passport digital des stands

### US-500 : Affichage du passport digital

**En tant que** participant connecté,
**je veux** voir mon passport digital avec ma progression,
**afin de** suivre les stands que j'ai visités.

**Critères d'acceptation :**
- [ ] Page accessible via `/fr/passport` ou `/en/passport` (authentification requise).
- [ ] Affichage de la liste de tous les stands participants.
- [ ] Chaque stand affiche : nom du sponsor, logo, état (visité / non visité).
- [ ] Les stands visités sont marqués visuellement (tampon, check, couleur verte).
- [ ] Barre de progression en haut : « X / Y stands visités » avec pourcentage (RG-504).
- [ ] Si tous les stands sont visités, message de félicitations.
- [ ] Sur mobile : optimisé pour une utilisation debout, en déplacement (grands boutons, texte lisible).

### US-501 : Scan d'un QR code de stand

**En tant que** participant connecté,
**je veux** scanner le QR code d'un stand sponsor,
**afin d'** ajouter un tampon à mon passport digital.

**Critères d'acceptation :**
- [ ] Le QR code sur le stand encode une URL `https://devfesttoulouse.fr/passport/scan/{token}` (RG-507).
- [ ] Le participant scanne avec l'appareil photo natif de son téléphone → le navigateur ouvre l'URL.
- [ ] Si le participant est connecté :
  - Si le stand n'a pas encore été visité → tampon ajouté, confirmation visuelle (animation, message « Stand {Sponsor} validé ! »), redirection vers le passport.
  - Si le stand a déjà été visité → message « Vous avez déjà visité ce stand » (RG-506).
- [ ] Si le participant n'est pas connecté → redirection vers la page de connexion, puis retour vers l'URL du scan après connexion.
- [ ] La validation se fait côté serveur (RG-508).
- [ ] L'opération est rapide (< 2 secondes) pour ne pas frustrer le participant dans la file du stand.

### US-502 : Scanner intégré (optionnel)

**En tant que** participant connecté,
**je veux** scanner un QR code directement depuis la page passport,
**afin de** ne pas quitter l'application web.

**Critères d'acceptation :**
- [ ] Bouton « Scanner un QR code » sur la page passport.
- [ ] Ouverture de la caméra du téléphone via l'API Web (getUserMedia).
- [ ] Détection du QR code en temps réel.
- [ ] Validation automatique du scan.
- [ ] Gestion des permissions caméra (demande, refus, erreur).
- [ ] Fallback : si la caméra n'est pas disponible, message « Utilisez l'appareil photo de votre téléphone pour scanner le QR code ».

---

## User stories — Authentification participant

### US-510 : Inscription participant

**En tant que** visiteur du DevFest,
**je veux** créer un compte participant,
**afin d'** accéder au passport digital des stands.

**Critères d'acceptation :**
- [ ] Page d'inscription avec : email, mot de passe, confirmation de mot de passe.
- [ ] Option « S'inscrire avec Google » (OAuth).
- [ ] Validation : email unique (pas de doublon), mot de passe robuste (min 8 caractères, au moins un chiffre et une lettre).
- [ ] Après inscription réussie, redirection vers le passport digital.
- [ ] Email de confirmation optionnel (pas bloquant pour l'usage le jour J).

### US-511 : Connexion participant

**En tant que** participant,
**je veux** me connecter à mon compte,
**afin d'** accéder à mon passport digital.

**Critères d'acceptation :**
- [ ] La page de connexion existante (US-220) supporte aussi les participants.
- [ ] Après connexion, les participants sont redirigés vers le passport digital (et non vers un dashboard admin/speaker/sponsor).
- [ ] Les règles de sécurité existantes s'appliquent (blocage après 5 tentatives, etc.).

---

## User stories — Admin

### US-520 : Gestion du passport digital

**En tant qu'** admin,
**je veux** configurer le passport digital des stands,
**afin de** préparer le parcours ludique pour les participants.

**Critères d'acceptation :**
- [ ] Sélection des sponsors participants au passport (checkbox parmi les sponsors de l'édition) (RG-509).
- [ ] Génération automatique des QR codes pour chaque sponsor sélectionné.
- [ ] Export des QR codes en lot (PDF ou ZIP d'images) pour impression et affichage sur les stands.
- [ ] Chaque QR code est associé à un token unique et sécurisé.
- [ ] Activation / désactivation du passport digital (RG-510).
- [ ] Tableau de bord : nombre de participants ayant un passport, nombre moyen de stands visités, top 5 des stands les plus visités.

### US-521 : Bascule du statut annuel (post-événement)

**En tant qu'** admin,
**je veux** basculer le statut vers « Rendez-vous l'année prochaine »,
**afin de** passer le site en mode bilan.

**Critères d'acceptation :**
- [ ] Le mécanisme est celui déjà implémenté dans le Lot 1 (US-191).
- [ ] En mode « Rendez-vous l'année prochaine » :
  - La page d'accueil affiche le bilan (chiffres clés de l'édition 2026) (RG-531).
  - L'aftermovie est intégré (si disponible).
  - Les liens vers la galerie photos sont affichés.
  - La section billetterie est masquée (RG-532).
  - Le CTA « Proposer un talk » est remplacé par « Revoir les talks » (RG-533).
- [ ] Le passport digital est automatiquement désactivé (RG-534).
- [ ] Le cache est purgé.

### US-522 : Configuration des chiffres clés de l'édition

**En tant qu'** admin,
**je veux** saisir les chiffres clés de l'édition 2026 (après l'événement),
**afin de** les afficher dans le bilan sur la page d'accueil.

**Critères d'acceptation :**
- [ ] Champs éditables sur l'édition courante : nombre de participants, nombre de sessions, nombre de tracks, durée.
- [ ] Ces chiffres remplacent ceux de l'édition précédente sur la page d'accueil.

---

## User stories — Souhaitables

### US-530 : Visuels réseaux sociaux pour les sponsors

**En tant qu'** admin,
**je veux** générer des visuels de promotion pour chaque sponsor,
**afin de** valoriser les partenaires sur les réseaux sociaux.

**Critères d'acceptation :**
- [ ] Bouton « Générer le visuel » sur la fiche admin d'un sponsor.
- [ ] Le visuel inclut : logo du sponsor, nom, niveau de sponsoring, branding DevFest.
- [ ] Export PNG 1200x630px.
- [ ] Possibilité de génération en lot.

---

## Parcours utilisateur

### Parcours 1 : Participant utilise le passport digital le jour J

1. Le participant arrive au DevFest.
2. Il ouvre le site sur son téléphone : `devfesttoulouse.fr`.
3. Il voit un lien « Passport digital » (ou un CTA visible le jour de l'événement).
4. Il n'a pas de compte → il clique sur « S'inscrire ».
5. Il crée son compte avec son email ou via Google.
6. Il est redirigé vers son passport digital (vide, 0 / N stands).
7. Il se rend au stand d'un sponsor Platinum.
8. Il scanne le QR code affiché sur le stand avec l'appareil photo de son téléphone.
9. Le navigateur ouvre l'URL du scan → le tampon est ajouté → message « Stand {Sponsor} validé ! ».
10. Il revient sur le passport → le stand est marqué comme visité, la barre de progression passe à 1 / N.
11. Il répète pour d'autres stands tout au long de la journée.
12. En fin de journée, il a visité 8 / 12 stands.

### Parcours 2 : Participant scanne un QR code sans être connecté

1. Le participant scanne un QR code sur un stand.
2. Le navigateur ouvre l'URL `devfesttoulouse.fr/passport/scan/{token}`.
3. Il n'est pas connecté → redirection vers la page de connexion.
4. Il se connecte (ou crée un compte).
5. Après connexion, il est redirigé vers l'URL du scan → le tampon est ajouté.
6. Il est redirigé vers son passport avec le stand validé.

### Parcours 3 : Admin prépare le passport digital

1. L'admin accède à la section « Passport digital » du back-office.
2. Il voit la liste des sponsors de l'édition.
3. Il sélectionne les sponsors qui ont un stand (ex. 12 sur 20).
4. Il clique sur « Générer les QR codes ».
5. Il exporte les QR codes en PDF (un par page, avec le nom du sponsor).
6. Il imprime et distribue les QR codes aux sponsors pour affichage sur les stands.
7. Le jour J, il active le passport digital.
8. Pendant l'événement, il consulte le tableau de bord pour suivre la participation.

### Parcours 4 : Admin bascule en mode post-événement

1. Après l'événement, l'admin accède à la configuration du statut annuel.
2. Il sélectionne « Rendez-vous l'année prochaine ».
3. Confirmation → le statut change.
4. Il saisit les chiffres clés de l'édition 2026.
5. Il ajoute le lien de l'aftermovie (quand disponible, potentiellement quelques semaines après).
6. Il ajoute les liens vers les albums photos.
7. La page d'accueil affiche le bilan de l'édition.

---

## Cas limites et erreurs

### Passport digital

| Cas | Comportement attendu |
|-----|---------------------|
| QR code scanné deux fois par le même participant | Message « Vous avez déjà visité ce stand ». Pas de doublon (RG-506). |
| QR code invalide (token inexistant) | Message « QR code non reconnu. Vérifiez que vous êtes au bon endroit ». |
| QR code d'un sponsor non participant au passport | Message « Ce sponsor ne participe pas au passport digital ». |
| Participant non connecté scanne un QR code | Redirection vers la connexion, puis retour vers le scan après connexion. |
| Passport digital désactivé (hors période) | Message « Le passport digital n'est pas actif actuellement » (RG-510). |
| Perte de connexion réseau pendant un scan | Message d'erreur « Vérifiez votre connexion et réessayez ». Le tampon n'est pas ajouté tant que la validation serveur n'a pas eu lieu. |
| Tous les stands visités | Animation de félicitations + message « Bravo, vous avez visité tous les stands ! ». |
| Sponsor retiré du passport après que des participants l'ont visité | Le tampon reste dans les passports existants. Le nombre total de stands est mis à jour. |

### Authentification participant

| Cas | Comportement attendu |
|-----|---------------------|
| Inscription avec un email déjà utilisé | Message « Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe ». |
| Mot de passe trop faible | Message inline « Le mot de passe doit contenir au moins 8 caractères, avec un chiffre et une lettre ». |

### Bascule de statut

| Cas | Comportement attendu |
|-----|---------------------|
| Aftermovie pas encore disponible au moment de la bascule | La section aftermovie est masquée. Elle apparaît automatiquement quand l'admin ajoute le lien. |
| Photos pas encore disponibles | La section galerie est masquée. Elle apparaît quand les liens sont ajoutés. |
| Bascule accidentelle du statut | Confirmation obligatoire. Possibilité de revenir au statut précédent (bascule dans l'autre sens). |

### Performance jour J

| Cas | Comportement attendu |
|-----|---------------------|
| 1000 participants scannent des QR codes simultanément | L'endpoint de scan est optimisé pour supporter la charge (opération unitaire rapide, pas de transaction lourde). |
| Wi-Fi de la conférence saturé | L'UX mobile est légère (pas d'assets lourds). Un message invite à utiliser les données mobiles en cas de lenteur. |

---

## User stories — Édition en préparation (page d'accueil)

### Règles de gestion

| # | Règle |
|---|-------|
| RG-540 | En mode « Édition en préparation » (RG-082 du Lot 1), la page d'accueil affiche un contenu minimal orienté teasing et fidélisation. |
| RG-541 | Les éléments affichés en mode « Édition en préparation » sont : hero teasing (date et lieu si connus, sinon message générique), inscription newsletter, liens vers les réseaux sociaux, replay de l'édition précédente (aftermovie). |
| RG-542 | Les sections non pertinentes en mode préparation (billetterie, speakers en vedette, sponsors, actualités) sont masquées. |

### US-540 : Page d'accueil en mode « Édition en préparation »

**En tant que** visiteur,
**je veux** voir une page d'accueil teasing entre deux éditions,
**afin de** savoir que le DevFest Toulouse reviendra et de rester informé.

**Critères d'acceptation :**
- [ ] Le hero affiche le branding DevFest Toulouse avec un message teasing (ex. « Le DevFest Toulouse revient en 2027 ! ») et la date/lieu si connus.
- [ ] Un formulaire d'inscription newsletter est affiché de manière visible (email + bouton « S'inscrire »).
- [ ] Les liens vers les réseaux sociaux (LinkedIn, YouTube, X/Twitter, Bluesky) sont affichés avec des icônes cliquables.
- [ ] L'aftermovie de l'édition précédente est intégré (chargement différé, même logique que US-124).
- [ ] Les sections billetterie, speakers en vedette, sponsors et actualités sont masquées (RG-542).
- [ ] Le mécanisme de bascule est celui déjà implémenté dans le Lot 1 (US-191, RG-081).
- [ ] Le cache est purgé lors de la bascule vers ce statut (RG-140 du Lot 1).

---

## Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| QO-050 | Le passport digital est-il lié à une récompense (tombola, lot, badge physique) ? Si oui, quel est le seuil (100%, N stands minimum) ? | UX, gamification, logistique — **Non tranché**, à définir ultérieurement. |
| ~~QO-051~~ | ~~Scanner QR intégré ou natif ?~~ **Résolu** : scanner intégré dans le site (caméra via l'API web). | — |
| ~~QO-052~~ | ~~Vérifier le billet avant inscription ?~~ **Résolu** : non, inscription libre sans vérification Billetweb. | — |
| ~~QO-053~~ | ~~Données passport conservées ou supprimées ?~~ **Résolu** : conservées 12 mois maximum après l'événement (statistiques), puis supprimées automatiquement (RGPD). | — |
| ~~QO-054~~ | ~~Pages post-événement accessibles ?~~ **Résolu** : oui, les pages Speakers, Sponsors et Programme restent accessibles en mode « Rendez-vous l'année prochaine » (archive consultable, pas de 404). | — |
| ~~QO-055~~ | ~~QR codes statiques ou dynamiques ?~~ **Résolu** : statiques, générés une fois et imprimés. | — |
| ~~QO-056~~ | ~~Page « Après le DevFest » séparée ?~~ **Résolu** : non, la page d'accueil en mode bilan suffit. Pas de page séparée. | — |
