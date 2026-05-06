FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run db:generate
RUN pnpm run build

FROM deps AS dev
COPY . .
RUN pnpm run db:generate
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --from=build /app/prisma ./prisma
RUN pnpm run db:generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["pnpm", "run", "start:prod"]
