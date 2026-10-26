# Inscriptions des invités sponsors

**Version** : v1, 26 octobre 2026. Conception validée avec Julien.
**Milestone** : `asap`. Les inscriptions sont fermées par défaut (RG-INS-28) : Arnaud décide
de les ouvrir depuis le back-office, cette année ou la suivante.
**Objectif** : un sponsor inscrit lui-même les personnes qu'il envoie au DevFest, depuis son
espace partenaire, dans la limite de ses places. Aujourd'hui il passe par Billetweb, ce qui
n'est pas pratique pour lui et ne laisse aucun contrôle du quota à l'équipe.
**Indépendance** : cette fonctionnalité ne dépend pas de la gestion des arrivées
(`gestion-arrivees.md`). Les inscrits sont réinjectés dans Billetweb, qui reste la seule
source des billets : les arrivées les y trouvent comme n'importe quel participant.

**Nomenclature** : `RG-INS-xx` pour les règles, `US-INS-xx` pour les user stories. Dizaines :
10 quota, 20 inscription, 30 import CSV, 40 synchronisation Billetweb, 50 données personnelles.

---

## Le parcours

1. **L'équipe vend un pack** : la participation du sponsor reçoit le nombre de places de son
   niveau. Si le sponsor achète des places en plus, un admin ajoute un ajustement.
2. **Le sponsor inscrit ses invités** dans son espace, un par un ou par import CSV, jusqu'à
   l'échéance (vendredi précédant l'événement, 23 h 59). Un compteur montre les places
   restantes et le temps restant.
3. **Un admin synchronise avec Billetweb** quand il le décide. Un aperçu liste les billets à
   créer et les inscrits bloqués parce qu'ils sont hors quota. Billetweb envoie le billet à
   chaque invité créé ; le site garde son numéro et l'inscrit passe en lecture seule. Billetweb
   fait ensuite référence : les corrections se font par le lien du billet.
4. **Après l'échéance**, l'espace sponsor passe en lecture seule. Seul un admin ajoute,
   modifie ou supprime un inscrit.

---

## Règles de gestion

### Quota

| # | Règle |
|---|-------|
| RG-INS-10 | Chaque offre d'une édition (`EditionSponsorTier`) porte un **nombre de places** par défaut. C'est la colonne « Badges » du guide sponsors (8 / 4 / 2 / 1), aussi prévue par #438 : un seul champ pour les deux. Porté par l'offre de l'édition, il ne réécrit pas les éditions passées quand l'offre change l'année suivante (#375). |
| RG-INS-11 | Un admin ajoute des **ajustements** à une participation : une quantité signée (+5, −2), un motif (« places achetées », « geste commercial », « correction ») et un commentaire libre. Chaque ajustement garde son auteur et sa date. |
| RG-INS-12 | **Quota** = places de l'offre + somme des ajustements, jamais en dessous de 0. Changer le niveau de la participation change la base, pas les ajustements. |
| RG-INS-13 | Les inscrits d'une participation sont classés par date d'inscription, puis par id. Ceux dont le rang dépasse le quota sont **hors quota**. La validité est **calculée**, jamais stockée : remonter le quota rend les derniers valides sans autre action. |
| RG-INS-14 | Un sponsor ne peut pas créer d'inscrit au-delà de son quota. Le contrôle se fait dans la même transaction que l'écriture, pour que deux ajouts simultanés ne dépassent pas le quota. Un inscrit hors quota peut quand même apparaître : baisse du quota, ajout par un admin, ou bug. C'est pourquoi la validité est recalculée partout où elle compte (RG-INS-13), sans jamais supposer que le contrôle à la saisie a suffi. |
| RG-INS-15 | Un inscrit hors quota **n'est pas créé dans Billetweb** et n'a pas de billet. Il est signalé en alerte dans l'admin (liste des inscrits, fiche du sponsor) et dans l'aperçu de synchronisation. Le sponsor le voit marqué « hors quota » dans son espace. |

### Inscription

| # | Règle |
|---|-------|
| RG-INS-20 | Champs d'un inscrit, tous obligatoires sauf indication :<br>• **Nom**, **Prénom**, **E-mail** ;<br>• **Genre** : Femme / Homme / Non spécifié ;<br>• **Expérience professionnelle** : Étudiant / Moins de 3 ans / Entre 3 et 7 ans / Plus de 7 ans ;<br>• **Je participe à l'after (à partir de 18 h)** : case à cocher, décochée par défaut ;<br>• **Régime alimentaire** : Pas de régime particulier (défaut) / Végétarien / Végan / Autre (précisé par mail) ;<br>• **Assistance particulière pendant l'événement (précisée par mail)** : case à cocher, décochée par défaut. |
| RG-INS-28 | **Ouverture** : les inscriptions sponsors sont **fermées par défaut** sur chaque édition. Un admin les ouvre dans les informations de l'édition, et peut les refermer. Fermées, l'espace sponsor n'affiche pas la section des inscrits tant qu'elles n'ont jamais été ouvertes, et la montre en lecture seule si elles l'ont été. L'admin, lui, gère les inscrits que les inscriptions soient ouvertes ou non. |
| RG-INS-21 | **Échéance** : réglage de l'édition, éditable dans ses informations. Par défaut, le vendredi qui précède la date de début de l'édition, 23 h 59, heure de Paris. L'espace sponsor affiche un compte à rebours. |
| RG-INS-22 | Inscriptions ouvertes (RG-INS-28) et avant l'échéance, les contacts `RESPONSABLE` et `EDITEUR` ajoutent, modifient et suppriment les inscrits de leur sponsor ; `STAND` les consulte. Après l'échéance, ou inscriptions refermées, tout est en lecture seule côté sponsor. Un admin peut toujours ajouter, modifier et supprimer, y compris au-delà du quota (l'inscrit est alors hors quota, RG-INS-15). |
| RG-INS-27 | Un inscrit **synchronisé** porte le **numéro de son billet Billetweb**, enregistré au moment de la création du billet. Dès lors il est en **lecture seule** dans le site : le sponsor ne peut plus le modifier ni le supprimer, même avant l'échéance. Une indication explique que toute modification se fait par le lien en pied de page de l'e-mail du billet Billetweb. Il compte toujours dans le quota. |
| RG-INS-23 | Inscrire quelqu'un ne lui donne aucun accès. Depuis un inscrit, un bouton « Donner accès à l'espace partenaire » crée un contact du sponsor et lui envoie l'invitation existante (#362), avec le rôle choisi (`STAND` proposé par défaut). |
| RG-INS-24 | Un même e-mail inscrit chez **deux sponsors** donne deux inscrits, sans alerte. |
| RG-INS-25 | Un même e-mail inscrit **deux fois chez le même sponsor** est accepté, avec une alerte : la personne ne recevra pas correctement ses billets et les consignes, envoyés à une seule adresse. L'alerte s'affiche à la saisie, à l'import et dans l'admin. |
| RG-INS-26 | Supprimer un inscrit libère sa place. Seul un inscrit sans numéro de billet se supprime librement (RG-INS-27). Pour un inscrit synchronisé, un admin peut **annuler le billet** : la commande est supprimée dans Billetweb (RG-INS-45), puis l'inscrit, ce qui libère la place. Pas de corbeille : la trace reste dans l'historique (`AuditLog`). |

### Import CSV

| # | Règle |
|---|-------|
| RG-INS-30 | Un **modèle CSV** se télécharge depuis l'espace sponsor et l'admin : en UTF-8 avec BOM et séparateur `;`, ce qui s'ouvre directement dans un Excel français. Une ligne d'en-têtes en français, une ligne d'exemple, et les valeurs autorisées rappelées dans l'en-tête de chaque colonne à liste. |
| RG-INS-31 | L'import accepte le séparateur `;` ou `,` (détecté sur la ligne d'en-têtes), les valeurs entre guillemets ou non, et l'encodage UTF-8 (avec ou sans BOM) ou Windows-1252 : un fichier qui n'est pas de l'UTF-8 valide est lu en Windows-1252. |
| RG-INS-32 | Les valeurs à liste s'acceptent sans tenir compte de la casse ni des accents (« vegan », « Végan ») ; une case à cocher accepte oui/non, o/n, x/vide, 1/0, true/false. Une colonne inconnue est ignorée, une colonne obligatoire manquante refuse le fichier. |
| RG-INS-33 | L'import se fait en deux temps : un **aperçu**, avec le compte rendu ligne par ligne (erreurs, alertes de doublon RG-INS-25), puis une confirmation. Une ligne en erreur bloque tout le lot. |
| RG-INS-34 | Un lot qui dépasse les places restantes est **refusé en entier**, avec le nombre de lignes en trop. Côté admin, il passe avec un avertissement : les lignes en trop sont hors quota. |
| RG-INS-35 | L'import ajoute des inscrits, il ne modifie ni ne supprime les existants. |

### Synchronisation Billetweb

| # | Règle |
|---|-------|
| RG-INS-40 | Un admin lance la synchronisation, pour tous les sponsors de l'édition ou pour un seul. Rien ne part sans action d'un admin. Elle se relance **autant de fois** que voulu : chaque passage ne crée de billet que pour les inscrits valides **sans numéro de billet**, y compris ceux en erreur au passage précédent. Un inscrit qui a un numéro n'est jamais renvoyé. |
| RG-INS-41 | La synchronisation commence par un **aperçu** : billets à créer, bloqués hors quota (RG-INS-15), en erreur lors du dernier passage, et inscrits synchronisés devenus hors quota. L'admin confirme. |
| RG-INS-42 | **Création** : une commande Billetweb **par inscrit** (`POST /api/event/{id}/add_order`), pour qu'il puisse être annulé seul. Tarif choisi pour les sponsors (RG-INS-47), `payment_type: invitation`, `ship: 1` (Billetweb envoie le billet). Les attributs de RG-INS-20 vont dans les champs de formulaire Billetweb correspondants, et le nom du sponsor dans le champ « Entreprise », que lisent aussi les arrivées. |
| RG-INS-43 | **Origine** : chaque commande porte la marque du site. `request_id` et `reference` du billet valent `site-sponsor-<id de l'inscrit>`, et un champ de commande « Origine » vaut « Site — <nom du sponsor> ». L'admin Billetweb filtre ainsi les inscriptions du site. |
| RG-INS-44 | **Après la création, Billetweb fait référence** : l'impression des badges et les comptes du traiteur partent de ses données, pas du site. Le site n'écrit plus jamais sur un billet existant ; les corrections se font dans Billetweb, par le participant (lien de son billet) ou par l'équipe. |
| RG-INS-45 | **Annulation** (`delete_order`, réservé aux commandes hors ligne, ce que sont les nôtres) : action d'un admin sur un inscrit synchronisé, avec confirmation explicite, puisque la personne a déjà reçu son billet. Un inscrit synchronisé devenu hors quota n'est **pas** annulé d'office : il est signalé, et l'admin choisit d'annuler son billet ou de remonter le quota. |
| RG-INS-46 | Chaque inscrit garde : les ids Billetweb de la commande et du billet (le numéro de billet), la date de création du billet, et la dernière erreur s'il y en a eu une. Une erreur sur un inscrit n'arrête pas les autres. |
| RG-INS-48 | **Relecture pour le sponsor** : chaque synchronisation relit aussi dans Billetweb les billets déjà créés (`GET /api/event/{id}/attendees`, incrémental par `last_update`, un appel par passage) et recopie dans le site ce que le participant a corrigé, pour que le sponsor voie des informations à jour. Un billet annulé dans Billetweb est signalé à l'admin. La relecture n'écrit jamais dans Billetweb. |
| RG-INS-49 | **Rattacher un billet existant** : un admin rattache à un sponsor un billet déjà présent dans Billetweb, par son numéro (cas d'une personne inscrite directement dans Billetweb). Le site lit le billet, crée l'inscrit avec ses informations et son numéro, donc en lecture seule (RG-INS-27). Il compte dans le quota ; s'il le dépasse, il est rattaché quand même et signalé hors quota. Un billet ne se rattache qu'une fois, à un seul sponsor. |
| RG-INS-47 | L'événement Billetweb de l'édition, le **tarif dans lequel inscrire les sponsors** et la correspondance des champs de formulaire se règlent une fois par édition dans l'admin des billets. Le tarif se choisit dans la liste des tarifs de l'événement (`GET /api/event/{id}/tickets`) ; un tarif nommé « Sponsors » est proposé par défaut, c'est celui qui sert aujourd'hui. Sans tarif choisi, la synchronisation refuse de partir et le dit. Si #637 a déjà lié l'édition à son événement, ce lien sert ; sinon, ce réglage le crée et #637 le reprendra. |

### Données personnelles

| # | Règle |
|---|-------|
| RG-INS-50 | Le formulaire et l'import rappellent au sponsor qu'il saisit les données de tiers, à quoi elles servent (billet, accueil, restauration, statistiques anonymes de l'édition), et qu'il doit en informer les personnes. |
| RG-INS-51 | Genre et expérience ne servent qu'à des statistiques agrégées. L'assistance particulière et le régime « Autre » ne portent aucun détail : les précisions passent par mail. |
| RG-INS-52 | La politique de confidentialité mentionne ces données et leur durée de conservation, la même que celle des participants (RG-ARR-66, encore ouverte). |

---

## User stories

### US-INS-01 : Régler les places d'un sponsor
**En tant qu'**admin, **je veux** voir et ajuster le quota de places d'un sponsor, **afin de**
tenir compte des places achetées en plus.
- [ ] Places par défaut sur chaque offre de l'édition (RG-INS-10).
- [ ] Ajustements avec motif, auteur et date (RG-INS-11, RG-INS-12).
- [ ] La fiche affiche le quota, le nombre d'inscrits et les hors quota (RG-INS-13, RG-INS-15).
- [ ] Échéance éditable dans les informations de l'édition (RG-INS-21).
- [ ] Ouverture des inscriptions, fermées par défaut, dans les informations de l'édition (RG-INS-28).

### US-INS-02 : Inscrire mes invités
**En tant que** contact sponsor, **je veux** inscrire les personnes que j'envoie,
**afin qu'**elles reçoivent leur billet sans passer par Billetweb.
- [ ] Compteur de places et compte à rebours jusqu'à l'échéance.
- [ ] RG-INS-20, RG-INS-22, RG-INS-24 à RG-INS-27 ; mention RG-INS-50.
- [ ] Un inscrit synchronisé est verrouillé, avec l'indication du lien Billetweb (RG-INS-27).
- [ ] Inscrits hors quota signalés ; état du billet visible (envoyé ou pas encore).

### US-INS-03 : Importer un lot
**En tant que** contact sponsor ou admin, **je veux** importer mes invités depuis un fichier,
**afin de** ne pas les saisir un par un.
- [ ] RG-INS-30 à RG-INS-35.

### US-INS-04 : Suivre et compléter les inscriptions
**En tant qu'**admin, **je veux** voir tous les inscrits de l'édition, **afin de** repérer les
problèmes et compléter après l'échéance.
- [ ] Liste filtrable par sponsor, hors quota, doublons, état de synchronisation.
- [ ] Ajout, modification et suppression à tout moment (RG-INS-22).
- [ ] Rattacher un billet Billetweb existant à un sponsor par son numéro (RG-INS-49).
- [ ] Pas d'export traiteur ni badges : Billetweb fait référence (RG-INS-44).

### US-INS-05 : Envoyer les inscriptions dans Billetweb
**En tant qu'**admin, **je veux** synchroniser les inscrits avec Billetweb, **afin qu'**ils
aient un billet et apparaissent avec les autres participants.
- [ ] RG-INS-40 à RG-INS-47.

### US-INS-06 : Donner accès à l'espace partenaire
**En tant que** contact `RESPONSABLE`, **je veux** donner accès à l'espace à l'un de mes
inscrits, **afin qu'**il gère lui-même la suite.
- [ ] RG-INS-23.

---

## Cas limites

| Cas | Comportement |
|---|---|
| Quota baissé sous le nombre d'inscrits | Les derniers inscrits passent hors quota ; alerte admin. Ceux sans billet n'en recevront pas ; ceux qui en ont un restent signalés jusqu'à ce que l'admin annule leur billet ou remonte le quota (RG-INS-45) |
| Personne inscrite directement dans Billetweb pour un sponsor | Un admin rattache son billet au sponsor par son numéro (RG-INS-49) |
| Même billet rattaché deux fois | Refusé (RG-INS-49) |
| Quota remonté | Les hors quota redeviennent valides et partent à la synchronisation suivante |
| Sponsor qui change de niveau | La base suit la nouvelle offre, les ajustements restent |
| Inscrit supprimé puis ressaisi (avant synchronisation) | Nouvel inscrit, nouvelle place en fin de classement |
| Le sponsor veut corriger un inscrit déjà synchronisé | Verrouillé côté sponsor ; le participant corrige par le lien de son billet, ou le sponsor demande à un admin (RG-INS-27) |
| Le sponsor veut remplacer un inscrit synchronisé par un collègue | Il demande à un admin, qui supprime l'inscrit (billet annulé à la synchronisation suivante) et libère la place |
| Synchronisation lancée deux fois de suite | Le second passage ne trouve rien à faire, sauf les erreurs du premier (RG-INS-40) |
| Participant qui corrige son nom dans Billetweb | Repris dans le site au passage suivant, pour le sponsor (RG-INS-48) |
| Billetweb indisponible ou en erreur | Inscrit en erreur, les autres continuent ; relance au passage suivant |
| Commande supprimée à la main dans Billetweb | Signalée à la relecture (RG-INS-48) ; l'admin retire l'inscrit ou efface son numéro pour qu'un nouveau billet soit créé |
| Personne déjà détentrice d'un billet payant | Rien ne le détecte : deux billets. Hors scope |
| Fichier Excel enregistré en CSV « Windows » | Lu en Windows-1252, accents préservés (RG-INS-31) |

## Contraintes techniques

- **API Billetweb** (spec OpenAPI `https://www.billetweb.fr/api/openapi.json`) : `add_order`
  (100 commandes par appel, commandes simples uniquement), `delete_order` (commandes hors
  ligne), `GET /api/event/{id}/attendees` (relecture, rattachement). Clé **lecture et
  écriture**, la même que demande #639. La limite de 10 appels par minute ne vise que les
  fonctions `attendees`.
- **Champs de formulaire** : déjà présents dans Billetweb, cf. [Formulaire Billetweb
  existant](#formulaire-billetweb-existant).
- **Dates** : échéance stockée en UTC, saisie et affichée en heure de Paris (`lib/zoned-time.ts`).
- **CSV** : détection d'encodage par décodage UTF-8 strict (`TextDecoder` avec `fatal: true`),
  repli en `windows-1252`.

## Écarts avec l'existant

- **Aucun nombre de places** n'existe sur les offres : #438 le prévoit sans l'avoir livré.
- **L'événement Billetweb n'est pas rattaché à l'édition** : il est choisi à chaque import de
  tarifs (`routes/admin/tickets.ts`). Même écart que pour les arrivées (#637).
- **La clé Billetweb actuelle ne sert qu'à lire.**
- **L'invitation de contact sponsor** (#362) existe déjà et sert telle quelle au bouton
  RG-INS-23.

## Découpage

| Ordre | Issue | Contenu | Dépend de |
|---|---|---|---|
| 1 | Modèle, quota et échéance | `SponsorGuest`, places par offre, ajustements, validité calculée, échéance de l'édition ; écran admin du quota | — |
| 2 | Espace sponsor : inscrits | Liste, saisie, compteur, compte à rebours, lecture seule, alertes, mention données personnelles | 1 |
| 3 | Import CSV | Modèle, détection séparateur et encodage, aperçu, contrôle du quota | 2 |
| 4 | Admin : vue consolidée | Liste de l'édition, filtres, alertes, ajout après échéance | 1 |
| 5 | Synchronisation Billetweb | Réglages de l'édition, aperçu, création des billets, numéro, origine, annulation, relecture | 1 |
| 6 | Rattacher un billet existant | Rattachement par numéro de billet (RG-INS-49) | 5 |
| 7 | Donner accès depuis un inscrit | Bouton, reprise de l'invitation #362 | 2 |

2, 4 et 5 avancent en parallèle une fois 1 livrée.

## Formulaire Billetweb existant

Les cinq questions existent déjà dans le formulaire de billet Billetweb. Un export de
participant les rend ainsi (`custom`, clés = libellés) :

```json
"custom": {
  "J'ai besoin d'une assistance particulière pendant l'événement ?": "",
  "Je participe à l'after (à partir de 18h00)": "1",
  "Je souhaite un régime particulier": "",
  "Expérience professionnelle": "Sup à 7 ans",
  "Genre": "Homme"
}
```

- Une case à cocher vaut `"1"` cochée, `""` sinon ; un régime vide veut dire « pas de régime
  particulier ».
- Les valeurs envoyées doivent être **exactement** les libellés d'options de Billetweb
  (« Sup à 7 ans », pas « Plus de 7 ans ») : les listes du site en gardent la correspondance,
  le libellé affiché au sponsor pouvant différer.
- `add_order` attend les **ids** des champs, pas leurs libellés : la synchronisation les
  résout par `GET /api/fields` (ou `GET /api/event/{id}/forms`, `ticket_fields`) en
  cherchant ces libellés, et refuse de partir si l'un d'eux manque. Les libellés exacts des
  options (Genre, Expérience, Régime) se lisent au même endroit.

## Décisions

Tranché le 26/10 : aucune inscription sponsor n'existe aujourd'hui dans Billetweb, rien à
reprendre ; le billet Billetweb contient bien un lien de modification pour le participant ;
les contacts `STAND` ont la lecture seule ; les cinq questions existent dans Billetweb.
Milestone `asap` : la fonctionnalité est développée pour 2026, et Arnaud décide de l'activer
depuis le back-office (RG-INS-28).
