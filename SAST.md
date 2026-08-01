# Static Application Security Testing (SAST) — AureonCare

**Version:** 1.0
**Effective Date:** 2026-03-15
**Stack:** Node.js 14+ / Express 4.x (backend) · React 18 / CRA 5 (frontend)
**Audience:** Engineering, DevOps, Security
**Related Documents:** [SSDLC.md](./SSDLC.md)

---

## 1. Purpose & Scope

This document defines the SAST programme for AureonCare — the tooling selected, how each tool is configured, how findings are classified and remediated, and how the entire programme integrates into the development workflow.

SAST analyses source code and dependencies **without executing the application**. It catches security defects earlier and more cheaply than dynamic or manual testing. Because AureonCare handles Protected Health Information (PHI), financial records, and multi-tenant clinical data, SAST is a mandatory gate, not an optional check.

**In scope:**
- `/` root workspace and all subdirectories
- `backend/` — Node.js/Express API server, middleware, route handlers, services
- `frontend/` — React SPA, components, views, API client layer
- All `package.json` and lockfiles (dependency vulnerability scanning)
- GitHub Actions CI pipeline (`.github/workflows/`)

**Out of scope:**
- Dynamic runtime behaviour (covered by DAST — see SSDLC Phase 5)
- Infrastructure-as-code (separate IaC security review)
- Database schema security (covered by database security review)

---

## 2. Tool Stack

AureonCare uses a layered SAST approach. No single tool catches everything; the tools are complementary.

| Layer | Tool | What It Catches | When It Runs |
|---|---|---|---|
| Dependency CVEs | `npm audit` | Known vulnerabilities in npm packages | Every PR + weekly scheduled |
| JS security anti-patterns | ESLint + `eslint-plugin-security` | `eval`, regex DoS, unsafe `fs` paths, prototype pollution | Every PR (lint gate) |
| React-specific issues | `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y` | `dangerouslySetInnerHTML`, hook misuse | Every PR (lint gate) |
| Semantic code analysis | Semgrep | Custom rules for healthcare/PHI patterns, OWASP Top 10 | Every PR + nightly |
| Secret detection | `gitleaks` | Hardcoded credentials, API keys, tokens in code and history | Every push (pre-receive hook) |
| Licence compliance | `license-checker` | GPL/copyleft licences in commercial product | Monthly |

### Why these tools for this stack

- **`npm audit`** — zero-config, native to the npm ecosystem. Catches CVEs in all 47 backend and 21 frontend packages including `express`, `jsonwebtoken`, `multer`, `xml2js`, and `xlsx` which have historically had CVEs.
- **ESLint security plugin** — integrates into the existing CRA ESLint setup already present in `frontend/package.json`; backend has no ESLint config today so one must be added.
- **Semgrep** — supports JavaScript/TypeScript natively, has a maintained `p/nodejs` and `p/react` ruleset, and allows custom rules for AureonCare-specific patterns (HIPAA audit log checks, tenant-scope checks).
- **gitleaks** — git-native; scans the full commit history, not just the current working tree, which is important given the `.env` file present in the repository.

---

## 3. Installation & Configuration

### 3.1 ESLint (Backend — new configuration required)

The backend has no ESLint configuration. Add the following:

**Install:**
```bash
npm install --save-dev eslint eslint-plugin-security eslint-plugin-node \
  @eslint/js --prefix .
```

**Create `backend/.eslintrc.json`:**
```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:security/recommended",
    "plugin:node/recommended"
  ],
  "plugins": ["security", "node"],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "error",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-new-buffer": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "no-console": "warn",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error"
  },
  "ignorePatterns": ["node_modules/", "scripts/"]
}
```

### 3.2 ESLint (Frontend — extend existing configuration)

The frontend already uses `react-app` ESLint config (in `frontend/package.json`). Extend it by adding `eslint-plugin-security`:

**Install:**
```bash
npm install --save-dev eslint-plugin-security --prefix frontend
```

**Update `frontend/package.json` `eslintConfig` section:**
```json
"eslintConfig": {
  "extends": [
    "react-app",
    "react-app/jest",
    "plugin:security/recommended"
  ],
  "plugins": ["security"],
  "rules": {
    "react/no-danger": "error",
    "security/detect-object-injection": "warn",
    "security/detect-unsafe-regex": "error",
    "no-eval": "error",
    "no-implied-eval": "error"
  }
}
```

### 3.3 Semgrep

**Install (CI):**
```bash
pip install semgrep
```

**Run against the full repository:**
```bash
semgrep --config p/nodejs \
        --config p/react \
        --config p/owasp-top-ten \
        --config p/jwt \
        --config .semgrep/  \
        --error \
        --json \
        --output semgrep-results.json \
        backend/ frontend/src/
```

**Local development:**
```bash
semgrep --config auto .
```

Custom rule directory `.semgrep/` is defined in Section 5.

### 3.4 npm audit

**Run in CI (fail on high/critical):**
```bash
# Backend (root workspace)
npm audit --audit-level=high

# Frontend
npm audit --audit-level=high --prefix frontend
```

**Waiver process:** If a CVE cannot be remediated immediately (e.g., no patch available, transitive dependency), create a waiver entry in `security/audit-waivers.json` with:
- Package name and version range
- CVE identifier
- Risk justification
- Expiry date (max 90 days)
- Approving engineer

**`security/audit-waivers.json` schema:**
```json
[
  {
    "package": "example-package",
    "version": "<=1.2.3",
    "cve": "CVE-2024-XXXXX",
    "severity": "high",
    "justification": "No patch available. Affected code path not reachable in production due to ...",
    "expires": "2026-06-15",
    "approved_by": "engineer@aureoncare.com",
    "approved_date": "2026-03-15"
  }
]
```

### 3.5 gitleaks

**Install:**
```bash
# macOS/Linux
brew install gitleaks
# or via binary: https://github.com/gitleaks/gitleaks/releases
```

**Run against repository:**
```bash
# Scan full history
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# Scan only uncommitted changes (pre-commit)
gitleaks protect --staged
```

**`.gitleaks.toml` configuration (place at repo root):**
```toml
title = "AureonCare Gitleaks Configuration"

[extend]
useDefault = true

[[rules]]
id = "aureoncare-supabase-url"
description = "Supabase project URL"
regex = '''supabase\.co/rest'''
tags = ["supabase", "database"]

[[rules]]
id = "aureoncare-jwt-secret"
description = "JWT_SECRET environment variable value"
regex = '''JWT_SECRET\s*=\s*["\']?[A-Za-z0-9+/]{20,}'''
tags = ["jwt", "auth"]

[[rules]]
id = "aureoncare-db-connection"
description = "PostgreSQL connection string"
regex = '''postgresql://[^:]+:[^@]+@[^/]+/'''
tags = ["database", "credentials"]

[allowlist]
description = "Allowlist for known safe patterns"
paths = [
  '''.env\.example''',
  '''SAST\.md''',
  '''SSDLC\.md''',
  '''\.md$'''
]
```

---

## 4. CI/CD Integration

### 4.1 GitHub Actions Workflow

Create `.github/workflows/sast.yml`:

```yaml
name: SAST

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main, master]
  schedule:
    # Weekly full scan every Monday at 02:00 UTC
    - cron: "0 2 * * 1"

jobs:
  dependency-audit:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install root dependencies
        run: npm ci

      - name: Install frontend dependencies
        run: npm ci --prefix frontend

      - name: Audit backend dependencies
        run: npm audit --audit-level=high

      - name: Audit frontend dependencies
        run: npm audit --audit-level=high --prefix frontend

  eslint-backend:
    name: ESLint Backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci
      - name: Lint backend
        run: npx eslint backend/ --max-warnings=0

  eslint-frontend:
    name: ESLint Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci --prefix frontend
      - name: Lint frontend
        run: npx eslint frontend/src/ --max-warnings=0

  semgrep:
    name: Semgrep SAST
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        run: |
          semgrep --config p/nodejs \
                  --config p/react \
                  --config p/owasp-top-ten \
                  --config p/jwt \
                  --config .semgrep/ \
                  --error \
                  --json \
                  --output semgrep-results.json \
                  backend/ frontend/src/
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}

      - name: Upload Semgrep results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: semgrep-results
          path: semgrep-results.json

  secret-scan:
    name: Secret Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history for gitleaks
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4.2 PR Gate Requirements

The following checks must pass before a PR can be merged:

| Check | Failure Action |
|---|---|
| `dependency-audit` | Block merge — escalate to security lead for waiver |
| `eslint-backend` | Block merge — developer must fix all errors |
| `eslint-frontend` | Block merge — developer must fix all errors |
| `semgrep` | Block merge on Error severity findings; Warning severity must be acknowledged in PR description |
| `secret-scan` | Block merge — remediate by rotating the secret, then re-scan |

---

## 5. Custom Semgrep Rules

Custom rules are stored in `.semgrep/` at the repository root. These rules encode AureonCare-specific security patterns that generic rulesets do not cover.

### `.semgrep/aureoncare-rules.yaml`

```yaml
rules:

  # ----------------------------------------------------------------
  # AUTH-001: Header-based authentication bypass risk
  # The current auth middleware trusts x-user-id and x-user-role
  # headers without JWT verification — flag any new route that reads
  # these headers directly instead of using the authenticate middleware.
  # ----------------------------------------------------------------
  - id: header-auth-bypass
    patterns:
      - pattern: req.headers['x-user-role']
      - pattern-not-inside: |
          const authenticate = ...
    message: >
      Direct use of 'x-user-role' header outside the authenticate middleware.
      Role claims must come from the verified req.user object populated by
      the authenticate() middleware, not directly from client-supplied headers.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: authentication
      cwe: "CWE-290: Authentication Bypass by Spoofing"
      owasp: "A07:2021 - Identification and Authentication Failures"

  # ----------------------------------------------------------------
  # AUTH-002: Route handler missing authentication middleware
  # Flag route definitions that do not call authenticate or requireAdmin
  # ----------------------------------------------------------------
  - id: route-missing-auth
    patterns:
      - pattern: router.$METHOD($PATH, async (req, res) => { ... })
      - pattern-not: router.$METHOD($PATH, authenticate, ...)
      - pattern-not: router.$METHOD($PATH, requireAdmin, ...)
      - pattern-not: router.post('/login', ...)
      - pattern-not: router.post('/register', ...)
      - pattern-not: router.post('/forgot-password', ...)
      - pattern-not: router.get('/health', ...)
    message: >
      Route handler does not appear to use authentication middleware.
      Ensure authenticate() is applied to all non-public endpoints.
    languages: [javascript]
    severity: WARNING
    metadata:
      category: authorization
      cwe: "CWE-306: Missing Authentication for Critical Function"
      owasp: "A01:2021 - Broken Access Control"

  # ----------------------------------------------------------------
  # TENANT-001: Database query missing organization_id scope
  # All PHI queries must scope to the authenticated user's organization.
  # Flag SELECT queries on core PHI tables that lack an org filter.
  # ----------------------------------------------------------------
  - id: missing-tenant-scope
    patterns:
      - pattern: pool.query('SELECT ... FROM $TABLE ...', [...])
      - metavariable-regex:
          metavariable: $TABLE
          regex: (patients|medical_records|prescriptions|diagnoses|lab_orders|appointments|claims|payments)
      - pattern-not: pool.query('... WHERE ... organization_id ...', [...])
    message: >
      Query on PHI table '$TABLE' does not filter by organization_id.
      All queries on PHI tables must include a tenant scope to prevent
      cross-organisation data leakage.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: multi-tenancy
      cwe: "CWE-284: Improper Access Control"
      owasp: "A01:2021 - Broken Access Control"

  # ----------------------------------------------------------------
  # LOG-001: PHI logged to console or logger
  # Prevent patient data from appearing in application logs.
  # ----------------------------------------------------------------
  - id: phi-in-logs
    patterns:
      - pattern: console.log(..., $X, ...)
      - metavariable-regex:
          metavariable: $X
          regex: (patient|diagnosis|prescription|medical|phi|ssn|dob|dateOfBirth)
    message: >
      Possible PHI field '$X' passed to console.log(). PHI must never
      appear in application logs. Use audit logging for clinical data access.
    languages: [javascript]
    severity: WARNING
    metadata:
      category: data-exposure
      cwe: "CWE-532: Insertion of Sensitive Information into Log File"
      owasp: "A09:2021 - Security Logging and Monitoring Failures"

  # ----------------------------------------------------------------
  # LOG-002: console.log in production route handlers
  # Route handlers should use winston logger, not console.log.
  # ----------------------------------------------------------------
  - id: console-log-in-route
    patterns:
      - pattern: console.log(...)
    paths:
      include:
        - backend/routes/
    message: >
      Use the winston logger (require('../logger') or similar) instead of
      console.log() in route handlers. console.log output is unstructured,
      cannot be filtered by severity, and may surface in serverless platform
      logs accessible outside the security boundary.
    languages: [javascript]
    severity: WARNING
    metadata:
      category: logging

  # ----------------------------------------------------------------
  # SQL-001: String concatenation in SQL query
  # ----------------------------------------------------------------
  - id: sql-string-concat
    patterns:
      - pattern: pool.query($QUERY + $INPUT, ...)
      - pattern: pool.query(`...${$INPUT}...`, ...)
    message: >
      Potential SQL injection: user-controlled value interpolated directly
      into query string. Use parameterised queries ($1, $2 placeholders)
      with the values array argument.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: injection
      cwe: "CWE-89: SQL Injection"
      owasp: "A03:2021 - Injection"

  # ----------------------------------------------------------------
  # XSS-001: dangerouslySetInnerHTML with non-literal value
  # ----------------------------------------------------------------
  - id: dangerous-inner-html
    patterns:
      - pattern: <$EL dangerouslySetInnerHTML={{ __html: $EXPR }} />
      - pattern-not: <$EL dangerouslySetInnerHTML={{ __html: "..." }} />
    message: >
      dangerouslySetInnerHTML with a non-literal expression risks XSS if
      $EXPR contains user-controlled data. Use a sanitisation library
      (e.g., DOMPurify) before passing content, or refactor to avoid
      raw HTML injection.
    languages: [javascript, typescript]
    severity: ERROR
    metadata:
      category: xss
      cwe: "CWE-79: Cross-site Scripting"
      owasp: "A03:2021 - Injection"

  # ----------------------------------------------------------------
  # AUDIT-001: PHI write operation without audit log
  # INSERT/UPDATE on PHI tables must be followed by an audit log call.
  # ----------------------------------------------------------------
  - id: phi-write-without-audit
    patterns:
      - pattern: |
          await pool.query('INSERT INTO $TABLE ...', [...]);
      - metavariable-regex:
          metavariable: $TABLE
          regex: (patients|medical_records|prescriptions|diagnoses|lab_orders|appointments)
      - pattern-not-inside: |
          ...
          await pool.query('INSERT INTO audit_logs ...', [...]);
          ...
    message: >
      INSERT into PHI table '$TABLE' is not followed by an audit_logs entry
      in the same code block. All create/update/delete operations on PHI
      tables require an audit log entry for HIPAA compliance.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: audit-logging
      cwe: "CWE-778: Insufficient Logging"
      hipaa: "§164.312(b) - Audit Controls"

  # ----------------------------------------------------------------
  # CRYPTO-001: Weak random number generation
  # Math.random() is not cryptographically secure.
  # ----------------------------------------------------------------
  - id: weak-random
    pattern: Math.random()
    message: >
      Math.random() is not cryptographically secure and must not be used for
      tokens, session IDs, password reset codes, or any security-sensitive
      value. Use crypto.randomBytes() or crypto.randomUUID() instead.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: cryptography
      cwe: "CWE-338: Use of Cryptographically Weak PRNG"

  # ----------------------------------------------------------------
  # CRYPTO-002: MD5 or SHA1 used for security purposes
  # ----------------------------------------------------------------
  - id: weak-hash
    patterns:
      - pattern: crypto.createHash('md5')
      - pattern: crypto.createHash('sha1')
    message: >
      MD5 and SHA-1 are cryptographically broken. Use SHA-256 or SHA-512
      for integrity checks, and bcrypt/argon2 for password hashing.
    languages: [javascript]
    severity: ERROR
    metadata:
      category: cryptography
      cwe: "CWE-327: Use of a Broken or Risky Cryptographic Algorithm"

  # ----------------------------------------------------------------
  # SSRF-001: Outbound HTTP with user-controlled URL
  # ----------------------------------------------------------------
  - id: ssrf-axios-user-url
    patterns:
      - pattern: axios.get($URL, ...)
      - pattern: axios.post($URL, ...)
      - pattern: fetch($URL, ...)
    message: >
      Outbound HTTP call with potentially user-controlled URL. Validate
      $URL against an allowlist of permitted external hosts before making
      the request to prevent Server-Side Request Forgery (SSRF).
    languages: [javascript]
    severity: WARNING
    metadata:
      category: ssrf
      cwe: "CWE-918: Server-Side Request Forgery"
      owasp: "A10:2021 - Server-Side Request Forgery"
```

---

## 6. Finding Severity & Remediation SLA

### 6.1 Severity Definitions

| Severity | Definition | Examples |
|---|---|---|
| **Critical** | Direct path to data breach, RCE, or full auth bypass requiring no preconditions | Hardcoded production credentials, SQL injection in unauthenticated endpoint, exposed `.env` with DB password |
| **High** | Significant security impact; exploitable with low effort or common preconditions | Missing authentication on PHI route, JWT secret in code, cross-tenant data leakage, `Math.random()` for reset tokens |
| **Medium** | Security weakness requiring specific conditions or chaining with other issues | Missing audit log on PHI write, `console.log` in route handlers, `dangerouslySetInnerHTML` with partially trusted data |
| **Low** | Best-practice violations with limited direct exploitability | Weak regex, use of deprecated crypto, overly broad error messages |

### 6.2 Remediation SLA

| Severity | Must be fixed before merge? | Standalone fix deadline |
|---|---|---|
| Critical | Yes — immediate | Deployed within 4 hours of detection |
| High | Yes — blocks merge | Fixed within 7 days if found in existing code |
| Medium | Acknowledged in PR; fix required | Fixed within 30 days |
| Low | Tracked as tech debt | Fixed within next planned security sprint |

### 6.3 Waiver Process

Findings that cannot be remediated within the SLA require a formal waiver:

1. Engineer opens a security issue tagged `sast-waiver`.
2. Issue documents: tool, rule ID, finding location, exploitability assessment, compensating control.
3. Security lead reviews and approves or rejects within 2 business days.
4. Approved waivers have a maximum validity of 90 days and must be re-approved upon expiry.
5. Waiver inventory is reviewed monthly.

---

## 7. Known Findings in Current Codebase

The following findings were identified during the initial SAST baseline scan of the repository. They represent work that must be tracked and remediated according to the SLAs above.

> These are baseline findings establishing a starting point. They do not reflect passing SAST state — new PRs must not introduce additional findings at the same or higher severity.

### 7.1 Critical

| ID | Location | Finding | Rule |
|---|---|---|---|
| F-001 | `backend/middleware/auth.js:17,131` | Authentication relies on client-supplied `x-user-id` and `x-user-role` HTTP headers. The `requireAdmin` function (line 131) reads role exclusively from `x-user-role` header with no database verification — any client can pass `x-user-role: admin` and bypass all admin-only checks. | `header-auth-bypass` |
| F-002 | `.env` committed to repository | A `.env` file containing production credentials (DB connection string, JWT secret, API keys) is present in the repository root and not excluded by `.gitignore`. | gitleaks / manual |

**Remediation for F-001:**
Replace the header-based auth pattern with JWT verification:
1. Generate and return a signed JWT from `/api/auth/login`.
2. Update `authenticate` middleware to verify the JWT signature and extract `userId` and `role` from the token payload.
3. Remove all direct reads of `x-user-id` and `x-user-role` headers outside the auth middleware.
4. `requireAdmin` must use `req.user.role` (populated by `authenticate`) not the raw header.

**Remediation for F-002:**
1. Immediately rotate all credentials present in the committed `.env`.
2. Add `.env` to `.gitignore` if not already present.
3. Remove the file from git history: `git filter-repo --path .env --invert-paths`.
4. Move all secrets to Vercel environment variables (per SSDLC Phase 6.2).

### 7.2 High

| ID | Location | Finding | Rule |
|---|---|---|---|
| F-003 | `backend/routes/auth.js:76` | Login endpoint error handler logs the full error object via `console.error('Error during login:', error)`. In serverless environments, this may surface stack traces including internal path information in platform-accessible logs. | `console-log-in-route` |
| F-004 | `backend/server.js:18` | Redis (used for JWT revocation and session management) is disabled with a comment block. Without Redis, there is no mechanism to invalidate JWT tokens on logout or account suspension. | Manual / architecture |
| F-005 | `frontend/package.json:57` | `xlsx` package v0.18.5 has known prototype pollution vulnerabilities (CVE-2023-30533). Upgrade to `exceljs` or the `xlsx` fork `@e965/xlsx`. | `npm audit` |

### 7.3 Medium

| ID | Location | Finding | Rule |
|---|---|---|---|
| F-006 | `backend/middleware/auth.js:53` | Authentication errors use `console.error` instead of the `winston` logger, producing unstructured output with no severity metadata. | `console-log-in-route` |
| F-007 | `backend/server.js:64` | `express.json` body size limit is set to `10mb`. This is generous for a JSON API and could enable resource exhaustion on serverless functions that are billed per memory/time. Reduce to `1mb` for standard endpoints; allow `10mb` only on specific upload routes. | Manual |
| F-008 | `backend/middleware/auth.js:43` | `SELECT *` is used when fetching the user record. The response includes all columns — the password hash and reset token are present in `req.user` during the request lifecycle, increasing the blast radius if the object is accidentally serialised. | Manual |

### 7.4 Low

| ID | Location | Finding | Rule |
|---|---|---|---|
| F-009 | `backend/routes/auth.js:72` | Successful login response returns the full `userData` object (minus password hash). This may include internal fields such as `reset_token_expires`, `created_at`, `updated_at` that are not needed by the client and constitute unnecessary data exposure. | Manual |
| F-010 | `backend/server.js:44` | `crossOriginEmbedderPolicy: 'credentialless'` weakens the default Helmet COEP setting to support Zoom SDK. This is intentional but should be documented with a comment explaining the trade-off and reviewed when the Zoom SDK is updated. | Manual |

---

## 8. Metrics & Reporting

### 8.1 SAST Dashboard Metrics

Track the following metrics in the security register, reported monthly:

| Metric | Target |
|---|---|
| Mean time to remediate Critical findings | < 4 hours |
| Mean time to remediate High findings | < 7 days |
| Open Critical findings | 0 |
| Open High findings (> 7 days old) | 0 |
| PR merge rate with SAST gate enabled | 100% |
| `npm audit` High/Critical dependency count | 0 (or all waived) |
| Active waivers | < 5 |

### 8.2 Reporting Cadence

| Report | Audience | Frequency |
|---|---|---|
| SAST gate status (pass/fail per PR) | Engineering team | Per PR (automated) |
| Open findings summary | Engineering lead + security lead | Weekly |
| Trend report (new vs. closed findings) | CTO + compliance | Monthly |
| Full findings register with waiver status | Security lead + auditors | Quarterly |

---

## 9. Developer Guidance

### 9.1 Running SAST Locally Before Pushing

```bash
# From repo root

# 1. Dependency audit
npm audit --audit-level=high
npm audit --audit-level=high --prefix frontend

# 2. ESLint backend
npx eslint backend/ --max-warnings=0

# 3. ESLint frontend
npx eslint frontend/src/ --max-warnings=0

# 4. Semgrep (requires semgrep installed: pip install semgrep)
semgrep --config .semgrep/ --config p/nodejs --config p/react backend/ frontend/src/

# 5. Secret scan (uncommitted changes)
gitleaks protect --staged
```

### 9.2 Handling False Positives

If a SAST finding is a confirmed false positive:

**ESLint** — add an inline disable comment with a justification:
```javascript
// eslint-disable-next-line security/detect-object-injection -- key is validated against allowlist above
const value = obj[validatedKey];
```

**Semgrep** — add a `nosemgrep` comment:
```javascript
const token = crypto.randomBytes(32).toString('hex'); // nosemgrep: weak-random
```

False-positive suppression comments must include a brief justification. Suppressions without justification are treated as findings by code reviewers.

### 9.3 Pre-commit Hook Setup

Install gitleaks as a pre-commit hook to catch secrets before they reach the remote:

```bash
# Install pre-commit framework
pip install pre-commit

# Create .pre-commit-config.yaml at repo root
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
EOF

pre-commit install
```

---

## 10. Maintenance

- **Rule updates:** Semgrep community rulesets (`p/nodejs`, `p/react`, `p/owasp-top-ten`) are updated monthly. Pin the Semgrep version in CI to avoid unexpected failures from upstream rule changes; update the pin quarterly.
- **New dependencies:** Every new `npm install` must be followed by `npm audit` before committing.
- **New routes:** Every new Express route file added to `backend/routes/` automatically falls under the Semgrep `route-missing-auth` and `missing-tenant-scope` rules — no additional configuration needed.
- **SAST review:** This document is reviewed annually and after any significant architectural change (e.g., adding a new authentication provider, new data store, or new integration type).

---

*Owner: Security Engineering. Raise questions or propose changes via Pull Request to this file.*
