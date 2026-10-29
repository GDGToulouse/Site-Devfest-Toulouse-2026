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
| Numérotation des badges par guichet et par bac, PDF d'impression, gel, écriture du numéro dans Billetweb | Admin → Arrivées → Badges | #639 |
| Apparence des badges : fond et couleur par type, contenu du QR code, aperçu | Admin → Arrivées → Apparence des badges | #749 |
| Bénévoles : invitation par liste d'adresses, accès limité à `/arrivees` | Admin → Arrivées → Bénévoles | #640 |
| Écrans du jour J, flux temps réel, fonctionnement hors ligne | `/arrivees` | #641 |
| Poste **Scan** : lecture des billets à l'entrée, recherche par nom | `/arrivees` → Scan | #642 |
| Poste **Guichet** : tableau À chercher → Prêt → Distribué, par guichet ou par bac | `/arrivees` → Guichet N | #643 |
| Poste **Aide** : billets sans badge, impression d'une étiquette | `/arrivees` → Aide | #713 |
| Écran de suivi pour grand écran (admins et éditeurs) | `/arrivees/suivi` | #644 |
| Scans faits pendant une coupure réseau, renvoyés au retour | `/arrivees` → Scan | #645 |
| Suppression des participants 18 mois après l'événement | automatique, chaque nuit | RG-ARR-66 |

## Parcours de test

Suivez les étapes dans l'ordre : chacune prépare la suivante. **L'étape 4 (envoi à
l'impression) ne se défait pas** : avant elle, tout est provisoire ; après elle, les numéros sont
figés pour toute la durée de l'environnement.

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

1. **Guichets**, **Bacs par guichet**, **Badges par bac** (de 10 à 100), puis **Enregistrer**.
   Le tableau montre combien de badges tombent dans chaque bac et la plage de numéros de chaque
   bac (guichet 2, bac 0 : 2000 à 2099 pour des bacs de 100).
2. Mettez volontairement trop peu de bacs : un message dit combien il en manque et bloque
   l'envoi à l'impression.
3. **Apparence des badges** :
   - **Contenu du QR code** : le code du billet (lisible par l'application de badges Billetweb
     des sponsors, et par notre poste Scan) ou une carte de contact ;
   - pour chaque type (Participant, Speaker, Bénévole, Prestataire) : un fond pris dans la
     médiathèque (PNG, JPG, SVG ou PDF) ou le fond 2026 par défaut, et la couleur du texte ;
   - **Badge des tarifs de l'accueil dédié** : le type de badge de chaque tarif hors flux. Un
     type « déduit du nom du tarif, à confirmer » est une proposition.
   Puis **Enregistrer l'apparence**.
4. **Aperçu : un badge de chaque type** : un PDF de quatre pages, une par type.
5. **Télécharger tous les badges (provisoire)** : le PDF complet, trié par guichet puis par bac,
   avec un intercalaire par bac, suivi des badges de l'accueil dédié.

À vérifier dans les PDF : format A6 ; prénom, nom et entreprise lisibles, y compris les noms
longs et accentués ; numéro complet en haut à droite sur les badges Participant, absent sur les
autres ; le QR code se lit avec un téléphone.

### 4. Envoyer à l'impression (gel) — irréversible

**Envoyer à l'impression** → confirmer. Les numéros deviennent définitifs et sont écrits dans
le champ « Numéro de badge » des billets de l'événement de test ; la ligne « Billetweb : N
numéros écrits » suit l'avancement.

À vérifier :
- **Badges par bac** reste modifiable, mais demande maintenant une confirmation ;
- un participant ajouté ensuite dans Billetweb, puis importé, n'a pas de numéro : l'admin
  annonce qu'il passera au guichet d'aide.

Les écrans Guichet n'affichent que des badges numérotés : ils restent vides tant que cette étape
n'est pas faite.

### 5. Les écrans du jour J

Ouvrez `/arrivees` sur un ou plusieurs téléphones ou ordinateurs, avec votre compte admin ou un
compte bénévole créé plus haut. Chaque appareil choisit son poste une fois et s'en souvient
(« Changer de poste » pour revenir au choix).

**Scan**
- **Scanner un billet** ouvre la caméra. Pour avoir des codes à lire : affichez le PDF des
  badges sur un écran d'ordinateur (QR code réglé sur « Code du billet ») et scannez-le avec le
  téléphone.
- Sans caméra : le champ **« Nom, prénom ou code du billet »** retrouve une personne ; la toucher
  vaut un scan.
- Le résultat dit où envoyer la personne : guichet et numéro de badge, accueil dédié, guichet
  d'aide, billet annulé, déjà scanné.
- En bas, la charge de chaque guichet (badges en attente).

**Guichet N** (tout le guichet, ou un seul bac pour le bénévole qui le tient)
- Un billet scanné apparaît dans **À chercher**, avec un signal sonore (après un premier toucher
  de l'écran : les navigateurs coupent le son avant).
- Toucher une carte la fait avancer : À chercher → Prêt → Distribué. ↩ la fait reculer.
- Ouvrez le même guichet sur deux appareils : un mouvement sur l'un apparaît aussitôt sur
  l'autre.

**Aide**
- Les billets scannés sans badge imprimé arrivent dans **À traiter**.
- Recherche par nom pour tout autre cas : badge introuvable dans son bac, billet modifié.
- **Imprimer l'étiquette** ouvre la boîte d'impression du navigateur, au format du rouleau
  choisi ; l'étiquette remise passe le participant en Distribué.

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
- **Le gel ne se défait pas** depuis l'interface. Pour repartir de zéro, demandez à Julien de
  réinitialiser la base de l'environnement.
- **Ce qui ne se teste pas ici** : l'impression réelle sur la Zebra (seule la mise en page de
  l'étiquette est vérifiable, via « Enregistrer en PDF » dans la boîte d'impression) et le
  comportement sous la charge d'un vrai jour J.

## Signaler un problème

Ouvrez une issue GitHub, ou écrivez à Julien, avec : l'écran et le poste, l'appareil et le
navigateur (iPhone Safari, Android Chrome…), ce que vous avez fait, ce que vous attendiez, ce
qui s'est passé, et une capture d'écran.
