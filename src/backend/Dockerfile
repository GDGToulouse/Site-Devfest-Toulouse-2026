FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY src/backend/package.json src/backend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/backend/ ./
COPY prisma/ ./prisma/

RUN pnpm exec prisma generate --schema prisma/schema.prisma
RUN pnpm build

ARG SEED_SCRIPT=prisma/seed.ts
ENV SEED_SCRIPT=${SEED_SCRIPT}

RUN chmod +x scripts/db-boot.sh

# Use the boot script: baseline the init migration if upgrading from
# `prisma db push`, run `prisma migrate deploy`, run the seed, start the server.
CMD ["sh", "scripts/db-boot.sh"]
