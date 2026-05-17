#!/usr/bin/env bash
###############################################################################
# AureonCare On-Premises Installer
# Installs AureonCare using Docker Compose on a single server.
#
# Usage: bash install.sh [--auto] [--skip-pull]
#   --auto        Non-interactive mode — reads all config from environment
#                 variables prefixed with AUREON_ (see below).
#   --skip-pull   Skip docker compose pull (useful for air-gapped installs
#                 that have images pre-loaded via `docker load`).
#
# Non-interactive env vars:
#   AUREON_DB_PASSWORD      PostgreSQL password (required in --auto mode)
#   AUREON_CLINIC_NAME      Clinic display name (default: AureonCare Clinic)
#   AUREON_BACKEND_URL      Backend URL, e.g. https://app.clinic.com
#   AUREON_FRONTEND_URL     Frontend URL, e.g. https://app.clinic.com
#   AUREON_SMTP_HOST        SMTP host (optional)
#   AUREON_SMTP_PORT        SMTP port (optional, default: 587)
#   AUREON_SMTP_USER        SMTP username (optional)
#   AUREON_SMTP_PASS        SMTP password (optional)
#   AUREON_FROM_EMAIL       From address for system emails (optional)
#   AUREON_REDIS            "true" to enable Redis session store (default: false)
#   AUREON_INSTALL_DIR      Install directory (default: /opt/aureoncare)
###############################################################################
set -euo pipefail

# ── Constants ─────────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly DEFAULT_INSTALL_DIR="/opt/aureoncare"
readonly MIN_DOCKER_VERSION="20.10"
readonly MIN_COMPOSE_VERSION="2.0"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Flags ─────────────────────────────────────────────────────────────────────
AUTO_MODE=false
SKIP_PULL=false

for arg in "$@"; do
  case "$arg" in
    --auto)      AUTO_MODE=true ;;
    --skip-pull) SKIP_PULL=true ;;
    --help|-h)
      grep '^#' "$0" | head -40 | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
fatal()   { error "$*"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local default="${3:-}"
  local secret="${4:-false}"

  if [[ "$AUTO_MODE" == "true" ]]; then
    # In auto mode the value must already be in the environment
    if [[ -z "${!var_name:-}" && -z "$default" ]]; then
      fatal "Auto mode: required variable $var_name is not set"
    fi
    printf '%s' "${!var_name:-$default}"
    return
  fi

  local full_prompt="$prompt_text"
  [[ -n "$default" ]] && full_prompt+=" [${default}]"
  full_prompt+=": "

  if [[ "$secret" == "true" ]]; then
    read -r -s -p "$full_prompt" value
    echo >&2
  else
    read -r -p "$full_prompt" value
  fi

  printf '%s' "${value:-$default}"
}

version_gte() {
  # Returns 0 if $1 >= $2 (semver comparison)
  printf '%s\n%s' "$2" "$1" | sort -V -C
}

# ── Step 1: Check prerequisites ───────────────────────────────────────────────
section "Checking Prerequisites"

check_docker() {
  if ! command -v docker &>/dev/null; then
    fatal "Docker is not installed. Install from https://docs.docker.com/engine/install/"
  fi
  local version
  version=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  if ! version_gte "$version" "$MIN_DOCKER_VERSION"; then
    fatal "Docker $MIN_DOCKER_VERSION+ required (found $version)"
  fi
  success "Docker $version found"
}

check_compose() {
  if docker compose version &>/dev/null; then
    local version
    version=$(docker compose version --short 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
    success "Docker Compose v2 ($version) found"
  elif command -v docker-compose &>/dev/null; then
    local version
    version=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if ! version_gte "$version" "$MIN_COMPOSE_VERSION"; then
      fatal "Docker Compose $MIN_COMPOSE_VERSION+ required (found $version)"
    fi
    success "docker-compose $version found"
  else
    fatal "Docker Compose is not installed. Install from https://docs.docker.com/compose/install/"
  fi
}

check_openssl() {
  if ! command -v openssl &>/dev/null; then
    fatal "openssl is required but not installed. Install with: apt-get install openssl / yum install openssl"
  fi
  success "openssl found"
}

check_docker
check_compose
check_openssl

# Check we can talk to Docker daemon
if ! docker info &>/dev/null; then
  fatal "Cannot connect to Docker daemon. Is the Docker service running? Try: sudo systemctl start docker"
fi
success "Docker daemon is reachable"

# ── Step 2: Set install directory ─────────────────────────────────────────────
section "Installation Directory"

INSTALL_DIR="${AUREON_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
if [[ "$AUTO_MODE" == "false" ]]; then
  INSTALL_DIR=$(prompt INSTALL_DIR "Install directory" "$INSTALL_DIR")
fi

if [[ -d "$INSTALL_DIR" ]]; then
  warn "Directory $INSTALL_DIR already exists — upgrading existing installation"
else
  info "Creating install directory: $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
fi

# Copy compose file and Docker configs to install dir
cp "$REPO_ROOT/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
cp -r "$REPO_ROOT/docker" "$INSTALL_DIR/docker"
cp -r "$REPO_ROOT/update-agent" "$INSTALL_DIR/update-agent"

cd "$INSTALL_DIR"
success "Install directory ready: $INSTALL_DIR"

# ── Step 3: Collect configuration ─────────────────────────────────────────────
section "Configuration"

info "Generating cryptographic secrets..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
success "JWT secret and encryption key generated"

# Postgres password
DB_PASSWORD=$(prompt AUREON_DB_PASSWORD "PostgreSQL password" "" "true")
[[ -z "$DB_PASSWORD" ]] && fatal "Database password cannot be empty"

# Clinic name
CLINIC_NAME=$(prompt AUREON_CLINIC_NAME "Clinic name" "AureonCare Clinic")

# Backend/Frontend URLs
BACKEND_URL=$(prompt AUREON_BACKEND_URL "Backend URL (e.g. https://app.myclinic.com)" "http://localhost")
FRONTEND_URL=$(prompt AUREON_FRONTEND_URL "Frontend URL (e.g. https://app.myclinic.com)" "http://localhost")

# Email configuration (optional)
SMTP_HOST=$(prompt AUREON_SMTP_HOST "SMTP host (leave blank to skip)" "")
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
FROM_EMAIL=""
if [[ -n "$SMTP_HOST" ]]; then
  SMTP_PORT=$(prompt AUREON_SMTP_PORT "SMTP port" "587")
  SMTP_USER=$(prompt AUREON_SMTP_USER "SMTP username" "")
  SMTP_PASS=$(prompt AUREON_SMTP_PASS "SMTP password" "" "true")
  FROM_EMAIL=$(prompt AUREON_FROM_EMAIL "From email address" "noreply@aureoncare.com")
fi

# Redis
USE_REDIS=$(prompt AUREON_REDIS "Enable Redis session store? (true/false)" "false")

# ── Step 4: Write .env file ───────────────────────────────────────────────────
section "Writing Configuration"

ENV_FILE="$INSTALL_DIR/.env"

cat > "$ENV_FILE" <<EOF
###############################################################################
# AureonCare — Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Edit this file to update configuration, then run: docker compose up -d
###############################################################################

# ── PostgreSQL ────────────────────────────────────────────────────────────────
POSTGRES_DB=aureoncare
POSTGRES_USER=aureoncare
POSTGRES_PASSWORD=${DB_PASSWORD}

# ── Application ───────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
AC_CLN=${CLINIC_NAME}
AC_BE_URL=${BACKEND_URL}
AC_FE_URL=${FRONTEND_URL}

# ── Security ──────────────────────────────────────────────────────────────────
AC_TK_S=${JWT_SECRET}
AC_TK_E=24h
AC_EK=${ENCRYPTION_KEY}

# ── Database ──────────────────────────────────────────────────────────────────
AC_DB_H=postgres
AC_DB_P=5432
AC_DB_N=aureoncare
AC_DB_U=aureoncare
AC_DB_W=${DB_PASSWORD}
AC_DB_S=false

# ── Redis ─────────────────────────────────────────────────────────────────────
AC_USE_RD=${USE_REDIS}
AC_RD_H=redis
AC_RD_P=6379
REDIS_PASSWORD=$(openssl rand -hex 16)

# ── File Uploads ──────────────────────────────────────────────────────────────
AC_UPL_DIR=/app/uploads
AC_UPL_MAX=10485760

# ── Logging ───────────────────────────────────────────────────────────────────
AC_LOG_LVL=info
AC_LOG_DIR=/app/logs

EOF

# Append email config if provided
if [[ -n "$SMTP_HOST" ]]; then
cat >> "$ENV_FILE" <<EOF
# ── Email ─────────────────────────────────────────────────────────────────────
AC_SM_H=${SMTP_HOST}
AC_SM_P=${SMTP_PORT}
AC_SM_U=${SMTP_USER}
AC_SM_W=${SMTP_PASS}
AC_FROM_EM=${FROM_EMAIL}
EOF
fi

cat >> "$ENV_FILE" <<EOF
# ── Update Agent ──────────────────────────────────────────────────────────────
AUREONCARE_VERSION=1.0.0
RELEASE_REGISTRY_URL=https://api.github.com/repos/aureoncare/aureoncare/releases/latest
UPDATE_CHECK_INTERVAL_HOURS=24
AUTO_APPLY=false
# SUBSCRIPTION_KEY=your-subscription-key-here
# NOTIFY_WEBHOOK_URL=https://hooks.slack.com/services/...
EOF

# Secure the .env file — it contains secrets
chmod 600 "$ENV_FILE"
success ".env file written to $ENV_FILE (permissions: 600)"

# Also write a backend-specific env copy for env_file directive
mkdir -p "$INSTALL_DIR/backend"
cp "$ENV_FILE" "$INSTALL_DIR/backend/.env"
chmod 600 "$INSTALL_DIR/backend/.env"
success "backend/.env written"

# ── Step 5: Pull or build images ──────────────────────────────────────────────
section "Docker Images"

if [[ "$SKIP_PULL" == "true" ]]; then
  info "Skipping image pull (--skip-pull flag set)"
  info "Building images locally from source..."
  docker compose build
  success "Images built successfully"
else
  info "Pulling latest AureonCare images..."
  if docker compose pull 2>/dev/null; then
    success "Images pulled from registry"
  else
    warn "Could not pull from registry — building images locally"
    docker compose build
    success "Images built from local source"
  fi
fi

# ── Step 6: Start services ────────────────────────────────────────────────────
section "Starting Services"

if [[ "$USE_REDIS" == "true" ]]; then
  info "Starting services with Redis profile..."
  docker compose --profile redis up -d
else
  info "Starting services..."
  docker compose up -d
fi
success "Services started"

# ── Step 7: Wait for services to be healthy ───────────────────────────────────
section "Health Check"

info "Waiting for PostgreSQL to be ready..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until docker compose exec -T postgres pg_isready -U aureoncare -d aureoncare &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    fatal "PostgreSQL did not become ready after ${MAX_ATTEMPTS} attempts. Check logs: docker compose logs postgres"
  fi
  info "  Waiting for PostgreSQL ($ATTEMPTS/$MAX_ATTEMPTS)..."
  sleep 3
done
success "PostgreSQL is ready"

info "Waiting for backend to be healthy..."
ATTEMPTS=0
until docker compose exec -T backend wget --quiet --spider http://localhost:3000/health &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
    fatal "Backend did not become healthy after ${MAX_ATTEMPTS} attempts. Check logs: docker compose logs backend"
  fi
  info "  Waiting for backend ($ATTEMPTS/$MAX_ATTEMPTS)..."
  sleep 3
done
success "Backend is healthy"

# ── Step 8: Run database migrations ──────────────────────────────────────────
section "Database Migrations"

info "Running database migrations..."
if docker compose exec -T backend node run_migrations.js; then
  success "Migrations completed successfully"
else
  warn "Migration command failed — trying alternative path (run-migrations.js)"
  if docker compose exec -T backend node run-migrations.js; then
    success "Migrations completed successfully"
  else
    error "Migrations failed. You can run them manually with:"
    error "  cd $INSTALL_DIR && docker compose exec backend node run_migrations.js"
  fi
fi

# ── Step 9: Verify frontend ───────────────────────────────────────────────────
section "Final Verification"

info "Verifying frontend is reachable..."
if curl --silent --fail --max-time 10 http://localhost:80/ > /dev/null 2>&1; then
  success "Frontend is responding on port 80"
else
  warn "Frontend health check on port 80 failed — it may still be starting up"
  warn "Check status with: docker compose ps"
fi

# ── Success banner ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  AureonCare installation complete!${RESET}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Application:    ${CYAN}${FRONTEND_URL}${RESET}"
echo -e "  Backend API:    ${CYAN}${BACKEND_URL}/api${RESET}"
echo -e "  Health check:   ${CYAN}${BACKEND_URL}/health${RESET}"
echo -e "  Update agent:   ${CYAN}http://localhost:8080/status${RESET}"
echo ""
echo -e "  Install dir:    ${INSTALL_DIR}"
echo -e "  Config file:    ${INSTALL_DIR}/.env"
echo ""
echo -e "${BOLD}Useful commands:${RESET}"
echo -e "  View logs:      cd ${INSTALL_DIR} && docker compose logs -f"
echo -e "  Check status:   cd ${INSTALL_DIR} && docker compose ps"
echo -e "  Stop:           cd ${INSTALL_DIR} && docker compose down"
echo -e "  Restart:        cd ${INSTALL_DIR} && docker compose restart"
echo -e "  Backup DB:      cd ${INSTALL_DIR} && docker compose exec postgres pg_dump -U aureoncare aureoncare > backup.sql"
echo ""
echo -e "${YELLOW}${BOLD}Security reminders:${RESET}"
echo -e "  - The .env file contains secrets. Keep it safe: chmod 600 ${INSTALL_DIR}/.env"
echo -e "  - Set up TLS/HTTPS via your reverse proxy (nginx, Caddy, Traefik)"
echo -e "  - Configure firewall rules to restrict port 5432 (PostgreSQL)"
echo -e "  - Set SUBSCRIPTION_KEY in .env to activate update notifications"
echo ""
