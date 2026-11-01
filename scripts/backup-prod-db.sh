#!/bin/sh
# Sauvegarde chiffrée de la base d'un environnement (#678).
#
# À lancer sur le VPS, avant tout déploiement portant une migration Prisma (le
# backend joue les migrations au démarrage : sans dump préalable, une migration
# destructrice est irrécupérable), et chaque nuit par cron.
#
#   sudo devfest-backup                       # prod (par défaut)
#   sudo devfest-backup prod avant-v1.13.0    # étiquette dans le nom du fichier
#   sudo devfest-backup beta                  # un autre environnement
#
# Installation, clés, restauration : docs/mise-en-production.md, « Sauvegardes ».
#
# Le dump est chiffré par age pour la clé publique de BACKUP_AGE_RECIPIENTS :
# le VPS ne garde jamais de dump en clair. Sont conservés les BACKUP_KEEP
# derniers dumps de l'environnement ; avec BACKUP_RCLONE_REMOTE, chaque dump est
# copié hors du VPS et ceux de plus de BACKUP_REMOTE_KEEP_DAYS jours y sont
# supprimés.
#
# Le conteneur est identifié par son `BASE_URL`, jamais par le hash Coolify :
# celui-ci change à chaque redéploiement, et se tromper de conteneur revient à
# sauvegarder la bêta en croyant sauvegarder la prod.

set -eu

# Rien de ce que ce script écrit n'est lisible par un autre compte que root.
umask 077

CONFIG=/etc/devfest-backup.conf
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

ENV_NAME="${1:-prod}"
LABEL="${2:-}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
BACKUP_AGE_RECIPIENTS="${BACKUP_AGE_RECIPIENTS:-/etc/devfest-backup.recipients}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
BACKUP_REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-90}"

case "$ENV_NAME" in
  prod) WANTED_URL="https://devfesttoulouse.fr" ;;
  beta) WANTED_URL="https://beta.site.devfesttoulouse.fr" ;;
  dev-j) WANTED_URL="https://dev-j.site.devfesttoulouse.fr" ;;
  *)
    echo "Environnement inconnu : $ENV_NAME (attendu : prod, beta, dev-j)" >&2
    exit 1
    ;;
esac

case "$LABEL" in
  *[!A-Za-z0-9.-]*)
    echo "Étiquette refusée : $LABEL (lettres, chiffres, point et tiret seulement)" >&2
    exit 1
    ;;
esac

case "$BACKUP_KEEP" in
  ''|*[!0-9]*|0)
    echo "BACKUP_KEEP doit être un entier positif (reçu : $BACKUP_KEEP)" >&2
    exit 1
    ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo — l'accès au démon Docker et à $BACKUP_DIR l'exige." >&2
  exit 1
fi

if ! command -v age >/dev/null 2>&1; then
  echo "age est absent : sudo apt install age" >&2
  exit 1
fi

# Sans clé publique, on refuse plutôt que d'écrire un dump en clair.
if [ ! -s "$BACKUP_AGE_RECIPIENTS" ]; then
  echo "Clé publique age absente : $BACKUP_AGE_RECIPIENTS" >&2
  echo "Voir docs/mise-en-production.md, « Sauvegardes »." >&2
  exit 1
fi

if [ -n "$BACKUP_RCLONE_REMOTE" ] && ! command -v rclone >/dev/null 2>&1; then
  echo "BACKUP_RCLONE_REMOTE est défini mais rclone est absent : sudo apt install rclone" >&2
  exit 1
fi

# On lit BASE_URL sur le conteneur backend (le conteneur db ne le porte pas
# toujours), puis on retrouve le db du même projet compose.
PROJECT=""
for container in $(docker ps --format '{{.Names}}' | grep '^backend-'); do
  url=$(docker exec "$container" printenv BASE_URL 2>/dev/null || true)
  if [ "$url" = "$WANTED_URL" ]; then
    PROJECT=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
    break
  fi
done

if [ -z "$PROJECT" ]; then
  echo "Aucun backend ne porte BASE_URL=$WANTED_URL." >&2
  echo "Environnements visibles :" >&2
  for container in $(docker ps --format '{{.Names}}' | grep '^backend-'); do
    echo "  $container -> $(docker exec "$container" printenv BASE_URL 2>/dev/null || echo '?')" >&2
  done
  exit 1
fi

DB=$(docker ps --format '{{.Names}}' \
  --filter "label=com.docker.compose.project=$PROJECT" | grep '^db-' | head -1)

if [ -z "$DB" ]; then
  echo "Projet $PROJECT trouvé, mais aucun conteneur db dedans." >&2
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
NAME="$ENV_NAME-$STAMP${LABEL:+-$LABEL}.sql"
PLAIN="$BACKUP_DIR/.$NAME.partial"
DUMP="$BACKUP_DIR/$NAME.age"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
# Le clair ne vit que le temps de vérifier le marqueur de fin, et part même sur
# une erreur ou un Ctrl-C.
trap 'rm -f "$PLAIN"' EXIT INT TERM

echo "Environnement : $ENV_NAME ($WANTED_URL)"
echo "Conteneur     : $DB"
echo "Destination   : $DUMP"

# La redirection est faite ici, dans le shell déjà root : la sortir du sudo est
# l'erreur classique, elle échoue en « Permission denied » sur /root.
docker exec "$DB" pg_dump -U devfest -d devfest --no-owner --no-privileges > "$PLAIN"

# Un dump tronqué pèse lourd et ne vaut rien : seul le marqueur de fin le dit.
# pg_dump 17.6+ ajoute une ligne `\unrestrict` après lui, d'où le grep plutôt
# qu'un test sur la dernière ligne.
if ! grep -q "PostgreSQL database dump complete" "$PLAIN"; then
  echo "ÉCHEC : dump incomplet, marqueur de fin absent. NE PAS DÉPLOYER." >&2
  exit 1
fi

age -R "$BACKUP_AGE_RECIPIENTS" -o "$DUMP" "$PLAIN"
rm -f "$PLAIN"

# Rotation locale : les plus récents d'abord, tout ce qui dépasse BACKUP_KEEP
# part. Le motif ne vise que cet environnement.
ls -1t "$BACKUP_DIR"/"$ENV_NAME"-*.sql.age 2>/dev/null \
  | tail -n +"$((BACKUP_KEEP + 1))" \
  | while read -r old; do
      rm -f "$old"
      echo "Rotation      : $old supprimé"
    done

echo
ls -lh "$DUMP"
echo "Dump complet et chiffré. Restauration en cas de retour arrière (phrase de passe de la clé) :"
echo "  age -d -i /root/.config/devfest-backup/identity.age $DUMP | docker exec -i $DB psql -U devfest -d devfest"

if [ -n "$BACKUP_RCLONE_REMOTE" ]; then
  # Une copie distante ratée ne rend pas le dump local faux : il reste utilisable
  # pour un retour arrière. Le code de sortie 2 la signale quand même au cron.
  if rclone copy "$DUMP" "$BACKUP_RCLONE_REMOTE"; then
    echo "Copie hors VPS : $BACKUP_RCLONE_REMOTE"
    rclone delete "$BACKUP_RCLONE_REMOTE" --min-age "${BACKUP_REMOTE_KEEP_DAYS}d" \
      --include "$ENV_NAME-*.sql.age" \
      || echo "AVERTISSEMENT : rotation distante en échec" >&2
  else
    echo "AVERTISSEMENT : copie hors VPS en échec ; le dump local est bon." >&2
    exit 2
  fi
else
  echo "AVERTISSEMENT : pas de copie hors VPS (BACKUP_RCLONE_REMOTE vide)." >&2
fi
