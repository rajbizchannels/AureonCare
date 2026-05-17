# AureonCare Deployment Guide

AureonCare supports three deployment models:

| Model | Who manages infra | How to deploy |
|-------|-------------------|---------------|
| **On-Premises** | Customer, on their own hardware | Docker Compose + `install.sh` |
| **Customer Cloud** | Customer, on their own AWS/Azure/GCP | Helm chart |
| **SaaS** | AureonCare vendor (internal) | ArgoCD GitOps |

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [On-Premises Deployment](#2-on-premises-deployment)
3. [SaaS Deployment (Vendor Internal)](#3-saas-deployment-vendor-internal)
4. [Hosted on Customer Cloud](#4-hosted-on-customer-cloud)
5. [Version Management and Update Policy](#5-version-management-and-update-policy)
6. [Environment Variables Reference](#6-environment-variables-reference)

---

## 1. Prerequisites

### All deployment models

| Tool | Minimum version | Install |
|------|----------------|---------|
| Git | 2.30+ | `apt-get install git` |
| openssl | 1.1+ | `apt-get install openssl` |

### On-Premises (Docker Compose)

| Tool | Minimum version | Install |
|------|----------------|---------|
| Docker Engine | 20.10+ | https://docs.docker.com/engine/install/ |
| Docker Compose v2 | 2.0+ | bundled with Docker Desktop or `apt-get install docker-compose-plugin` |

### Kubernetes deployments (Customer Cloud + SaaS)

| Tool | Minimum version | Install |
|------|----------------|---------|
| kubectl | 1.25+ | https://kubernetes.io/docs/tasks/tools/ |
| Helm | 3.12+ | https://helm.sh/docs/intro/install/ |
| K8s cluster | 1.25+ | EKS, AKS, GKE, k3s, RKE2 |

### SaaS (vendor) additional tools

| Tool | Purpose |
|------|---------|
| ArgoCD 2.8+ | GitOps continuous deployment |
| cert-manager | Automatic TLS certificate management |
| External Secrets Operator | Sync secrets from AWS Secrets Manager / Vault |
| NGINX Ingress Controller | HTTP load balancing |
| External PostgreSQL | AWS RDS, Google Cloud SQL, or Azure Database |

---

## 2. On-Premises Deployment

On-premises deployment runs AureonCare on a single Linux server using Docker Compose.

### Hardware recommendations

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB | 200 GB SSD |
| OS | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |

### 2.1 Automated install (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/aureoncare/aureoncare.git
cd aureoncare

# 2. Run the installer (interactive)
bash deployment/onprem/install.sh

# 3. The installer will:
#    - Verify Docker and docker compose are installed
#    - Generate cryptographic secrets (JWT key, encryption key)
#    - Prompt for: DB password, clinic name, URLs, SMTP config
#    - Write backend/.env with all configuration
#    - Build or pull Docker images
#    - Start all services
#    - Run database migrations
#    - Print the access URL
```

For automated/CI installs, use environment variables:

```bash
export AUREON_DB_PASSWORD="$(openssl rand -hex 20)"
export AUREON_CLINIC_NAME="Riverside Medical Center"
export AUREON_BACKEND_URL="https://app.riverside-medical.com"
export AUREON_FRONTEND_URL="https://app.riverside-medical.com"
export AUREON_SMTP_HOST="smtp.sendgrid.net"
export AUREON_SMTP_USER="apikey"
export AUREON_SMTP_PASS="SG.your-sendgrid-api-key"
export AUREON_FROM_EMAIL="noreply@riverside-medical.com"

bash deployment/onprem/install.sh --auto
```

### 2.2 Manual step-by-step install

```bash
# 1. Clone the repository
git clone https://github.com/aureoncare/aureoncare.git
cd aureoncare

# 2. Copy the example env file and edit it
cp backend/.env.example backend/.env
nano backend/.env
```

Required values to set in `backend/.env`:

```bash
# Generate secrets
export JWT_SECRET=$(openssl rand -hex 32)
export ENC_KEY=$(openssl rand -hex 16)
export DB_PASS=$(openssl rand -hex 20)

# Set in backend/.env:
AC_TK_S=$JWT_SECRET          # JWT signing secret
AC_EK=$ENC_KEY               # Field-level encryption key
AC_DB_W=$DB_PASS             # PostgreSQL password
POSTGRES_PASSWORD=$DB_PASS   # Must match AC_DB_W

AC_CLN="Your Clinic Name"
AC_BE_URL=https://your-domain.com
AC_FE_URL=https://your-domain.com
```

```bash
# 3. Start services
docker compose up -d

# With Redis session store:
docker compose --profile redis up -d

# 4. Run migrations
docker compose exec backend node run_migrations.js

# 5. Verify services are running
docker compose ps
docker compose logs -f backend
```

### 2.3 Environment variables for on-premises

See [Section 6](#6-environment-variables-reference) for the full reference.

The minimum required variables for on-premises deployment are:

| Variable | Description |
|----------|-------------|
| `AC_TK_S` | JWT signing secret — generate with `openssl rand -hex 32` |
| `AC_EK` | Encryption key — generate with `openssl rand -hex 16` |
| `AC_DB_W` | PostgreSQL password |
| `POSTGRES_PASSWORD` | Must equal `AC_DB_W` |
| `AC_CLN` | Clinic display name |
| `AC_BE_URL` | Backend public URL |
| `AC_FE_URL` | Frontend public URL |

### 2.4 Running migrations

Migrations are SQL files in `backend/migrations/` and are idempotent (safe to re-run).

```bash
# Run all pending migrations
docker compose exec backend node run_migrations.js

# Check migration status (examine logs)
docker compose logs backend | grep -i migration
```

### 2.5 Verifying the installation

```bash
# Check all services are running
docker compose ps

# Check backend health endpoint
curl http://localhost:3000/health

# Check frontend
curl -I http://localhost:80

# Check update agent status
curl http://localhost:8080/status
```

Expected output from `/health`:
```json
{"status": "ok", "timestamp": "2024-01-15T10:30:00Z"}
```

### 2.6 Updating with the subscription model

AureonCare includes an **update agent** that runs as a Docker service and automatically monitors for new releases.

**How it works:**

1. The update agent polls `RELEASE_REGISTRY_URL` (GitHub Releases API) every `CHECK_INTERVAL_HOURS` hours
2. It compares the latest published version against `CURRENT_VERSION` using semver
3. If a newer version is available:
   - It logs `"Update available: vX.Y.Z"`
   - If `NOTIFY_WEBHOOK_URL` is set, it POSTs a JSON notification
   - If `AUTO_APPLY=true`, it runs `docker compose pull && docker compose up -d`

**Check current update status:**

```bash
curl http://localhost:8080/status | jq .
# {
#   "currentVersion": "1.2.0",
#   "latestVersion": "1.3.0",
#   "updateAvailable": true,
#   "lastChecked": "2024-01-15T10:00:00Z",
#   "subscriptionActive": true
# }
```

**Enable Slack/webhook notifications:**

```bash
# Edit backend/.env
NOTIFY_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...

# Restart the update agent
docker compose restart update-agent
```

**Enable auto-update:**

```bash
# Edit backend/.env (or the root .env)
AUTO_APPLY=true

# Restart the update agent
docker compose restart update-agent
```

**Trigger a manual update check:**

```bash
# Restart the agent to trigger an immediate check
docker compose restart update-agent

# Or view the check log
docker compose logs update-agent
```

**Manually update without auto-apply:**

```bash
cd /opt/aureoncare   # or your install directory

# Pull latest images
docker compose pull

# Restart with new images (zero-downtime for stateless services)
docker compose up -d

# Run any new migrations
docker compose exec backend node run_migrations.js
```

**Set your subscription key** (required to access private release channels):

```bash
# Edit .env
SUBSCRIPTION_KEY=your-subscription-key-from-aureoncare

# Restart update agent
docker compose restart update-agent
```

### 2.7 Backup and restore

**Backup the database:**

```bash
# Full database backup
docker compose exec postgres pg_dump \
  -U aureoncare \
  -d aureoncare \
  --format=custom \
  --file=/tmp/aureoncare-backup-$(date +%Y%m%d).dump

# Copy backup out of container
docker compose cp postgres:/tmp/aureoncare-backup-$(date +%Y%m%d).dump ./backups/

# Or pipe directly to host
docker compose exec -T postgres pg_dump \
  -U aureoncare \
  -d aureoncare \
  > ./backups/aureoncare-$(date +%Y%m%d-%H%M%S).sql
```

**Backup uploaded files:**

```bash
# Uploads are stored in the Docker volume "uploads-data"
docker run --rm \
  -v aureoncare_uploads-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

**Restore the database:**

```bash
# Stop the backend first to prevent connections
docker compose stop backend

# Restore
docker compose exec -T postgres psql -U aureoncare -d aureoncare < ./backups/aureoncare-20240115.sql

# Or restore from custom format dump
docker compose exec postgres pg_restore \
  -U aureoncare \
  -d aureoncare \
  --clean \
  /tmp/aureoncare-backup-20240115.dump

# Restart backend
docker compose start backend
```

**Automating backups with cron:**

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * cd /opt/aureoncare && docker compose exec -T postgres pg_dump -U aureoncare aureoncare > /var/backups/aureoncare/db-$(date +\%Y\%m\%d).sql

# Weekly cleanup — keep 30 days
0 3 * * 0 find /var/backups/aureoncare -name "db-*.sql" -mtime +30 -delete
```

### 2.8 Upgrading versions manually

When not using the auto-update feature:

```bash
cd /opt/aureoncare

# 1. Pull the specific version
AUREONCARE_VERSION=1.5.0

# If using pre-built images from registry:
docker compose pull

# 2. Update CURRENT_VERSION in .env
sed -i "s/^AUREONCARE_VERSION=.*/AUREONCARE_VERSION=${AUREONCARE_VERSION}/" .env

# 3. Restart services
docker compose up -d

# 4. Run new migrations
docker compose exec backend node run_migrations.js

# 5. Verify
curl http://localhost:3000/health
```

---

## 3. SaaS Deployment (Vendor Internal)

This section is for AureonCare engineering and DevOps teams managing the multi-tenant SaaS fleet.

### 3.1 Prerequisites

```bash
# Verify tools
kubectl version --client
helm version
argocd version

# Cluster requirements
kubectl get nodes   # Ensure >= 1.25

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Install External Secrets Operator (sync secrets from AWS/Vault/GCP)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system --create-namespace

# Create the target namespace
kubectl create namespace aureoncare-saas
```

### 3.2 Pre-deploy secrets setup

Secrets must exist in the `aureoncare-saas` namespace before ArgoCD deploys the Helm chart. Use External Secrets Operator to sync from AWS Secrets Manager:

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: aureoncare-saas-secrets
  namespace: aureoncare-saas
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: aureoncare-release-secrets
    creationPolicy: Owner
  data:
    - secretKey: AC_TK_S
      remoteRef:
        key: aureoncare/saas/production
        property: jwt_secret
    - secretKey: AC_EK
      remoteRef:
        key: aureoncare/saas/production
        property: encryption_key
    - secretKey: AC_PG_URI
      remoteRef:
        key: aureoncare/saas/production
        property: database_url
```

### 3.3 Helm install/upgrade (manual)

```bash
helm upgrade --install aureoncare helm/aureoncare/ \
  --namespace aureoncare-saas \
  --create-namespace \
  -f helm/aureoncare/values.yaml \
  -f helm/aureoncare/values.saas.yaml \
  --set image.tag=1.5.0 \
  --set ingress.host=app.aureoncare.com \
  --set env.AC_TK_S="${AC_TK_S}" \
  --set env.AC_EK="${AC_EK}" \
  --set env.AC_PG_URI="${AC_PG_URI}"
```

### 3.4 GitOps pipeline (ArgoCD)

The SaaS deployment is fully GitOps-driven. The flow is:

```
Developer pushes code
      ↓
CI runs tests + builds Docker images
      ↓
Release tag pushed (e.g. v1.5.0)
      ↓
release.yml workflow runs:
  - Builds + pushes Docker images to ghcr.io
  - Packages Helm chart
  - Creates GitHub Release
      ↓
ArgoCD detects new chart version (polls every 3 minutes)
      ↓
ArgoCD syncs → rolling deploy to aureoncare-saas namespace
      ↓
Slack notification via argocd-notifications
```

**Deploy ArgoCD application:**

```bash
kubectl apply -f deployment/saas/argocd-app.yaml
```

**Monitor sync status:**

```bash
argocd app get aureoncare-saas
argocd app sync aureoncare-saas   # manual trigger if needed
```

**Roll back to a previous version:**

```bash
argocd app history aureoncare-saas
argocd app rollback aureoncare-saas <revision-id>
```

### 3.5 Monitoring the fleet

```bash
# Check all pods are running
kubectl get pods -n aureoncare-saas

# Check backend logs
kubectl logs -n aureoncare-saas -l app.kubernetes.io/component=backend -f

# Check ingress
kubectl get ingress -n aureoncare-saas

# Check HPA status
kubectl get hpa -n aureoncare-saas
```

---

## 4. Hosted on Customer Cloud

The customer manages their own cloud Kubernetes cluster. AureonCare provides the Helm chart; the customer configures it for their environment.

### 4.1 AWS EKS

```bash
# 1. Create EKS cluster
eksctl create cluster \
  --name aureoncare \
  --region us-east-1 \
  --nodegroup-name standard \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 6 \
  --managed

# 2. Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer

# 3. Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 4. Get LoadBalancer hostname (for DNS)
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# 5. Create DNS record pointing your domain to that hostname, then:

# 6. Install AureonCare
kubectl create namespace aureoncare
helm upgrade --install aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  -f helm/aureoncare/values.yaml \
  -f helm/aureoncare/values.customer-cloud.yaml \
  --set ingress.host=aureoncare.yourclinic.com \
  --set postgresql.auth.password="$(openssl rand -hex 24)" \
  --set env.AC_TK_S="$(openssl rand -hex 32)" \
  --set env.AC_EK="$(openssl rand -hex 16)"

# 7. Run migrations (first deploy only)
kubectl exec -n aureoncare \
  deployment/$(kubectl get deploy -n aureoncare -l app.kubernetes.io/component=backend -o name | head -1 | cut -d/ -f2) \
  -- node run_migrations.js
```

**Using AWS RDS instead of in-cluster PostgreSQL:**

```bash
# Create RDS PostgreSQL instance via AWS console or CLI, then:
helm upgrade --install aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  -f helm/aureoncare/values.yaml \
  -f helm/aureoncare/values.customer-cloud.yaml \
  --set postgresql.enabled=false \
  --set env.AC_PG_URI="postgresql://aureoncare:${DB_PASS}@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/aureoncare?sslmode=require" \
  --set env.AC_TK_S="$(openssl rand -hex 32)" \
  --set env.AC_EK="$(openssl rand -hex 16)"
```

### 4.2 Azure AKS

```bash
# 1. Create AKS cluster
az aks create \
  --resource-group aureoncare-rg \
  --name aureoncare-aks \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-managed-identity \
  --generate-ssh-keys

az aks get-credentials --resource-group aureoncare-rg --name aureoncare-aks

# 2. Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 3. Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 4. Install AureonCare
kubectl create namespace aureoncare
helm upgrade --install aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  -f helm/aureoncare/values.yaml \
  -f helm/aureoncare/values.customer-cloud.yaml \
  --set ingress.host=aureoncare.yourclinic.com \
  --set postgresql.auth.password="$(openssl rand -hex 24)" \
  --set env.AC_TK_S="$(openssl rand -hex 32)" \
  --set env.AC_EK="$(openssl rand -hex 16)"
```

**Using Azure Database for PostgreSQL:**

```bash
# Create Azure Database for PostgreSQL Flexible Server via portal, then:
helm upgrade aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  --reuse-values \
  --set postgresql.enabled=false \
  --set env.AC_PG_URI="postgresql://aureoncare%40yourserver:${DB_PASS}@yourserver.postgres.database.azure.com:5432/aureoncare?sslmode=require"
```

### 4.3 GCP GKE

```bash
# 1. Create GKE cluster
gcloud container clusters create aureoncare \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n2-standard-2 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 6

gcloud container clusters get-credentials aureoncare --zone us-central1-a

# 2. Install NGINX Ingress Controller
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 3. Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 4. Install AureonCare
kubectl create namespace aureoncare
helm upgrade --install aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  -f helm/aureoncare/values.yaml \
  -f helm/aureoncare/values.customer-cloud.yaml \
  --set ingress.host=aureoncare.yourclinic.com \
  --set postgresql.auth.password="$(openssl rand -hex 24)" \
  --set env.AC_TK_S="$(openssl rand -hex 32)" \
  --set env.AC_EK="$(openssl rand -hex 16)"
```

**Using Google Cloud SQL:**

```bash
# Create Cloud SQL PostgreSQL instance via GCP console or gcloud, then:
helm upgrade aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  --reuse-values \
  --set postgresql.enabled=false \
  --set env.AC_PG_URI="postgresql://aureoncare:${DB_PASS}@/aureoncare?host=/cloudsql/project:region:instance&sslmode=disable"
```

### 4.4 Customer-managed updates

For customer cloud deployments, the update agent runs in the cluster and checks for new releases:

```bash
# Check current update status
kubectl exec -n aureoncare \
  -l app.kubernetes.io/component=update-agent \
  -- curl -s http://localhost:8080/status | jq .
```

The update agent notifies customers via webhook (Slack, Teams, email gateway) when a new version is available. The customer then:

1. Reviews the release notes at `https://github.com/aureoncare/aureoncare/releases`
2. Schedules a maintenance window
3. Applies the update:

```bash
# Update to a specific version
helm upgrade aureoncare ./helm/aureoncare/ \
  --namespace aureoncare \
  --reuse-values \
  --set image.tag=1.6.0

# Or pull the latest chart and update
helm repo update aureoncare
helm upgrade aureoncare aureoncare/aureoncare \
  --namespace aureoncare \
  --reuse-values

# Run migrations after upgrade
kubectl exec -n aureoncare \
  deployment/aureoncare-backend \
  -- node run_migrations.js
```

---

## 5. Version Management and Update Policy

### Supported versions

| Version | Status | Support ends |
|---------|--------|--------------|
| 2.x (latest) | Active | Current + 18 months |
| 1.x | Maintenance | Security fixes only |
| < 1.0 | End-of-life | No support |

### Checking current version

**On-premises (Docker Compose):**
```bash
curl http://localhost:8080/status | jq .currentVersion
# or
grep AUREONCARE_VERSION /opt/aureoncare/.env
```

**Kubernetes (Helm):**
```bash
helm list -n aureoncare
kubectl get deployment aureoncare-backend -n aureoncare \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Update subscription tiers

| Tier | Update notifications | Auto-apply | Priority support |
|------|---------------------|------------|-----------------|
| Community | Manual check only | No | No |
| Standard | Email/webhook | Optional | Business hours |
| Enterprise | Webhook + Slack | Optional + approval workflow | 24/7 |

### Activating your subscription

```bash
# On-premises: add to .env or backend/.env
SUBSCRIPTION_KEY=your-key-provided-by-aureoncare

# Kubernetes: pass as Helm value
helm upgrade aureoncare helm/aureoncare/ \
  --reuse-values \
  --set env.SUBSCRIPTION_KEY=your-key-provided-by-aureoncare
```

The subscription key is provided when you purchase an AureonCare support subscription. Contact sales@aureoncare.com.

### Unsubscribing / removing the update agent

**Docker Compose:**
```bash
# Remove the update-agent service
docker compose stop update-agent
docker compose rm update-agent

# Comment out the update-agent section in docker-compose.yml
```

**Kubernetes:**
```bash
helm upgrade aureoncare helm/aureoncare/ \
  --reuse-values \
  --set updateAgent.enabled=false
```

---

## 6. Environment Variables Reference

### Backend variables (`AC_` prefix)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AC_TK_S` | **Yes** | — | JWT signing secret. Generate: `openssl rand -hex 32` |
| `AC_TK_E` | No | `24h` | JWT token expiry (Go duration: `24h`, `7d`, `1h30m`) |
| `AC_EK` | **Yes** | — | Field-level encryption key. Generate: `openssl rand -hex 16` |
| `AC_CLN` | No | `AureonCare Clinic` | Clinic display name shown in the UI |
| `AC_BE_URL` | **Yes** | — | Backend public URL, e.g. `https://api.clinic.com` |
| `AC_FE_URL` | **Yes** | — | Frontend public URL, e.g. `https://app.clinic.com` |
| `NODE_ENV` | No | `production` | Node.js environment (`production`, `development`, `test`) |
| `PORT` | No | `3000` | Backend HTTP port |
| `AC_PG_URI` | **Yes*** | — | Full PostgreSQL URI (takes precedence over `AC_DB_*` vars) |
| `AC_DB_H` | **Yes*** | `localhost` | PostgreSQL host |
| `AC_DB_P` | No | `5432` | PostgreSQL port |
| `AC_DB_N` | No | `aureoncare` | PostgreSQL database name |
| `AC_DB_U` | No | `postgres` | PostgreSQL username |
| `AC_DB_W` | **Yes*** | — | PostgreSQL password |
| `AC_DB_S` | No | `false` | Set `true` when using Supabase TLS connection pooler |
| `AC_SB_URL` | No | — | Supabase project URL (only for Supabase-hosted DB) |
| `AC_SB_PK` | No | — | Supabase publishable key |
| `AC_SB_SK` | No | — | Supabase secret key (server-side only) |
| `AC_USE_RD` | No | `false` | Set `true` to enable Redis session store |
| `AC_RD_H` | No | `localhost` | Redis host |
| `AC_RD_P` | No | `6379` | Redis port |
| `AC_RD_W` | No | — | Redis password |
| `AC_SG_KEY` | No | — | SendGrid API key for transactional email |
| `AC_FROM_EM` | No | — | From address for system emails |
| `AC_SM_H` | No | — | SMTP host (alternative to SendGrid) |
| `AC_SM_P` | No | `587` | SMTP port |
| `AC_SM_U` | No | — | SMTP username |
| `AC_SM_W` | No | — | SMTP password |
| `AC_UPL_DIR` | No | `/tmp/aureoncare/uploads` | Upload directory inside container |
| `AC_UPL_MAX` | No | `10485760` | Max upload size in bytes (default 10 MB) |
| `AC_LOG_DIR` | No | `/tmp/aureoncare/logs` | Log directory inside container |
| `AC_LOG_LVL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `AC_ZM_CID` | No | — | Zoom OAuth client ID |
| `AC_ZM_CSK` | No | — | Zoom OAuth client secret |
| `AC_GM_CID` | No | — | Google Meet OAuth client ID |
| `AC_GM_CSK` | No | — | Google Meet OAuth client secret |
| `AC_MS_CID` | No | — | Microsoft Teams Azure AD client ID |
| `AC_MS_CSK` | No | — | Microsoft Teams Azure AD client secret |
| `AC_WBX_CID` | No | — | Cisco Webex OAuth client ID |
| `AC_WBX_CSK` | No | — | Cisco Webex OAuth client secret |
| `AC_GD_CSK` | No | — | Google Drive OAuth client secret |
| `AC_OD_CSK` | No | — | OneDrive OAuth client secret |

*`AC_PG_URI` takes precedence. If absent, `AC_DB_H`, `AC_DB_P`, `AC_DB_N`, `AC_DB_U`, and `AC_DB_W` are used.

### Frontend variables (`REACT_APP_` prefix)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_SVC_URL` | **Yes** | — | Backend API base URL, e.g. `https://api.clinic.com/api` |
| `REACT_APP_SB_URL` | No | — | Supabase project URL (if using Supabase auth) |
| `REACT_APP_SB_PK` | No | — | Supabase publishable key |
| `REACT_APP_GG_CID` | No | — | Google OAuth client ID |
| `REACT_APP_MS_CID` | No | — | Microsoft OAuth client ID |
| `REACT_APP_FB_AID` | No | — | Facebook OAuth App ID |
| `REACT_APP_AUTH_URI` | No | `http://localhost:3001` | OAuth redirect URI (must match OAuth provider config) |

### Update agent variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RELEASE_REGISTRY_URL` | **Yes** | — | GitHub Releases API URL |
| `CURRENT_VERSION` | **Yes** | — | Installed semver version, e.g. `1.2.3` |
| `CHECK_INTERVAL_HOURS` | No | `24` | How often to poll for updates (in hours) |
| `AUREONCARE_API_URL` | **Yes** | — | Backend URL for connectivity check |
| `SUBSCRIPTION_KEY` | No | — | Bearer token for authenticated release registry access |
| `NOTIFY_WEBHOOK_URL` | No | — | URL to POST update notifications to (Slack/Teams/custom) |
| `AUTO_APPLY` | No | `false` | Set `true` to automatically pull and restart on new release |
| `STATUS_FILE` | No | `/data/update-status.json` | Path to persist check state |
| `HTTP_PORT` | No | `8080` | Status HTTP server port |
| `COMPOSE_DIR` | No | `/app` | Working directory for `docker compose` commands |

### Docker Compose-specific variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_DB` | No | `aureoncare` | PostgreSQL database name |
| `POSTGRES_USER` | No | `aureoncare` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password (must match `AC_DB_W`) |
| `REDIS_PASSWORD` | No | `changeme_redis_password` | Redis password (when using `--profile redis`) |
| `AUREONCARE_VERSION` | No | `1.0.0` | Installed version (reported by update agent) |
| `UPDATE_CHECK_INTERVAL_HOURS` | No | `24` | Update check frequency |
| `AUTO_APPLY` | No | `false` | Enable update auto-apply |
| `SUBSCRIPTION_KEY` | No | — | Update subscription key |
| `NOTIFY_WEBHOOK_URL` | No | — | Webhook for update notifications |
