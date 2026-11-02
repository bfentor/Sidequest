# The web app's image, which Coolify builds and runs on the server
# (DEPLOYMENT.md). Build context: the repository root.

# --- Export the Expo web build ---
FROM node:24-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/web-server/package.json apps/web-server/
COPY packages/api/package.json packages/api/
RUN npm ci

COPY apps/app apps/app
COPY packages/api packages/api

# Public values are inlined into the bundle, so they're needed at build time.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN cd apps/app && npx expo export --platform web

# --- Serve it ---
FROM node:24-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/web-server/package.json apps/web-server/
COPY packages/api/package.json packages/api/
# Only the server's own dependencies (express, expo-server), at their locked versions.
RUN npm ci --omit=dev --workspace @sidequest/web-server --include-workspace-root=false --ignore-scripts \
    && npm cache clean --force

COPY apps/web-server/server.js apps/web-server/
COPY --from=build /repo/apps/app/dist apps/app/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s \
    CMD node -e "fetch('http://localhost:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/web-server/server.js"]
