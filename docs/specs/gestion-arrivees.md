# Gestion des arrivées — badges et accueil

**Échéance** : 19 novembre 2026 (jour du DevFest). Les badges partent à l'impression **5 jours
avant** (14 novembre) : la numérotation et le PDF d'impression sont sur le chemin critique.
**Milestone** : `asap-arrivees`.
**Objectif** : à l'arrivée, le participant reçoit son badge imprimé à l'avance sans attendre qu'un
bénévole le cherche dans 1 500 badges.

**Prérequis** : import des tarifs Billetweb (`src/backend/src/routes/admin/tickets.ts`).

---

## Table des matières

1. [Organisation sur place](#organisation-sur-place)
2. [Règles de gestion](#règles-de-gestion)
3. [User stories](#user-stories)
4. [Cas limites](#cas-limites)
5. [Contraintes techniques](#contraintes-techniques)
6. [Écarts avec l'existant](#écarts-avec-lexistant)
7. [Découpage proposé](#découpage-proposé)
8. [Questions ouvertes](#questions-ouvertes)

---

## Organisation sur place

Les badges sont imprimés à l'avance, numérotés de 0 à ~1 500 dans l'ordre d'impression, et
rangés dans cet ordre, par centaines. Le participant arrive avec sa confirmation Billetweb
(imprimée ou sur téléphone), qui porte un QR code et un code-barres de **même valeur** : le
`barcode` Billetweb, distinct du numéro de badge.

| Étape | Qui | Action | État du badge |
|---|---|---|---|
| 1. Scan | Bénévole **Scan**, dans la file | Scanne la confirmation, ou cherche le participant par nom / prénom. L'appli affiche le n° de badge, le prénom, le nom et l'entreprise ; le bénévole annonce le n° | `SCANNÉ` |
| 2. Prise | Bénévole **Distribution**, devant ses centaines | Voit apparaître en direct les n° de ses centaines, en prend un | `PRIS` (par lui) |
| 3. Pose | Le même | Pose le badge sur la borne de sa centaine et valide | `DISTRIBUÉ` |
| — | Comptoir | Vérifie que le participant prend **son** badge. N'utilise pas l'appli | — |

Les flux qui ne passent pas par les centaines : **flux dédié** (speakers, staff, bénévoles,
prestataires — catégorie de badge dédiée) et **billets ajoutés après l'impression** (badge écrit
à la main par un bénévole **Badges manuels**, qui a son propre écran). La vente s'arrête à
l'impression ; des billets s'ajoutent encore à la main dans Billetweb jusqu'au jour J, de façon
ponctuelle.

---

## Règles de gestion

### Participants et numérotation

| # | Règle |
|---|-------|
| RG-597 | Une édition se **lie** à un événement Billetweb. Une fois lié, l'import des tarifs et des participants met à jour l'existant au lieu de l'écraser. L'admin peut **défaire** le lien (erreur d'événement, changement d'événement) ; défaire le lien ne supprime ni tarifs ni participants. |
| RG-598 | Un tarif garde son identifiant Billetweb. La réimport met à jour les tarifs connus, crée les nouveaux, et ne touche pas aux réglages propres au site (dont la case « hors flux »). |
| RG-600 | Les participants d'une édition sont importés depuis l'événement Billetweb lié (`GET /api/event/{id}/attendees`). L'import se relance à la demande par un admin et est incrémental (`last_update`). Les billets remboursés ou annulés (`disabled`) sont exclus. |
| RG-601 | Pour chaque participant, on conserve : id du billet, `barcode`, prénom, nom, e-mail, entreprise (champ perso Billetweb), tarif (`ticket_id`), catégorie, date et id de commande. L'e-mail ne s'affiche sur aucun écran d'accueil ; il sert à informer les participants de l'édition suivante. |
| RG-602 | Le n° de badge est attribué par le back-office dans l'**ordre d'impression** du PDF des badges, qui est l'**ordre d'achat** (date de commande, puis commande, puis billet) : les billets d'une même commande — souvent des collègues — se suivent et sont servis ensemble. Les participants du flux dédié n'ont pas de numéro. |
| RG-603 | L'envoi à l'impression (J-5) **gèle** la numérotation : un numéro attribué ne change plus jamais. Un import après le gel ajoute les nouveaux participants **sans numéro** (badge à écrire à la main) et ne renumérote rien. |
| RG-604 | Après le gel, le n° de badge est écrit dans le champ perso de billet Billetweb **« Numéro de badge »** (`POST /api/event/{id}/update_product`), pour trace. Le champ est créé dans Billetweb au moment de traiter l'issue, masqué au participant ; son id se lit par `GET /api/fields`. |
| RG-605 | Le flux dédié se reconnaît au tarif : les tarifs « hors flux » se cochent dans le back-office des billets de l'édition. |

### Accès et rôles

| # | Règle |
|---|-------|
| RG-610 | Un rôle `GUEST` s'ajoute à `ADMIN`, `EDITOR` et `SPONSOR`. Il ne donne accès qu'aux informations publiques. |
| RG-611 | La permission « gestion des arrivées » est attribuée par un admin, **par édition** : elle tombe d'elle-même pour l'édition suivante. Elle s'ajoute au rôle, quel qu'il soit. |
| RG-612 | Les bénévoles reçoivent un compte à l'avance, en `GUEST`, par **invitations en lot** (une quarantaine d'adresses collées d'un coup). Une invitation peut porter directement la permission « arrivées » de l'édition en cours. |
| RG-613 | Un compte invité est créé avec `role = GUEST` **explicite** et `emailVerified = true` à l'acceptation. Jamais la valeur par défaut `EDITOR` (#362), et jamais `emailVerified = false`, qui ferait effacer son mot de passe par le premier lien magique (better-auth 1.7, cf. `auth.md`). |
| RG-614 | À l'ouverture de la zone « Gestion des arrivées », le porteur de la permission se déclare **Scan**, **Distribution** ou **Badges manuels**. Il peut changer de rôle à tout moment. |
| RG-615 | L'écran de suivi est réservé à `ADMIN` et `EDITOR`. |

### Scan

| # | Règle |
|---|-------|
| RG-620 | Le scan lit le QR code et le code-barres (même valeur). Une saisie manuelle du code reste possible. |
| RG-621 | La recherche par nom et/ou prénom est disponible sur le même écran, pour qui vient sans confirmation. Elle interroge le backend. |
| RG-622 | Le résultat affiche en grand le n° de badge, et le prénom, le nom et l'entreprise pour vérifier l'identité. |
| RG-623 | Trois résultats se distinguent visuellement, d'un coup d'œil : badge numéroté (n° et centaine) ; **flux dédié** (« Accueil dédié ») ; **sans numéro**, vendu après le gel (« Badge à écrire à la main »). |
| RG-624 | Un billet déjà scanné déclenche une **alerte**, sans blocage : heure du premier scan, bénévole, état actuel du badge. |
| RG-625 | Un code inconnu affiche une erreur claire et propose la recherche par nom. |
| RG-626 | Le scan composte le billet dans Billetweb (`POST /api/event/{id}/check`, `lane` = nom du bénévole). Un échec de compostage ne bloque pas l'accueil : il est retenté plus tard. |

### Distribution

| # | Règle |
|---|-------|
| RG-630 | Le distributeur choisit librement ses centaines (grille 0 à 15) et en change à tout moment. |
| RG-631 | Il voit, en temps réel et sans action de sa part, les badges `SCANNÉ` de ses centaines, du plus ancien au plus récent. Une vibration ou un son signale un nouveau badge. |
| RG-632 | « Prendre » un badge est atomique côté serveur : deux distributeurs ne peuvent pas prendre le même. Le perdant voit le badge disparaître de sa liste. |
| RG-633 | Le distributeur valide la pose sur la borne : le badge passe `DISTRIBUÉ`. |
| RG-634 | Il peut **relâcher** un badge qu'il a pris (badge introuvable, interruption) : le badge revient en `SCANNÉ`, en tête de file. |
| RG-635 | Un admin peut ramener n'importe quel badge à l'étape précédente. |
| RG-636 | Une centaine que personne ne couvre est signalée sur la grille ; ses badges scannés restent visibles par tous les distributeurs. |

### Badges manuels

| # | Règle |
|---|-------|
| RG-637 | Le bénévole Badges manuels voit en temps réel les participants **sans numéro** scannés, avec prénom, nom et entreprise à recopier sur le badge. |
| RG-638 | Il valide « badge créé et remis » : le participant passe `DISTRIBUÉ`. Prise, relâche et correction admin suivent RG-632 à RG-635. |

### Temps réel, suivi, cache

| # | Règle |
|---|-------|
| RG-640 | Les écrans Scan, Distribution et Suivi se mettent à jour en temps réel, sans rafraîchir. Un indicateur permanent montre l'état de la connexion au flux : connecté, reconnexion en cours, déconnecté. |
| RG-641 | À chaque reconnexion, l'écran relit l'état complet : aucune mise à jour perdue pendant une coupure. |
| RG-642 | L'écran de suivi montre en temps réel : participants attendus, scannés, distribués, en attente (`SCANNÉ` + `PRIS`), répartis par centaine ; flux dédié et sans-numéro à part. |
| RG-643 | L'application (pages, scripts, styles, lecteur de codes) est mise en cache sur le téléphone et s'installe sur l'écran d'accueil. |
| RG-644 | **Mode hors ligne** (issue optionnelle, le réseau sur place étant jugé stable) : le téléphone Scan précharge la table code → n° de badge et le statut de flux, et met ses scans en file d'attente locale pendant une coupure. La recherche par nom reste en ligne. |
| RG-645 | En mode hors ligne, aucune donnée personnelle n'est stockée sur le téléphone : la table préchargée est indexée par une empreinte du code, et effacée à la fin de l'événement. |
| RG-646 | Les données des participants sont conservées **18 mois** après l'événement, pour informer les participants de l'édition suivante, puis supprimées. La politique de confidentialité le mentionne. |

---

## User stories

### US-600 : Importer les participants

**En tant qu'**admin, **je veux** importer les participants de l'édition depuis Billetweb,
**afin de** préparer la numérotation et l'accueil.

- [ ] Import depuis l'événement Billetweb lié à l'édition ; relance incrémentale, y compris
      jusqu'au jour J pour les billets ajoutés à la main après le gel.
- [ ] Compte rendu : nouveaux, mis à jour, retirés (remboursés), sans numéro après le gel.
- [ ] Un import ne touche jamais un numéro attribué (RG-603).

### US-601 : Marquer les tarifs hors flux

**En tant qu'**admin, **je veux** cocher les tarifs du flux dédié dans les billets de l'édition,
**afin que** ces participants n'aient pas de numéro et soient orientés vers l'accueil dédié.

- [ ] La case survit à une réimport des tarifs (cf. [écarts](#écarts-avec-lexistant)).

### US-602 : Numéroter, générer le PDF, geler

**En tant qu'**admin, **je veux** générer le PDF d'impression des badges, numérotés dans l'ordre d'impression,
**afin d'**envoyer un fichier unique à l'imprimeur.

- [ ] Maquette du badge fournie par l'équipe (pas encore disponible).
- [ ] Ordre d'achat (RG-602).
- [ ] « Envoyer à l'impression » gèle la numérotation, avec confirmation explicite.
- [ ] Après le gel, les numéros sont écrits dans Billetweb (RG-604), avec un compte rendu des échecs.
- [ ] Un PDF complémentaire pour les badges sans numéro reste possible.

### US-603 : Inviter les bénévoles en lot

**En tant qu'**admin, **je veux** coller une liste d'e-mails pour inviter les bénévoles,
**afin de** leur ouvrir un compte `GUEST` avec la permission « arrivées » de l'édition.

- [ ] Adresses déjà inscrites : permission ajoutée, pas d'invitation.
- [ ] Adresses invalides ou en double : signalées, sans bloquer les autres.
- [ ] L'admin voit qui a accepté.

### US-604 : Scanner un participant

**En tant que** bénévole Scan, **je veux** scanner la confirmation ou chercher le participant par nom,
**afin de** lui annoncer son n° de badge.

- [ ] Caméra ouverte en un geste, utilisable à une main.
- [ ] Résultats RG-622 à RG-625.

### US-605 : Distribuer les badges

**En tant que** bénévole Distribution, **je veux** voir arriver les badges de mes centaines et les prendre,
**afin de** les poser sur la borne au moment où le participant arrive.

- [ ] RG-630 à RG-636.

### US-608 : Écrire les badges sans numéro

**En tant que** bénévole Badges manuels, **je veux** voir arriver les participants sans badge imprimé,
**afin d'**écrire leur badge et de dire qu'il est remis.

- [ ] RG-637 et RG-638.

### US-606 : Suivre les arrivées

**En tant qu'**admin ou éditeur, **je veux** un écran de suivi en temps réel,
**afin de** déplacer des bénévoles là où la file s'allonge.

- [ ] RG-642, lisible sur un grand écran.

### US-607 : Mode hors ligne (option)

**En tant que** bénévole Scan, **je veux** continuer à scanner pendant une coupure réseau,
**afin que** la file d'attente n'attende pas le réseau. Issue optionnelle.

- [ ] RG-644 et RG-645.

---

## Cas limites

| Cas | Comportement |
|---|---|
| Participant sans confirmation | Recherche par nom / prénom (RG-621) |
| Billet déjà scanné | Alerte avec l'historique (RG-624) |
| Billet remboursé ou annulé | Traité comme inconnu, avec la mention « billet annulé » |
| Billet ajouté après le gel | « Badge à écrire à la main » (RG-623), vers le bénévole Badges manuels (RG-637). L'admin relance l'import pour le faire connaître |
| Speaker, staff, bénévole, prestataire | « Accueil dédié » (RG-623) |
| Badge introuvable dans le bac | Le distributeur le relâche (RG-634) ; l'admin peut le traiter à part |
| Deux distributeurs prennent le même badge | Un seul gagne (RG-632) |
| Coupure réseau | Indicateur rouge ; à la reconnexion, état relu (RG-641). Mode hors ligne si activé |
| Billetweb indisponible au moment du scan | Le scan réussit ; le compostage est retenté (RG-626) |

---

## Contraintes techniques

- **Temps réel** : Server-Sent Events servis par le backend Fastify, actions en `POST`. La
  diffusion se fait en mémoire, ce qui suppose un seul réplica backend (déjà le cas pour
  `node-cron`) ; au-delà, `LISTEN/NOTIFY` de PostgreSQL. Vérifier que le proxy de Coolify ne
  bufferise pas le flux et ne coupe pas les connexions longues.
- **Lecture des codes** : `BarcodeDetector` n'existe pas sur Safari iOS, il faut une
  bibliothèque (QR et code-barres). La caméra exige HTTPS.
- **Billetweb** : clé d'API **lecture et écriture** pour `update_product` et `check` (la clé
  actuelle sert à lire). `attendees` est limité à 10 appels par minute.
- **Volumes** : une journée, ~1 500 participants, pic d'arrivée sur la première heure ;
  une quarantaine de bénévoles connectés en même temps.
- **Réseau sur place** : Wi-Fi, 4G et 5G jugés stables, d'où le mode hors ligne en issue optionnelle.

## Écarts avec l'existant

- **Les tarifs n'ont pas d'identifiant Billetweb, et leur import les supprime puis les recrée**
  (`tickets.ts`, `deleteMany`). Une case « hors flux » posée sur un tarif serait effacée à la
  réimport suivante, et rien ne relie le `ticket_id` d'un participant à un tarif (RG-598).
- **L'événement Billetweb n'est pas rattaché à l'édition** : il est choisi à chaque import
  (RG-597).
- **Aucun temps réel ni service worker** dans le site aujourd'hui.
- **L'inscription n'accepte que `ADMIN_EMAILS` et les invitations sponsor** (`lib/auth.ts`) :
  l'invitation bénévole est un troisième chemin, à construire avec les mêmes garde-fous.

## Découpage proposé

| Ordre | Issue | Pourquoi cet ordre |
|---|---|---|
| 1 | Lien édition ↔ événement Billetweb, tarifs avec id Billetweb mis à jour, case « hors flux » | Prérequis de tout le reste |
| 2 | Import des participants | Prérequis de la numérotation |
| 3 | Numérotation, PDF d'impression des badges, gel, écriture dans Billetweb | **Chemin critique** : impression à J-5 |
| 4 | Rôle `GUEST`, permission « arrivées » par édition, invitations en lot | Indépendant de 2-3 |
| 5 | Flux temps réel, indicateur de connexion, PWA | Socle des écrans |
| 6 | Écran Scan (caméra, recherche, compostage Billetweb) | |
| 7 | Écrans Distribution et Badges manuels | |
| 8 | Écran de suivi | |
| 9 | Mode hors ligne | Optionnelle |

## Questions ouvertes

1. **Maquette du badge** : fournie par l'équipe, pas encore disponible. Bloque le rendu du PDF,
   pas la numérotation.
