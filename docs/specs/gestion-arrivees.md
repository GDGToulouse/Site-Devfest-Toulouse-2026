# Gestion des arrivées — badges et accueil

**Version** : v2, 22 octobre 2026. Intègre les retours de l'équipe (Lionel, Arnaud, Valentin) :
guichets, kanban, guichet d'aide avec imprimante d'étiquettes.
**Échéance** : 19 novembre 2026 (jour du DevFest). Les badges partent à l'impression **5 jours
avant** (14 novembre) : la numérotation et le PDF d'impression sont sur le chemin critique.
**Milestone** : `asap-arrivees`, volontairement hors du schéma `asap` / `next` / `next-year` : la
fonctionnalité est engagée, mais sur sa propre échéance.
**Objectif** : à l'arrivée, le participant reçoit son badge imprimé à l'avance sans attendre qu'un
bénévole le cherche dans 1 200 badges.
**Maquette validée** : <https://claude.ai/artifact/AGEayw3mq2du1bykPr3SQk> (file, guichets, écrans).

**Prérequis** : import des tarifs Billetweb (`src/backend/src/routes/admin/tickets.ts`).

**Nomenclature** : `RG-ARR-xx` pour les règles, `US-ARR-xx` pour les user stories, pour ne pas
les confondre avec les numéros d'issues GitHub. Les dizaines suivent les sections : 10
participants et numérotation, 20 accès, 30 scan, 40 guichets, 50 guichet d'aide, 60 temps réel,
suivi et données.

---

## Table des matières

1. [Le parcours](#le-parcours)
2. [Organisation sur place](#organisation-sur-place)
3. [Règles de gestion](#règles-de-gestion)
4. [User stories](#user-stories)
5. [Cas limites](#cas-limites)
6. [Contraintes techniques](#contraintes-techniques)
7. [Écarts avec l'existant](#écarts-avec-lexistant)
8. [Découpage](#découpage)
9. [Questions ouvertes](#questions-ouvertes)

---

## Le parcours

1. **Le participant entre dans la file** avec sa confirmation Billetweb, imprimée ou sur son
   téléphone. Speakers, staff, bénévoles et prestataires vont directement à l'accueil dédié.
2. **Un bénévole Scan remonte la file** et scanne la confirmation (ou cherche par nom). Son
   téléphone affiche le numéro de badge, par exemple `2147`, et le guichet : « guichet 2 ». Il
   l'annonce au participant. Le badge apparaît aussitôt dans la colonne « À chercher » de
   l'écran du guichet 2.
3. **Au guichet 2, le bénévole du bac 1** (badges 2100 à 2199) sort le `2147` de son bac, le pose
   à l'avant du comptoir et touche la carte : elle passe en « Prêt ».
4. **Le participant arrive au guichet 2** et donne son numéro ou son nom. Son badge l'attend.
5. **Le bénévole vérifie le nom, remet le badge** et touche la carte : elle passe en
   « Distribué ».

Tout ce qui sort de ce parcours (billet oublié, code inconnu, billet annulé, billet acheté après
l'impression, badge introuvable) part au **guichet d'aide**, qui imprime au besoin une étiquette
sur une Zebra ZD421d.

---

## Organisation sur place

| Poste | Matériel | Rôle |
|---|---|---|
| **Scan** (2 bénévoles ou plus) | Leur smartphone | Remontent la file, scannent, annoncent numéro et guichet |
| **Guichet 1 à 4** | Un portable par guichet, au fond du meuble, écran vers les bénévoles ; badges prêts à l'avant | 300 badges, 3 bacs de 100, un bénévole par bac. Le kanban du guichet est sur le portable, et sur le smartphone de chaque bénévole s'il le veut |
| **Guichet d'aide** | Un portable ou un smartphone, une Zebra ZD421d (étiquettes noir et blanc, ZPL), des badges vierges | Recherche par nom, cas particuliers, impression d'étiquettes |
| **Accueil dédié** | — | Speakers, staff, bénévoles, prestataires : catégorie de badge dédiée, hors numérotation |

Le **bac** (la « centaine » des échanges précédents) est l'unité physique de rangement ; le
**guichet** est l'unité d'organisation. Chaque guichet a ses bacs et son équipe, fixes pour la
journée.

La vente s'arrête à l'impression ; des billets s'ajoutent encore à la main dans Billetweb
jusqu'au jour J, de façon ponctuelle. Ils passent par le guichet d'aide.

---

## Règles de gestion

### Participants et numérotation

| # | Règle |
|---|-------|
| RG-ARR-10 | Une édition se **lie** à un événement Billetweb. Une fois lié, l'import des tarifs et des participants met à jour l'existant au lieu de l'écraser. L'admin peut **défaire** le lien (erreur d'événement, changement d'événement) ; défaire le lien ne supprime ni tarifs ni participants. |
| RG-ARR-11 | Un tarif garde son identifiant Billetweb. La réimport met à jour les tarifs connus, crée les nouveaux, et ne touche pas aux réglages propres au site (dont la case « hors flux »). |
| RG-ARR-12 | Les participants d'une édition sont importés depuis l'événement Billetweb lié (`GET /api/event/{id}/attendees`). L'import se relance à la demande par un admin et est incrémental (`last_update`). Les billets remboursés ou annulés (`disabled`) sont marqués annulés, pas supprimés : leur badge a pu être imprimé. |
| RG-ARR-13 | Pour chaque participant, on conserve : id du billet, `barcode`, prénom, nom, e-mail, entreprise (champ perso Billetweb), tarif (`ticket_id`), catégorie, date et id de commande. L'e-mail ne s'affiche sur aucun écran d'accueil ; il sert à informer les participants de l'édition suivante. |
| RG-ARR-14 | Le flux dédié se reconnaît au tarif : les tarifs « hors flux » se cochent dans le back-office des billets de l'édition. Ses participants n'ont pas de numéro. |
| RG-ARR-15 | Le **numéro de badge** a quatre chiffres : **guichet** (1 à 4), **bac** (0 à 2), **rang** dans le bac (00 à 99). `2147` = guichet 2, bac 1, 47ᵉ badge du bac. Numéro = guichet × 1000 + bac × 100 + rang. |
| RG-ARR-16 | Les numéros s'attribuent **billet par billet, à tour de rôle**, dans l'**ordre d'achat** (date de commande, puis commande, puis billet). Pour le n-ième billet (n à partir de 1) : guichet = ((n − 1) mod 4) + 1 ; bac = ⌊(n − 1) / 4⌋ mod 3 ; rang = ⌊(n − 1) / 12⌋. Une commande de collègues se répartit ainsi sur les quatre guichets, et chaque bac reçoit le même nombre de badges. |
| RG-ARR-17 | Le nombre de guichets (4) et de bacs par guichet (3) sont des réglages de l'édition, modifiables jusqu'au gel ; la formule de RG-ARR-16 les prend en paramètre. La capacité vaut guichets × bacs × 100. Si les participants à numéroter la dépassent, la numérotation est **refusée** avec le nombre de bacs manquants : jamais de rang à trois chiffres. |
| RG-ARR-18 | L'envoi à l'impression (J-5) **gèle** la numérotation : un numéro attribué ne change plus jamais. Un import après le gel ajoute les nouveaux participants **sans numéro**, orientés vers le guichet d'aide, et ne renumérote rien. |
| RG-ARR-19 | Le PDF d'impression sort dans l'**ordre des numéros**, guichet par guichet, bac par bac, avec une page de séparation par bac, pour que les badges se rangent dans l'ordre où ils sortent de l'imprimerie. |
| RG-ARR-20 | Après le gel, le numéro de badge est écrit dans le champ perso de billet Billetweb **« Numéro de badge »** (`POST /api/event/{id}/update_product`), pour trace. Le champ est créé dans Billetweb au moment de traiter l'issue, masqué au participant ; son id se lit par `GET /api/fields`. |

### Accès et rôles

| # | Règle |
|---|-------|
| RG-ARR-21 | Un rôle `GUEST` s'ajoute à `ADMIN`, `EDITOR` et `SPONSOR`. Il ne donne accès qu'aux informations publiques. |
| RG-ARR-22 | La permission « gestion des arrivées » est attribuée par un admin, **par édition** : elle tombe d'elle-même pour l'édition suivante. Elle s'ajoute au rôle, quel qu'il soit. |
| RG-ARR-23 | Les bénévoles reçoivent un compte à l'avance, en `GUEST`, par **invitations en lot** (une quarantaine d'adresses collées d'un coup). Une invitation peut porter directement la permission « arrivées » de l'édition en cours. |
| RG-ARR-24 | Un compte invité est créé avec `role = GUEST` **explicite** et `emailVerified = true` à l'acceptation. Jamais la valeur par défaut `EDITOR` (#362), et jamais `emailVerified = false`, qui ferait effacer son mot de passe par le premier lien magique (better-auth 1.7, cf. `auth.md`). |
| RG-ARR-25 | À l'ouverture de la zone « Gestion des arrivées », le porteur de la permission choisit son poste : **Scan**, **Guichet** (avec son numéro, et en option son bac) ou **Aide**. Il peut en changer à tout moment. Le poste se retient sur l'appareil : le portable d'un guichet rouvre son guichet. |
| RG-ARR-26 | L'écran de suivi est réservé à `ADMIN` et `EDITOR`. |

### Scan

| # | Règle |
|---|-------|
| RG-ARR-30 | Le scan lit le QR code et le code-barres de la confirmation (même valeur, le `barcode` Billetweb). Une saisie manuelle du code reste possible. |
| RG-ARR-31 | La recherche par nom et/ou prénom est disponible sur le même écran, pour qui vient sans confirmation. Elle interroge le backend. |
| RG-ARR-32 | Le résultat affiche en grand le **numéro** et le **guichet**, à annoncer à voix haute, puis le bac, le prénom, le nom et l'entreprise pour vérifier l'identité. Le badge passe « À chercher » sur l'écran de son guichet. |
| RG-ARR-33 | Les résultats hors parcours se distinguent d'un coup d'œil : **accueil dédié** (flux dédié) ; **guichet d'aide** (billet sans numéro, acheté après le gel) ; **déjà scanné** ; **code inconnu ou billet annulé**. |
| RG-ARR-34 | Un billet déjà scanné déclenche une **alerte**, sans blocage : heure du premier scan, bénévole, état actuel du badge et guichet. |
| RG-ARR-35 | Un code inconnu ou un billet annulé affiche une erreur claire et propose la recherche par nom ; à défaut, le participant va au guichet d'aide. |
| RG-ARR-36 | L'écran Scan montre en permanence la **charge de chaque guichet** : le nombre de badges scannés et pas encore distribués (« À chercher » + « Prêt »). Orange au-delà de 10, rouge au-delà de 20. |
| RG-ARR-37 | Le scan composte le billet dans Billetweb (`POST /api/event/{id}/check`, `lane` = nom du bénévole). Un échec de compostage ne bloque pas l'accueil : il est retenté plus tard. |

### Guichets

| # | Règle |
|---|-------|
| RG-ARR-40 | Un badge numéroté a quatre états : **Imprimé** (pas encore scanné), **À chercher**, **Prêt**, **Distribué**. Le scan le fait passer d'Imprimé à À chercher. |
| RG-ARR-41 | L'écran d'un guichet est un **kanban** à trois colonnes : À chercher (du plus ancien au plus récent), Prêt, Distribué (les 10 derniers). Il se met à jour en temps réel, sans action ; un son ou une vibration signale une nouvelle carte. |
| RG-ARR-42 | Chaque carte porte le numéro, le prénom, le nom, l'entreprise et la **couleur de son bac** : chaque bénévole repère les siennes. Sur smartphone, un bénévole peut n'afficher que son bac. |
| RG-ARR-43 | Toucher une carte la fait avancer : À chercher → Prêt → Distribué. Toucher une carte Distribué la ramène en Prêt. Une action secondaire sur une carte Prêt la ramène en À chercher. |
| RG-ARR-44 | Une transition porte l'état attendu au départ : si la carte a déjà bougé (même guichet ouvert sur le portable et un smartphone), le serveur l'ignore et l'écran se resynchronise. Pas d'état « pris » : un bénévole par bac, personne d'autre ne cherche ses badges. |
| RG-ARR-45 | L'écran appartient au guichet, pas à une personne : un bénévole qui prend la relève n'a rien à configurer. |
| RG-ARR-46 | Un admin peut ramener n'importe quel badge à l'état précédent. |

### Guichet d'aide

| # | Règle |
|---|-------|
| RG-ARR-50 | L'écran Aide cherche par nom ou prénom parmi tous les participants de l'édition, flux dédié compris, et affiche pour chacun son numéro, son guichet et son état (pas encore scanné, à chercher, prêt, distribué), ou « sans badge imprimé », ou « billet annulé ». |
| RG-ARR-51 | L'aide **imprime une étiquette** pour un participant sans numéro, ou dont le badge est introuvable : prénom, nom, entreprise, sur une étiquette noir et blanc générée en ZPL pour la Zebra ZD421d, à coller sur un badge vierge. Le gabarit suit le format du rouleau (question ouverte). |
| RG-ARR-52 | Imprimer une étiquette puis la remettre fait passer le participant en **Distribué**. Un badge numéroté qui était À chercher ou Prêt quitte alors l'écran de son guichet. Le suivi compte les étiquettes à part. |
| RG-ARR-53 | Un participant sans numéro scanné dans la file apparaît dans la liste « à traiter » de l'écran Aide, en temps réel. |
| RG-ARR-54 | Une réimpression est possible (étiquette ratée) ; chaque impression est tracée (heure, bénévole). |

### Temps réel, suivi, données

| # | Règle |
|---|-------|
| RG-ARR-60 | Les écrans Scan, Guichet, Aide et Suivi se mettent à jour en temps réel, sans rafraîchir. Un indicateur permanent montre l'état de la connexion au flux : connecté, reconnexion en cours, déconnecté. |
| RG-ARR-61 | À chaque reconnexion, l'écran relit l'état complet : aucune mise à jour perdue pendant une coupure. |
| RG-ARR-62 | L'écran de suivi montre en temps réel : attendus, scannés, distribués, en attente ; une barre par guichet (À chercher, Prêt, Distribué) ; le flux dédié (scannés / attendus) et les étiquettes de l'aide à part. Lisible sur un grand écran. |
| RG-ARR-63 | L'application (pages, scripts, styles, lecteur de codes) est mise en cache sur le téléphone et s'installe sur l'écran d'accueil. |
| RG-ARR-64 | **Mode hors ligne** (issue optionnelle, le réseau sur place étant jugé stable) : le téléphone Scan précharge la table code → numéro de badge et le statut de flux, et met ses scans en file d'attente locale pendant une coupure. La recherche par nom et la charge des guichets restent en ligne. |
| RG-ARR-65 | En mode hors ligne, aucune donnée personnelle n'est stockée sur le téléphone : la table préchargée est indexée par une empreinte du code, et effacée à la fin de l'événement. |
| RG-ARR-66 | Les données des participants sont conservées **18 mois** après l'événement, pour informer les participants de l'édition suivante, puis supprimées. La politique de confidentialité le mentionne. **En attente d'un accord explicite** (question ouverte). |

---

## User stories

### US-ARR-01 : Importer les participants

**En tant qu'**admin, **je veux** importer les participants de l'édition depuis Billetweb,
**afin de** préparer la numérotation et l'accueil.

- [ ] Import depuis l'événement Billetweb lié à l'édition ; relance incrémentale, y compris
      jusqu'au jour J pour les billets ajoutés à la main après le gel.
- [ ] Compte rendu : nouveaux, mis à jour, annulés, sans numéro après le gel.
- [ ] Un import ne touche jamais un numéro attribué (RG-ARR-18).

### US-ARR-02 : Marquer les tarifs hors flux

**En tant qu'**admin, **je veux** cocher les tarifs du flux dédié dans les billets de l'édition,
**afin que** ces participants n'aient pas de numéro et soient orientés vers l'accueil dédié.

- [ ] La case survit à une réimport des tarifs (cf. [écarts](#écarts-avec-lexistant)).

### US-ARR-03 : Numéroter, générer le PDF, geler

**En tant qu'**admin, **je veux** générer le PDF d'impression des badges, numérotés par guichet,
bac et rang, **afin d'**envoyer un fichier unique à l'imprimeur.

- [ ] Réglages guichets et bacs, capacité affichée, refus si elle est dépassée (RG-ARR-17).
- [ ] Attribution à tour de rôle dans l'ordre d'achat (RG-ARR-16).
- [ ] PDF dans l'ordre des numéros, séparation par bac (RG-ARR-19). Maquette du badge fournie par
      l'équipe.
- [ ] « Envoyer à l'impression » gèle la numérotation, avec confirmation explicite.
- [ ] Après le gel, les numéros sont écrits dans Billetweb (RG-ARR-20), avec un compte rendu des
      échecs.

### US-ARR-04 : Inviter les bénévoles en lot

**En tant qu'**admin, **je veux** coller une liste d'e-mails pour inviter les bénévoles,
**afin de** leur ouvrir un compte `GUEST` avec la permission « arrivées » de l'édition.

- [ ] Adresses déjà inscrites : permission ajoutée, pas d'invitation.
- [ ] Adresses invalides ou en double : signalées, sans bloquer les autres.
- [ ] L'admin voit qui a accepté.

### US-ARR-05 : Scanner un participant

**En tant que** bénévole Scan, **je veux** scanner la confirmation ou chercher le participant par
nom, **afin de** lui annoncer son numéro et son guichet.

- [ ] Caméra ouverte en un geste, utilisable à une main.
- [ ] RG-ARR-30 à RG-ARR-37, charge des guichets comprise.

### US-ARR-06 : Préparer et remettre les badges d'un guichet

**En tant que** bénévole d'un guichet, **je veux** voir arriver les badges de mon guichet dans un
kanban, **afin de** les sortir du bac avant que le participant arrive, puis de les lui remettre.

- [ ] RG-ARR-40 à RG-ARR-46.

### US-ARR-07 : Traiter les cas particuliers au guichet d'aide

**En tant que** bénévole Aide, **je veux** retrouver n'importe quel participant et imprimer son
étiquette, **afin que** personne ne reparte sans badge.

- [ ] RG-ARR-50 à RG-ARR-54.

### US-ARR-08 : Suivre les arrivées

**En tant qu'**admin ou éditeur, **je veux** un écran de suivi en temps réel,
**afin de** déplacer des bénévoles là où la file s'allonge.

- [ ] RG-ARR-62.

### US-ARR-09 : Mode hors ligne (option)

**En tant que** bénévole Scan, **je veux** continuer à scanner pendant une coupure réseau,
**afin que** la file d'attente n'attende pas le réseau. Issue optionnelle.

- [ ] RG-ARR-64 et RG-ARR-65.

---

## Cas limites

| Cas | Comportement |
|---|---|
| Participant sans confirmation | Recherche par nom au Scan (RG-ARR-31), sinon guichet d'aide |
| Billet déjà scanné | Alerte avec l'historique (RG-ARR-34) |
| Billet remboursé ou annulé | « Billet annulé » ; recherche par nom, sinon guichet d'aide |
| Billet ajouté après le gel | Résultat « guichet d'aide » ; l'aide imprime l'étiquette (RG-ARR-51). L'admin relance l'import pour le faire connaître |
| Speaker, staff, bénévole, prestataire | « Accueil dédié » (RG-ARR-33) |
| Badge introuvable dans le bac | La carte reste « À chercher », le participant va au guichet d'aide, qui imprime une étiquette (RG-ARR-52) |
| Carte touchée par erreur | On la retouche (RG-ARR-43) |
| Même carte touchée sur deux écrans | La seconde transition est ignorée (RG-ARR-44) |
| Un guichet sature | Rouge sur les téléphones Scan (RG-ARR-36) ; le suivi aide à y déplacer un bénévole |
| Coupure réseau | Indicateur rouge ; à la reconnexion, état relu (RG-ARR-61). Mode hors ligne si activé |
| Billetweb indisponible au moment du scan | Le scan réussit ; le compostage est retenté (RG-ARR-37) |

---

## Contraintes techniques

- **Temps réel** : Server-Sent Events servis par le backend Fastify, actions en `POST`. La
  diffusion se fait en mémoire, ce qui suppose un seul réplica backend (déjà le cas pour
  `node-cron`) ; au-delà, `LISTEN/NOTIFY` de PostgreSQL. Vérifier que le proxy de Coolify ne
  bufferise pas le flux et ne coupe pas les connexions longues.
- **Lecture des codes** : `BarcodeDetector` n'existe pas sur Safari iOS, il faut une
  bibliothèque (QR et code-barres). La caméra exige HTTPS.
- **Imprimante** : un navigateur n'envoie pas de ZPL seul à une Zebra. Trois voies : Zebra
  Browser Print installé sur le poste de l'aide, imprimante en réseau jointe par le backend, ou
  image imprimée par le pilote (question ouverte).
- **Billetweb** : clé d'API **lecture et écriture** pour `update_product` et `check` (la clé
  actuelle sert à lire). `attendees` est limité à 10 appels par minute.
- **Volumes** : une journée, ~1 500 participants dont ~1 200 par les guichets, pic d'arrivée sur
  la première heure (~25 par minute) ; une quarantaine de bénévoles connectés en même temps.
- **Réseau sur place** : Wi-Fi, 4G et 5G jugés stables, d'où le mode hors ligne en issue
  optionnelle.

## Écarts avec l'existant

- **Les tarifs n'ont pas d'identifiant Billetweb, et leur import les supprime puis les recrée**
  (`tickets.ts`, `deleteMany`). Une case « hors flux » posée sur un tarif serait effacée à la
  réimport suivante, et rien ne relie le `ticket_id` d'un participant à un tarif (RG-ARR-11).
- **L'événement Billetweb n'est pas rattaché à l'édition** : il est choisi à chaque import
  (RG-ARR-10).
- **Aucun temps réel ni service worker** dans le site aujourd'hui.
- **L'inscription n'accepte que `ADMIN_EMAILS` et les invitations sponsor** (`lib/auth.ts`) :
  l'invitation bénévole est un troisième chemin, à construire avec les mêmes garde-fous.

## Découpage

| Ordre | Issue | Contenu | Pourquoi cet ordre |
|---|---|---|---|
| 1 | #637 | Lien édition ↔ événement Billetweb, tarifs avec id Billetweb mis à jour, case « hors flux » | Prérequis de tout le reste |
| 2 | #638 | Import des participants | Prérequis de la numérotation |
| 3 | #639 | Numérotation guichet / bac / rang à tour de rôle, PDF d'impression, gel, écriture dans Billetweb | **Chemin critique** : impression à J-5 |
| 4 | #640 | Rôle `GUEST`, permission « arrivées » par édition, invitations en lot, choix du poste | Indépendant de 2-3 |
| 5 | #641 | Flux temps réel, indicateur de connexion, PWA | Socle des écrans |
| 6 | #642 | Écran Scan : caméra, recherche, guichet et charge des guichets, compostage Billetweb | |
| 7 | #643 | Écran Guichet (kanban) — remplace « Distribution par centaines » et « Badges manuels » | |
| 8 | à créer | Guichet d'aide : recherche, étiquette ZPL, impression sur la Zebra | Dépend de la question sur l'impression |
| 9 | #644 | Écran de suivi par guichet | |
| 10 | #645 | Mode hors ligne | Optionnelle |

## Questions ouvertes

1. **Capacité** : 4 guichets × 3 bacs × 100 = 1 200 badges. Combien de billets restent une fois
   le flux dédié retiré ? Au-delà, un 4ᵉ bac par guichet (RG-ARR-17).
2. **Mobilier** : 3 meubles guichet et 1 meuble bas pour 4 guichets plus l'aide. Le meuble bas
   irait à l'aide, plus accessible en fauteuil.
3. **Impression des étiquettes** : Zebra Browser Print, imprimante en réseau ou pilote ?
4. **Format des étiquettes** : 10 × 10 ou 10 × 15 cm, à mesurer sur le rouleau.
5. **Maquette du badge** : fournie par l'équipe, pas encore disponible. Bloque le rendu du PDF,
   pas la numérotation.
6. **Conservation 18 mois** (RG-ARR-66) : toujours sans réponse explicite.
