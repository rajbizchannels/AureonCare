# AureonCare Update Agent
# Polls the release registry for new versions and optionally auto-applies updates
# via docker compose (requires /var/run/docker.sock mounted from the host).

FROM node:18-alpine

# Install docker CLI so the agent can run `docker compose pull/up`
# The actual Docker daemon socket is mounted at runtime.
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy agent source
COPY agent.js ./

# Persistent volume for update status JSON
VOLUME ["/data"]

# Status HTTP endpoint
EXPOSE 8080

# Mount the Docker socket from the host to allow docker compose commands
# docker run -v /var/run/docker.sock:/var/run/docker.sock ...
# In docker-compose.yml this is handled by the volumes: section.

CMD ["node", "agent.js"]
