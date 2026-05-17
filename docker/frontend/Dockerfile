# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY frontend/package*.json ./

# Install all dependencies
RUN npm ci --ignore-scripts

# Copy frontend source
COPY frontend/ ./

# Build React application (outputs to /app/build)
RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Copy React build output to nginx html directory
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# nginx runs as root by default in the official image; it drops privileges
# to the worker user automatically after binding to port 80
CMD ["nginx", "-g", "daemon off;"]
