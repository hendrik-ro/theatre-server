# syntax=docker/dockerfile:1

# Build stage: full install, compile TypeScript, then prune to
# production-only node_modules. bookworm-slim over alpine because argon2
# ships glibc prebuilt binaries; musl would drag a build toolchain in.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Runtime: compiled output, production deps, and the SQL migrations.
# No .env is baked in — the config falls back to process.env, which
# compose injects.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY src/db/migrations ./src/db/migrations
USER node
EXPOSE 3000
# Apply migrations, then start; a failed migration aborts the container.
# exec replaces the shell so node is PID 1 and receives SIGTERM directly
# from podman/docker stop — otherwise the graceful shutdown handlers in
# server.ts never fire and the container gets SIGKILLed at the stop
# timeout.
CMD ["node", "dist/server.js"]
