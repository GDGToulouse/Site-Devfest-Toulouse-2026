# Recette de l'accueil du jour J — guide pour les admins

Ce guide présente les nouvelles fonctionnalités de l'accueil des participants (import Billetweb,
badges, bénévoles, écrans du jour J) et la façon de les tester sur l'environnement de recette.
Les règles métier complètes sont dans [`specs/gestion-arrivees.md`](specs/gestion-arrivees.md).

## Où tester

| Quoi | Adresse |
|---|---|
| Site de recette | https://dev-arrivals.site.devfesttoulouse.fr |
| Back-office | https://dev-arrivals.site.devfesttoulouse.fr/admin |
| Écrans du jour J | https://dev-arrivals.site.devfesttoulouse.fr/arrivees |
| Boîte mail de test (Mailpit) | https://mailhog.dev-arrivals.site.devfesttoulouse.fr |

Cet environnement a **sa propre base**, remplie avec les données de démonstration : rien de ce
que vous y faites ne touche la prod, la beta ni `dev-j`. Il est lié à l'événement Billetweb
caché **« Test JDR Arrivées »**, jamais au vrai : sa clé Billetweb n'a de droits que sur lui.

### Se connecter

- **Avec Google**, si votre adresse fait partie des admins de l'environnement (`ADMIN_EMAILS`) :
  vous arrivez directement en admin. La connexion GitHub ne marche pas sur cet environnement.
- **Avec le compte de démonstration** `admin@devfesttoulouse.fr` : son mot de passe est la
  variable `DEV_SEED_PASSWORD` de Coolify, à demander à Julien.

## La boîte mail de test (Mailpit)

Sur cet environnement, **aucun e-mail ne sort** : tous sont capturés par Mailpit, quelle que soit
l'adresse du destinataire. C'est ce qui permet de créer des comptes de test avec des adresses
inventées.

- Ouvrir https://mailhog.dev-arrivals.site.devfesttoulouse.fr. Le navigateur demande un
  identifiant et un mot de passe : ce sont `MAILHOG_USER` et `MAILHOG_PASSWORD` de Coolify, à
  demander à Julien.
- La liste montre tous les e-mails envoyés par le site, le plus récent en haut. Un clic ouvre le
  message ; les liens qu'il contient sont cliquables.
- Utilisez des adresses inventées, du type `benevole1@example.org`, `benevole2@example.org` :
  elles n'ont pas besoin d'exister. N'utilisez pas l'adresse d'une vraie personne : c'est inutile,
  et cela laisserait son adresse dans une base de test.

### Créer un compte bénévole

1. Back-office → **Arrivées** → section **Bénévoles** : collez une ou plusieurs adresses
   inventées, puis **Inviter**.
2. Dans Mailpit, ouvrez l'e-mail « DevFest Toulouse 2026 — votre accès à l'accueil des
   participants » et copiez son lien.
3. Ouvrez ce lien dans une **fenêtre de navigation privée** (ou un autre navigateur, ou un
   téléphone) : dans la fenêtre où vous êtes connecté en admin, le lien se heurterait à votre
   propre session.
4. Choisissez un mot de passe : le compte est créé et ouvre `/arrivees`. Dans l'admin, la ligne
   passe à « Accès ouvert ».

Un compte bénévole n'ouvre **que** `/arrivees`, pour cette édition : ni le back-office, ni
l'écran de suivi. C'est à vérifier aussi.

### Autres e-mails à retrouver dans Mailpit

- **Mot de passe oublié** sur `/admin` ou `/arrivees/connexion` : le lien de réinitialisation
  arrive dans Mailpit.
- **Lien de connexion** (lien magique) : idem.
- **Invitation d'un contact sponsor** (fiche sponsor → Contacts) : idem, à ouvrir aussi en
  navigation privée.

## Ce qui est nouveau

| Fonctionnalité | Où | Issue |
|---|---|---|
| Import des participants depuis Billetweb, tarifs « hors flux » (accueil dédié) | Admin → Arrivées ; édition → onglet Billetterie | #638 |
| Numérotation des badges par guichet et par présentoir, PDF d'impression, gel, écriture du numéro dans Billetweb | Admin → Arrivées → Badges | #639 |
| Apparence des badges : fond et couleur par type, contenu du QR code, aperçu | Admin → Arrivées → Apparence des badges | #749 |
| Bénévoles : invitation par liste d'adresses, accès limité à `/arrivees` | Admin → Arrivées → Bénévoles | #640 |
| Écrans du jour J, flux temps réel, fonctionnement hors ligne | `/arrivees` | #641 |
| Poste **Scan** : lecture des billets à l'entrée, recherche par nom | `/arrivees` → Scan | #642 |
| Poste **Guichet** : tableau À chercher → Prêt → Distribué, un écran par guichet, tous ses présentoirs | `/arrivees` → Guichet N | #643 |
| Poste **Aide** : billets sans badge, impression d'une étiquette | `/arrivees` → Aide | #713 |
| Écran de suivi pour grand écran (admins et éditeurs) | `/arrivees/suivi` | #644 |
| Scans faits pendant une coupure réseau, renvoyés au retour | `/arrivees` → Scan | #645 |
| Une adresse par poste, QR code par poste sans compte, fenêtre de validité, régénération, pages A4 | Admin → Arrivées → QR codes des postes ; `/arrivees/poste/<jeton>` | #775 |
| Suppression des participants 18 mois après l'événement | automatique, chaque nuit | RG-ARR-66 |

## Parcours de test

Suivez les étapes dans l'ordre : chacune prépare la suivante. **L'étape 4 (envoi à
l'impression) fige les numéros** : avant elle, tout est provisoire ; après elle, un admin peut
encore annuler le gel, mais seulement tant qu'aucun billet n'a été scanné.

### 1. Lier l'édition à l'événement de test

1. Admin → **Éditions** → 2026 → onglet **Billetterie** → **Importer depuis Billetweb**.
2. Choisissez **« Test JDR Arrivées »** dans la liste, puis **Importer**. Les tarifs de
   l'événement apparaissent.
3. Ouvrez chaque tarif réservé aux speakers, à l'équipe, aux bénévoles ou aux prestataires et
   cochez **Hors flux** : ces billets passent par l'accueil dédié, sans numéro de badge ni
   guichet.

À vérifier : les tarifs correspondent à ceux de Billetweb ; la case « Hors flux » reste cochée
après un nouvel import des tarifs.

### 2. Importer les participants

1. Admin → **Arrivées** → **Importer depuis Billetweb**.
2. Lisez le compte rendu (nouveaux, mis à jour, annulés) et les totaux : Attendus, Aux guichets,
   Accueil dédié, Annulés ou remboursés.
3. Relancez l'import : il ne reprend que ce qui a changé (« Import des changements »).

À vérifier : les totaux par tarif correspondent à Billetweb ; aucun message « tarif que le site
ne connaît pas ».

### 3. Régler les badges et regarder l'aperçu

Dans la section **Badges** :

1. **Guichets**, **Présentoirs par guichet**, **Badges par présentoir** (de 10 à 100), puis **Enregistrer**.
   Le tableau montre combien de badges tombent dans chaque présentoir et la plage de numéros de chaque
   présentoir (guichet 2, présentoir 1 : « 2 1 00 à 2 1 99 » pour des présentoirs de 100). Guichets et présentoirs se comptent à partir de 1, le rang à partir de 00.
2. Mettez volontairement trop peu de présentoirs : un message dit combien il en manque et bloque
   l'envoi à l'impression.
3. **Apparence des badges** :
   - **Contenu du QR code** : le code du billet (lisible par l'application de badges Billetweb
     des sponsors, et par notre poste Scan) ou une carte de contact ;
   - **Couleur du QR code**, séparée de celle du texte ;
   - pour chaque type (Participant, Sponsor, Staff, Speaker, Bénévole, Prestataire) : un fond
     recto et un fond verso pris dans la médiathèque (PNG, JPG, SVG ou PDF) ou le fond V3 par
     défaut, et la couleur du texte ;
   - **Badge de chaque tarif** : Participant ou Sponsor pour un tarif des guichets, Bénévole,
     Staff, Speaker ou Prestataire pour un tarif hors flux. Un type « déduit du nom du tarif, à
     confirmer » est une proposition.
   Puis **Enregistrer l'apparence**.
4. **Aperçu : recto et verso de chaque type** : un PDF de douze pages, le verso après chaque recto.
5. **Télécharger tous les badges (provisoire)** : le PDF complet, trié par guichet puis par présentoir,
   avec un intercalaire par présentoir, suivi des badges de l'accueil dédié. Recto-verso : chaque
   badge est suivi de son verso, chaque intercalaire d'une page blanche.

**Revenir en arrière** (admins) : après l'envoi à l'impression, **Annuler le gel** (taper
« ANNULER ») efface les numéros ici et dans Billetweb, tant qu'aucun badge n'a été scanné ; ensuite
le bouton est grisé. **Réinitialiser l'accueil** (taper « REINITIALISER ») n'existe pas en
production : il supprime les participants importés, leurs scans et l'historique, pour repartir
d'un import propre.

À vérifier dans les PDF : format A6 ; prénom, nom et entreprise lisibles, y compris les noms
longs et accentués ; numéro séparé (« 2 1 47 ») en haut à droite sur les badges Participant et Sponsor, absent sur les
autres ; le QR code se lit avec un téléphone.

### 4. Envoyer à l'impression (gel)

**Envoyer à l'impression** → confirmer. Les numéros deviennent définitifs et sont écrits dans
le champ « Numéro de badge » des billets de l'événement de test ; la ligne « Billetweb : N
numéros écrits » suit l'avancement.

À vérifier :
- **Badges par présentoir** reste modifiable, mais demande maintenant une confirmation ;
- un participant ajouté ensuite dans Billetweb, puis importé, n'a pas de numéro : l'admin
  annonce qu'il passera au guichet d'aide.

Les écrans Guichet n'affichent que des badges numérotés : ils restent vides tant que cette étape
n'est pas faite.

### 5. Les écrans du jour J

Ouvrez `/arrivees` sur un ou plusieurs téléphones ou ordinateurs, avec votre compte admin ou un
compte bénévole créé plus haut, et choisissez un poste. Chaque poste a son adresse
(`/arrivees/scan`, `/arrivees/guichet/2`, `/arrivees/aide`) :
« Changer de poste » revient au choix.

**Sans compte : les QR codes des postes** (#775). Admin → Arrivées → **QR codes des postes** :

1. Réglez la **fenêtre** si besoin. Par défaut : de minuit la veille de l'événement à la fin de
   son dernier jour. Pour tester maintenant, ouvrez-la d'hier à demain, puis **Enregistrer la
   fenêtre**.
2. **Ouvrir ce poste** (ou scannez le QR code affiché) dans une **fenêtre de navigation privée** ou
   sur un téléphone : le poste s'ouvre connecté, sans compte. Il n'offre ni « Changer de poste »,
   ni écran de suivi, ni déconnexion.
3. Dans cette même fenêtre, essayez `/admin`, `/arrivees/suivi` et l'adresse d'un autre poste :
   tout est refusé ou ramené au poste.
4. Hors fenêtre (fermez-la : fermeture dans le passé), le même QR code affiche un message clair.
5. **Régénérer** (taper « REGENERER ») : les QR codes déjà ouverts, imprimés ou affichés cessent de
   marcher, et l'écran déjà ouvert l'annonce en une minute. Les nouveaux fonctionnent.
6. **Imprimer les pages A4** : une page par poste (Scan, Aide, chaque guichet : 6 pages pour
   4 guichets), le nom en très grand, le QR code, deux lignes. Choisissez « Enregistrer au format
   PDF » pour la relire sans imprimante.

À vérifier : un badge déplacé depuis un poste est tracé « Poste Guichet N » dans son historique ;
le poste d'un guichet ne déplace pas les badges d'un autre guichet. Le compte nominatif des
bénévoles reste utilisable à côté.

**Des billets à scanner.** Personne n'a de vrai billet de l'événement de test : ce sont les
badges qui en tiennent lieu. Admin → Arrivées → Badges → **Télécharger tous les badges
(provisoire)**, ouvrez le PDF sur un écran d'ordinateur, et scannez les QR codes avec le
téléphone. Il faut que **Contenu du QR code** soit réglé sur « Code du billet » (Apparence des
badges) : une carte de contact ne se scanne pas à l'entrée. Chaque page est un billet différent ;
un badge déjà scanné répond « déjà scanné ».

**Scan**
- **Scanner un billet** ouvre la caméra. Les billets : voir juste au-dessus.
- Sans caméra : le champ **« Nom, prénom ou code du billet »** retrouve une personne ; la toucher
  vaut un scan.
- Le résultat dit où envoyer la personne : guichet et numéro de badge, accueil dédié, guichet
  d'aide, billet annulé, déjà scanné.
- En bas, la charge de chaque guichet (badges en attente).
- **Annuler ce scan** (une minute après le scan, sur le téléphone qui l'a fait) : la carte quitte
  le guichet, le billet est décomposté dans Billetweb, et un nouveau scan compte comme le
  premier. Après la minute, seul un admin peut annuler, depuis l'écran Aide (fiche de la
  personne). Un badge déjà distribué ne s'annule pas.

**Guichet N** (tout le guichet : ses bénévoles servent tous ses présentoirs)
- Un billet scanné apparaît dans **À chercher**, avec un signal sonore (après un premier toucher
  de l'écran : les navigateurs coupent le son avant).
- Toucher une carte la fait avancer : À chercher → Prêt → Distribué. ↩ la fait reculer.
- Ouvrez le même guichet sur deux appareils : un mouvement sur l'un apparaît aussitôt sur
  l'autre.
- **Chercher** (nom ou numéro de badge, `1 2 05`) : une personne de ce guichet → « Voir la
  carte » met sa carte en évidence ; une personne d'un autre guichet → « Au guichet 3 ».
- Téléphone en **paysage** : les trois colonnes passent côte à côte.

**Aide**
- Les billets scannés sans badge imprimé arrivent dans **À traiter**.
- Recherche par nom pour tout autre cas : badge introuvable dans son présentoir, billet modifié.
- **Scanner un billet** : la caméra lit la confirmation (ou un badge du PDF) et ouvre la fiche
  de la personne ; le scan compte comme à l'entrée.
- **Imprimer l'étiquette** ouvre la boîte d'impression du navigateur, au format du rouleau
  choisi ; l'étiquette remise passe le participant en Distribué. Prénom, nom et entreprise se
  corrigent avant l'impression ; l'étiquette est centrée et porte le QR code du badge.
- **Étiquette sans billet** : prénom, nom et entreprise obligatoires, pas de QR code. Le suivi
  compte les étiquettes générées, dont celles sans billet.

**Suivi** (`/arrivees/suivi`, ou le lien « Écran de suivi du jour J » de la page Arrivées) :
totaux en direct, pour un grand écran. Réservé aux admins et éditeurs : vérifiez qu'un compte
bénévole y est refusé.

### 6. Coupure réseau

Sur un téléphone en poste **Scan**, une fois la page chargée :

1. Passez en mode avion. L'indicateur de connexion quitte « Connecté » (« Reconnexion… »,
   puis « Déconnecté »).
2. Scannez un billet : le téléphone donne quand même le numéro de badge (table hors ligne) et
   annonce que le scan sera enregistré au retour du serveur.
3. Réactivez le réseau sans fermer l'application : le scan est envoyé, et la carte apparaît sur
   le guichet avec la mention « Scanné pendant la coupure : déjà remis ? » et un bouton ✓.

## Précautions

- **Billetweb** : l'environnement écrit dans l'événement de test seulement (numéros de badge au
  gel, compostage des billets scannés, relancé chaque minute). Ne liez jamais l'édition au vrai
  événement : la clé le refuserait, mais ne tentez pas l'essai.
- **Revenir en arrière** : « Annuler le gel » tant qu'aucun billet n'a été scanné, sinon
  « Réinitialiser l'accueil » (participants, scans et historique supprimés, puis réimport). La
  réinitialisation ne décomposte pas les billets dans Billetweb.
- **Ce qui ne se teste pas ici** : l'impression réelle sur la Zebra (seule la mise en page de
  l'étiquette est vérifiable, via « Enregistrer en PDF » dans la boîte d'impression) et le
  comportement sous la charge d'un vrai jour J.

## Signaler un problème

Ouvrez une issue GitHub, ou écrivez à Julien, avec : l'écran et le poste, l'appareil et le
navigateur (iPhone Safari, Android Chrome…), ce que vous avez fait, ce que vous attendiez, ce
qui s'est passé, et une capture d'écran.
