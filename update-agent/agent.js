'use strict';

/**
 * AureonCare On-Premises Update Agent
 *
 * Polls the AureonCare release registry on a configurable interval and:
 *  - Compares the latest published version against the installed version
 *  - Sends a webhook notification when a newer version is available
 *  - Optionally auto-applies the update via `docker compose pull && up -d`
 *  - Exposes a /status HTTP endpoint on port 8080 for health monitoring
 *
 * Environment variables:
 *   RELEASE_REGISTRY_URL   GitHub Releases API endpoint (required)
 *   CURRENT_VERSION        Installed version string, e.g. "1.2.3" (required)
 *   CHECK_INTERVAL_HOURS   How often to poll, in hours (default: 24)
 *   AUREONCARE_API_URL     Backend URL used to verify reachability (required)
 *   SUBSCRIPTION_KEY       Bearer token to authenticate release registry requests
 *   NOTIFY_WEBHOOK_URL     POST endpoint to send update notifications (optional)
 *   AUTO_APPLY             "true" to auto-pull and restart via docker compose (default: false)
 *   STATUS_FILE            Path to persist check status (default: /data/update-status.json)
 *   HTTP_PORT              Status HTTP port (default: 8080)
 */

import fetch from 'node-fetch';
import semver from 'semver';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname } from 'node:path';

const execAsync = promisify(exec);

// ── Configuration ─────────────────────────────────────────────────────────────

const RELEASE_REGISTRY_URL = process.env.RELEASE_REGISTRY_URL;
const CURRENT_VERSION      = process.env.CURRENT_VERSION;
const CHECK_INTERVAL_HOURS = parseFloat(process.env.CHECK_INTERVAL_HOURS || '24');
const AUREONCARE_API_URL   = process.env.AUREONCARE_API_URL;
const SUBSCRIPTION_KEY     = process.env.SUBSCRIPTION_KEY || '';
const NOTIFY_WEBHOOK_URL   = process.env.NOTIFY_WEBHOOK_URL || '';
const AUTO_APPLY           = (process.env.AUTO_APPLY || 'false').toLowerCase() === 'true';
const STATUS_FILE          = process.env.STATUS_FILE || '/data/update-status.json';
const HTTP_PORT            = parseInt(process.env.HTTP_PORT || '8080', 10);

// ── Validation ────────────────────────────────────────────────────────────────

if (!RELEASE_REGISTRY_URL) {
  console.error('[update-agent] FATAL: RELEASE_REGISTRY_URL is required');
  process.exit(1);
}
if (!CURRENT_VERSION || !semver.valid(CURRENT_VERSION)) {
  console.error('[update-agent] FATAL: CURRENT_VERSION must be a valid semver string (e.g. "1.2.3")');
  process.exit(1);
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  currentVersion: CURRENT_VERSION,
  latestVersion: null,
  updateAvailable: false,
  lastChecked: null,
  lastError: null,
  applyStatus: null,
  subscriptionActive: Boolean(SUBSCRIPTION_KEY),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(level, msg, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data });
  console.log(line);
}

function persistState() {
  try {
    const dir = dirname(STATUS_FILE);
    mkdirSync(dir, { recursive: true });
    writeFileSync(STATUS_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    log('warn', 'Failed to write status file', { error: err.message });
  }
}

function loadPersistedState() {
  try {
    const raw = readFileSync(STATUS_FILE, 'utf8');
    const saved = JSON.parse(raw);
    // Restore non-config fields from last run
    state.latestVersion  = saved.latestVersion  ?? null;
    state.lastChecked    = saved.lastChecked     ?? null;
    state.applyStatus    = saved.applyStatus     ?? null;
    log('info', 'Loaded persisted state', { latestVersion: state.latestVersion });
  } catch {
    // No previous state — start fresh
  }
}

// ── Release registry polling ──────────────────────────────────────────────────

async function fetchLatestRelease() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': `AureonCare-UpdateAgent/${CURRENT_VERSION}`,
  };
  if (SUBSCRIPTION_KEY) {
    headers['Authorization'] = `Bearer ${SUBSCRIPTION_KEY}`;
  }

  const response = await fetch(RELEASE_REGISTRY_URL, { headers, timeout: 15000 });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Release registry authentication failed (HTTP ${response.status}). Check SUBSCRIPTION_KEY.`);
  }
  if (!response.ok) {
    throw new Error(`Release registry returned HTTP ${response.status}`);
  }

  const release = await response.json();

  // GitHub Releases API shape: { tag_name, name, body, html_url, assets, ... }
  const tagName = release.tag_name || release.version || '';
  const version = tagName.replace(/^v/, '');

  if (!semver.valid(version)) {
    throw new Error(`Release registry returned invalid version string: "${tagName}"`);
  }

  return {
    version,
    tagName,
    name: release.name || tagName,
    releaseNotes: release.body || '',
    url: release.html_url || RELEASE_REGISTRY_URL,
    publishedAt: release.published_at || null,
    assets: (release.assets || []).map(a => ({ name: a.name, downloadUrl: a.browser_download_url })),
  };
}

// ── Webhook notification ──────────────────────────────────────────────────────

async function sendWebhookNotification(release) {
  if (!NOTIFY_WEBHOOK_URL) return;

  const payload = {
    event: 'aureoncare.update_available',
    timestamp: new Date().toISOString(),
    currentVersion: CURRENT_VERSION,
    latestVersion: release.version,
    releaseName: release.name,
    releaseNotes: release.releaseNotes,
    releaseUrl: release.url,
    publishedAt: release.publishedAt,
    autoApplyEnabled: AUTO_APPLY,
    downloadAssets: release.assets,
  };

  try {
    const response = await fetch(NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 10000,
    });
    if (response.ok) {
      log('info', 'Webhook notification sent', { url: NOTIFY_WEBHOOK_URL, status: response.status });
    } else {
      log('warn', 'Webhook notification failed', { status: response.status });
    }
  } catch (err) {
    log('warn', 'Webhook notification error', { error: err.message });
  }
}

// ── Auto-apply via docker compose ─────────────────────────────────────────────

async function applyUpdate(release) {
  log('info', 'AUTO_APPLY enabled — pulling new images and restarting containers');
  state.applyStatus = 'in_progress';
  persistState();

  try {
    // Pull new images
    log('info', 'Running: docker compose pull');
    const pull = await execAsync('docker compose pull', {
      cwd: process.env.COMPOSE_DIR || '/app',
      timeout: 300_000, // 5 minutes
    });
    log('info', 'docker compose pull stdout', { stdout: pull.stdout.trim() });

    // Restart containers with zero-downtime rolling restart
    log('info', 'Running: docker compose up -d');
    const up = await execAsync('docker compose up -d', {
      cwd: process.env.COMPOSE_DIR || '/app',
      timeout: 120_000,
    });
    log('info', 'docker compose up stdout', { stdout: up.stdout.trim() });

    state.applyStatus = `applied_${release.version}_at_${new Date().toISOString()}`;
    log('info', 'Auto-apply complete', { version: release.version });
  } catch (err) {
    state.applyStatus = `failed: ${err.message}`;
    log('error', 'Auto-apply failed', { error: err.message });
  }

  persistState();
}

// ── Main check cycle ──────────────────────────────────────────────────────────

async function checkForUpdates() {
  log('info', 'Checking for updates', {
    currentVersion: CURRENT_VERSION,
    registryUrl: RELEASE_REGISTRY_URL,
  });

  try {
    const release = await fetchLatestRelease();
    state.latestVersion = release.version;
    state.lastChecked   = new Date().toISOString();
    state.lastError     = null;

    if (semver.gt(release.version, CURRENT_VERSION)) {
      state.updateAvailable = true;
      log('info', `Update available: v${release.version}`, {
        currentVersion: CURRENT_VERSION,
        latestVersion: release.version,
        releaseUrl: release.url,
      });

      await sendWebhookNotification(release);

      if (AUTO_APPLY) {
        await applyUpdate(release);
      }
    } else {
      state.updateAvailable = false;
      log('info', 'Installation is up to date', {
        currentVersion: CURRENT_VERSION,
        latestVersion: release.version,
      });
    }
  } catch (err) {
    state.lastError   = err.message;
    state.lastChecked = new Date().toISOString();
    log('error', 'Update check failed', { error: err.message });
  }

  persistState();
}

// ── HTTP Status Server ────────────────────────────────────────────────────────

function startStatusServer() {
  const server = createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (req.url === '/status' || req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify({
        service: 'aureoncare-update-agent',
        currentVersion: state.currentVersion,
        latestVersion: state.latestVersion,
        updateAvailable: state.updateAvailable,
        lastChecked: state.lastChecked,
        lastError: state.lastError,
        applyStatus: state.applyStatus,
        subscriptionActive: state.subscriptionActive,
        autoApplyEnabled: AUTO_APPLY,
        checkIntervalHours: CHECK_INTERVAL_HOURS,
        timestamp: new Date().toISOString(),
      }, null, 2));
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    log('info', `Status server listening on port ${HTTP_PORT}`, {
      endpoints: [`GET http://0.0.0.0:${HTTP_PORT}/status`, `GET http://0.0.0.0:${HTTP_PORT}/health`],
    });
  });

  server.on('error', (err) => {
    log('error', 'Status server error', { error: err.message });
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  log('info', 'AureonCare Update Agent starting', {
    currentVersion: CURRENT_VERSION,
    checkIntervalHours: CHECK_INTERVAL_HOURS,
    autoApply: AUTO_APPLY,
    subscriptionActive: Boolean(SUBSCRIPTION_KEY),
  });

  loadPersistedState();
  startStatusServer();

  // Run an immediate check on startup
  await checkForUpdates();

  // Schedule recurring checks
  const intervalMs = CHECK_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(checkForUpdates, intervalMs);
}

main().catch((err) => {
  console.error('[update-agent] Unhandled startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM — shutting down gracefully');
  persistState();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT — shutting down gracefully');
  persistState();
  process.exit(0);
});
