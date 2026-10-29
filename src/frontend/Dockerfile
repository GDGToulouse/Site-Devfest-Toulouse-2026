# Pinned by digest (#679): the tag moves under us. Dependabot bumps it.
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY src/frontend/package.json src/frontend/pnpm-lock.yaml ./

# Exactly the lockfile the CI tested: without --frozen-lockfile, pnpm would
# resolve and rewrite a stale one and ship untested versions (#658).
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

COPY src/frontend/ ./

ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL=${BACKEND_URL}

ARG BASE_URL=http://localhost:3000
ENV BASE_URL=${BASE_URL}

ARG NEXT_PUBLIC_PLAUSIBLE_SRC=
ENV NEXT_PUBLIC_PLAUSIBLE_SRC=${NEXT_PUBLIC_PLAUSIBLE_SRC}

RUN pnpm build

CMD ["pnpm", "start"]
