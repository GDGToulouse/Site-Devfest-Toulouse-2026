#!/bin/sh
# Sauvegarde la base d'un environnement avant une mise en production.
#
# À lancer sur le VPS, avant tout déploiement portant une migration Prisma :
# le backend joue les migrations au démarrage, donc sans dump préalable une
# migration destructrice est irrécupérable.
#
#   sudo sh scripts/backup-prod-db.sh              # prod (par défaut)
#   sudo sh scripts/backup-prod-db.sh beta         # un autre environnement
#   BACKUP_DIR=/mnt/x sudo -E sh scripts/backup-prod-db.sh
#
# Le conteneur est identifié par son `BASE_URL`, jamais par le hash Coolify :
# celui-ci change à chaque redéploiement, et se tromper de conteneur revient à
# sauvegarder la bêta en croyant sauvegarder la prod.

set -e

ENV_NAME="${1:-prod}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"

case "$ENV_NAME" in
  prod) WANTED_URL="https://devfesttoulouse.fr" ;;
  beta) WANTED_URL="https://beta.site.devfesttoulouse.fr" ;;
  dev-j) WANTED_URL="https://dev-j.site.devfesttoulouse.fr" ;;
  *)
    echo "Environnement inconnu : $ENV_NAME (attendu : prod, beta, dev-j)" >&2
    exit 1
    ;;
esac

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo — l'accès au démon Docker et à $BACKUP_DIR l'exige." >&2
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
DUMP="$BACKUP_DIR/$ENV_NAME-$STAMP.sql"

mkdir -p "$BACKUP_DIR"
echo "Environnement : $ENV_NAME ($WANTED_URL)"
echo "Conteneur     : $DB"
echo "Destination   : $DUMP"

# La redirection est faite ici, dans le shell déjà root : la sortir du sudo est
# l'erreur classique, elle échoue en « Permission denied » sur /root.
docker exec "$DB" pg_dump -U devfest -d devfest --no-owner --no-privileges > "$DUMP"

# Un dump tronqué pèse lourd et ne vaut rien : seul le marqueur de fin le dit.
# pg_dump 17.6+ ajoute une ligne `\unrestrict` après lui, d'où le grep plutôt
# qu'un test sur la dernière ligne.
if ! grep -q "PostgreSQL database dump complete" "$DUMP"; then
  echo "ÉCHEC : dump incomplet, marqueur de fin absent. NE PAS DÉPLOYER." >&2
  echo "Fichier conservé pour analyse : $DUMP" >&2
  exit 1
fi

echo
ls -lh "$DUMP"
echo "Dump complet. Restauration en cas de retour arrière :"
echo "  docker exec -i $DB psql -U devfest -d devfest < $DUMP"
