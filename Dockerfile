FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN apk add --no-cache python3 make g++ && pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm prune --prod

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /app/src/cache/migrations ./dist/cache/migrations
COPY --from=build --chown=nonroot:nonroot /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER nonroot
CMD ["dist/index.js"]
