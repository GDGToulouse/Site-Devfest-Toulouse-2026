FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY src/backend/package.json src/backend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/backend/ ./
COPY prisma/ ./prisma/

RUN pnpm exec prisma generate --schema prisma/schema.prisma
RUN pnpm build

ARG SEED_SCRIPT=prisma/seed.ts
ENV SEED_SCRIPT=${SEED_SCRIPT}

CMD ["sh", "-c", "pnpm exec prisma db push --schema prisma/schema.prisma && pnpm exec tsx prisma/seed.ts && node dist/index.js"]
