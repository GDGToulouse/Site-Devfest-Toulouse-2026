FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY src/backend/package.json src/backend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/backend/ ./
COPY prisma/ ./prisma/

RUN pnpm exec prisma generate --schema prisma/schema.prisma

CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema prisma/schema.prisma && pnpm exec tsx prisma/seed.ts && pnpm dev"]
