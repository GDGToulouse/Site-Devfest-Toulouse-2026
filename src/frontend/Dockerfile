FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY src/frontend/package.json src/frontend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/frontend/ ./

CMD ["pnpm", "dev"]
