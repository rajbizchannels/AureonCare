# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching. The backend has no package.json of
# its own — its dependencies are declared in the repository-root manifest — so these come
# from the root. (This used to copy backend/package*.json, which does not exist, and
# `npm ci` failed with no manifest to install from.)
COPY package.json package-lock.json ./

# Production dependencies only: the runtime stage copies this node_modules as-is, and the
# backend has no build step that needs the devDependencies (nodemon).
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime

# Install wget for HEALTHCHECK
RUN apk add --no-cache wget

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY backend/ ./

# Create upload and log directories
RUN mkdir -p /app/uploads /app/logs \
    && chown -R node:node /app

# Run as non-root user
USER node

# Expose backend port
EXPOSE 3000

# Health check via wget against the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
