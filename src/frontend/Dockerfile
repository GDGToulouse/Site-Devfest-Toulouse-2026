FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY src/frontend/package.json src/frontend/pnpm-lock.yaml ./

RUN pnpm install --config.confirmModulesPurge=false

COPY src/frontend/ ./

ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL=${BACKEND_URL}

ARG BASE_URL=http://localhost:3000
ENV BASE_URL=${BASE_URL}

ARG NEXT_PUBLIC_PLAUSIBLE_SRC=
ENV NEXT_PUBLIC_PLAUSIBLE_SRC=${NEXT_PUBLIC_PLAUSIBLE_SRC}

RUN pnpm build

CMD ["pnpm", "start"]
