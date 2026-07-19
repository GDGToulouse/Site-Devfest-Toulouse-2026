FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY src/backend/package.json src/backend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/backend/ ./

# `prisma generate` loads prisma.config.ts, which resolves DATABASE_URL via
# env(). The client generation never connects, but the config still requires
# the var to be present — pass a throwaway value at build time (the real URL is
# injected at runtime).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate
RUN pnpm build

ARG SEED_SCRIPT=prisma/seed.ts
ENV SEED_SCRIPT=${SEED_SCRIPT}

# Commit this image was built from, surfaced by /api/health so a deploy can be
# told apart from the previous one (the version only moves on releases).
ARG APP_COMMIT=
ENV APP_COMMIT=${APP_COMMIT}

RUN chmod +x scripts/db-boot.sh

# Use the boot script: baseline the init migration if upgrading from
# `prisma db push`, run `prisma migrate deploy`, run the seed, start the server.
CMD ["sh", "scripts/db-boot.sh"]
