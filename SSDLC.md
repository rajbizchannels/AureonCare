# Secure Software Development Lifecycle (SSDLC) — AureonCare

**Version:** 1.0
**Effective Date:** 2026-03-15
**Audience:** Engineering, DevOps, QA, Product, Compliance
**Regulatory Context:** HIPAA Security Rule, HITECH, SOC 2 Type II, OWASP ASVS L2

---

## Overview

AureonCare is a production-grade healthcare practice management platform handling Protected Health Information (PHI), financial data, and clinical workflows. This SSDLC defines mandatory security activities at every phase of development to ensure the application is designed, built, tested, deployed, and maintained in a way that protects patient data, meets regulatory obligations, and minimises risk.

The SSDLC is not a one-time activity — it is a continuous, iterative process applied to every feature, bug fix, and infrastructure change.

---

## Phase 1: Planning & Requirements

### 1.1 Security Requirements Elicitation

Every feature or change must answer the following questions before development begins:

| Question | Rationale |
|---|---|
| Does this feature create, read, update, or delete PHI? | Triggers HIPAA controls |
| Does this feature introduce new roles or permissions? | RBAC impact assessment |
| Does this feature integrate with a third-party service? | Vendor risk and OAuth scope review |
| Does this feature expose a new API endpoint? | Attack surface expansion |
| Does this feature handle file uploads or downloads? | Malware, path traversal risk |
| Does this feature affect audit logging? | Compliance trail completeness |
| Does this feature change authentication or session handling? | Auth-N/Auth-Z integrity |

Security requirements must be captured as acceptance criteria in the issue or ticket before work starts.

### 1.2 HIPAA Business Associate Agreements (BAAs)

Any new third-party integration (payment processor, email provider, cloud service, analytics tool) must have a signed BAA on file before being incorporated into the codebase. BAAs are tracked in the Legal register.

### 1.3 Threat Modelling

For every significant new feature or architectural change, a threat model must be completed using the **STRIDE** methodology:

| Threat | Description | AureonCare Example |
|---|---|---|
| **S**poofing | Impersonating a user or service | Forged JWT tokens, OAuth token replay |
| **T**ampering | Modifying data in transit or at rest | Altering clinical notes, modifying claims |
| **R**epudiation | Denying an action was performed | Missing audit logs for prescription changes |
| **I**nformation Disclosure | Exposing PHI to unauthorised parties | Over-broad API responses, debug logs |
| **D**enial of Service | Making the service unavailable | Unthrottled appointment booking endpoints |
| **E**levation of Privilege | Gaining higher access than authorised | Horizontal privilege escalation between tenants |

Threat model outputs are documented in the issue, reviewed during design review, and stored in `/docs/threat-models/`.

### 1.4 Data Classification

All data processed by AureonCare must be classified before feature design:

| Class | Examples | Controls Required |
|---|---|---|
| **PHI / ePHI** | Patient demographics, diagnoses, prescriptions, lab results | Encryption at rest & in transit, audit logging, BAA, minimal disclosure |
| **Financial PII** | Credit card data, insurance IDs, payment amounts | PCI-DSS controls (if applicable), encryption, access restriction |
| **Organisational** | Clinic settings, provider data, scheduling templates | RBAC, audit logging |
| **Public** | Marketing content, anonymised statistics | Standard access controls |

---

## Phase 2: Design & Architecture

### 2.1 Security Architecture Principles

All system design must follow these principles:

- **Least Privilege:** Every user role, service account, and database user has only the permissions required for its function. Roles are defined in `backend/routes/roles.js` and enforced in `backend/middleware/auth.js`.
- **Defence in Depth:** Security controls exist at the network, application, and data layers. No single control is relied upon exclusively.
- **Secure Defaults:** New features are secure by default; security is opt-out, not opt-in.
- **Fail Securely:** Errors return generic messages to clients; full details are written to server-side logs only.
- **Zero Trust:** No user, device, or service is trusted by default — all access requires authentication and authorisation.
- **Separation of Duties:** Privileged actions (e.g., billing adjustments, record deletion) require additional authorisation checks.

### 2.2 Authentication & Session Management Design

| Control | Implementation |
|---|---|
| Passwords | bcrypt with cost factor ≥ 12 |
| Tokens | Short-lived JWT (15 min access token, 7-day refresh token) |
| OAuth | Google, Microsoft, Facebook via PKCE flow |
| MFA | TOTP via speakeasy for privileged accounts |
| Session invalidation | Token revocation list maintained in Redis |
| Patient portal | Separate authentication context from staff |

### 2.3 Multi-Tenancy & Data Isolation Design

AureonCare operates as a multi-tenant SaaS platform. Every data-access query must scope results to the authenticated user's `organization_id`. Design review must verify:

- All new routes include tenant-scoping middleware or explicit `WHERE organization_id = ?` clauses.
- No cross-tenant data leakage path exists in the query logic.
- Admin routes are protected by an explicit `isSuperAdmin` check, not just `isAdmin`.

### 2.4 API Design Security Checklist

Before implementing a new endpoint, verify:

- [ ] Authentication middleware is applied (no public endpoint by mistake).
- [ ] Authorisation check uses the RBAC middleware in `auth.js`.
- [ ] Input validation schema defined using Joi.
- [ ] Response shape does not include sensitive fields not needed by the client.
- [ ] Rate limiting applied (global or endpoint-specific via `express-rate-limit`).
- [ ] Endpoint is documented in the API inventory.

### 2.5 Cryptography Standards

| Use Case | Standard |
|---|---|
| Password hashing | bcrypt, cost ≥ 12 |
| JWT signing | RS256 (asymmetric) or HS256 with secret ≥ 256 bits |
| Data at rest | AES-256 (via Supabase Transparent Data Encryption) |
| Data in transit | TLS 1.2 minimum; TLS 1.3 preferred |
| Sensitive env vars | Stored in environment variables; never hardcoded |
| PHI field-level encryption | AES-256-GCM for fields requiring extra protection (e.g., SSN) |

---

## Phase 3: Development

### 3.1 Secure Coding Standards

#### Input Validation
- All user-supplied input must be validated server-side using Joi schemas before processing.
- Frontend validation is UX-only and must not be relied upon for security.
- SQL queries must use parameterised queries via `node-postgres` (`$1, $2` placeholders). Raw string concatenation into SQL is prohibited.
- File uploads via multer must validate file type (MIME type + magic bytes), enforce size limits, and store files outside the web root or in an isolated object store.

#### Output Encoding
- All data rendered in React components must rely on React's built-in XSS protection (no `dangerouslySetInnerHTML` with user-controlled content).
- API responses must set `Content-Type: application/json` and must not reflect user input in error messages.

#### Authentication & Authorisation
- Every route handler must invoke the authentication middleware (`verifyToken`) and the appropriate RBAC check (`requireRole`, `requirePermission`) before executing business logic.
- Authorisation checks must be re-evaluated on every request, not cached in session.
- Password reset tokens must be single-use, time-limited (≤ 1 hour), and stored as hashed values.

#### Secrets Management
- Secrets (DB connection strings, API keys, JWT secrets) must be stored in environment variables only.
- `.env` files must never be committed to version control. `.env.example` with placeholder values is the committed reference.
- The `.gitignore` must include `.env`, `.env.local`, `.env.production`.
- Rotate secrets immediately upon any suspected exposure.

#### Dependency Management
- All new dependencies must be reviewed for: active maintenance, known CVEs (check `npm audit`), licence compatibility, and necessity (avoid adding heavy packages for trivial tasks).
- Lock file (`package-lock.json`) must be committed and kept up to date.

#### Logging & Audit Trail
- All state-changing operations on PHI must generate an audit log entry via the audit service (`backend/routes/audit.js`).
- Audit logs must include: user ID, organisation ID, action type, target resource, timestamp, and IP address.
- Logs must never contain plaintext PHI or passwords.
- Server-side errors must be logged via Winston with severity, stack trace, and request context.

### 3.2 Prohibited Patterns

The following patterns are prohibited and will block code review approval:

| Pattern | Risk |
|---|---|
| Raw SQL string concatenation | SQL Injection |
| `eval()` or `Function()` on user input | Remote Code Execution |
| `dangerouslySetInnerHTML` with user data | XSS |
| Hardcoded credentials or API keys | Credential exposure |
| Logging PHI or passwords | Data exposure in logs |
| Disabling Helmet middleware or CORS | Security header bypass |
| Skipping authentication on any non-public route | Unauthorised access |
| Returning stack traces to clients in production | Information disclosure |
| Direct object references without ownership check | IDOR / broken access control |

### 3.3 Git Workflow & Branch Protection

- All development occurs on feature branches (`feature/`, `fix/`, `chore/`).
- `main` and `master` branches are protected: direct pushes are prohibited.
- All changes require a Pull Request with at least one peer review approval before merging.
- Commit messages must describe the change clearly and reference the issue number.
- Force-push to shared branches is prohibited.

---

## Phase 4: Security Review & Code Review

### 4.1 Peer Code Review — Security Checklist

Every Pull Request reviewer must verify the following:

**Authentication & Authorisation**
- [ ] New routes have authentication and RBAC checks.
- [ ] Ownership/tenancy is verified before returning or modifying data.
- [ ] No role bypass is possible through parameter manipulation.

**Input Handling**
- [ ] All inputs are validated with Joi schemas.
- [ ] SQL uses parameterised queries.
- [ ] File uploads are type/size validated.

**Data Exposure**
- [ ] API responses exclude unneeded sensitive fields.
- [ ] Error messages are generic to the client.
- [ ] Logs do not contain PHI or credentials.

**Secrets & Config**
- [ ] No hardcoded secrets or credentials.
- [ ] `.env` files are not committed.

**Audit & Compliance**
- [ ] PHI-touching operations write audit log entries.
- [ ] New integrations have BAA confirmation in the PR description.

### 4.2 Security-Focused Code Review (Senior / Security Engineer)

For changes rated **High Risk** (new auth flows, new PHI endpoints, third-party integrations, permission changes), a dedicated security-focused review is required from the security lead or a senior engineer. This review must address:

- STRIDE threat model verification.
- OWASP Top 10 applicability.
- HIPAA minimum necessary principle adherence.
- Regression risk to existing security controls.

### 4.3 Static Application Security Testing (SAST)

SAST tools are integrated into the CI pipeline and run on every Pull Request:

| Tool | Purpose |
|---|---|
| `npm audit` | Dependency vulnerability scanning |
| ESLint with `eslint-plugin-security` | JavaScript security anti-pattern detection |
| Semgrep (recommended addition) | Custom rule-based SAST for healthcare-specific patterns |
| `gitleaks` / `trufflehog` | Secret scanning in commit history |

PR merges are blocked if `npm audit` reports High or Critical severity vulnerabilities that are not explicitly waived with a documented rationale.

---

## Phase 5: Testing

### 5.1 Security Testing Requirements

| Test Type | Scope | Frequency | Owner |
|---|---|---|---|
| Unit tests | Auth middleware, validation logic, RBAC rules | Every PR | Developer |
| Integration tests | API endpoint auth, multi-tenant isolation, FHIR validation | Every PR | Developer / QA |
| DAST (OWASP ZAP) | Full API surface, OWASP Top 10 | Every release candidate | Security / QA |
| Penetration test | Full application, infrastructure | Annually + after major changes | External party |
| Dependency audit | `npm audit` | Every PR + weekly scheduled run | CI/CD |
| Secret scanning | Full commit history | Every PR | CI/CD |

### 5.2 Mandatory Test Cases for PHI-Touching Features

Every feature that creates, reads, updates, or deletes PHI must have automated tests covering:

1. **Unauthenticated access** — verify 401 is returned.
2. **Authenticated but unauthorised role** — verify 403 is returned.
3. **Cross-tenant access** — verify that user from Organisation A cannot access Organisation B's data.
4. **Input boundary conditions** — verify SQL injection payloads and oversized inputs are rejected.
5. **Audit log generation** — verify the audit log entry is created with correct fields.

### 5.3 Penetration Testing Scope

Annual penetration tests must cover:

- Authentication and session management (JWT, OAuth, MFA bypass).
- Vertical and horizontal privilege escalation.
- IDOR on patient records, clinical notes, prescriptions, billing records.
- SQL injection across all parameterised and JSONB query paths.
- XSS in patient portal and form management.
- FHIR endpoint authorisation.
- File upload security (malware upload, path traversal).
- Rate limiting bypass.
- Multi-tenant data isolation.

Findings are tracked in the security register. Critical findings block deployment until remediated. High findings must be remediated within 7 days.

---

## Phase 6: Build & CI/CD Security

### 6.1 Pipeline Security Controls

The CI/CD pipeline (GitHub Actions / Vercel) must enforce:

| Control | Implementation |
|---|---|
| Dependency vulnerability scan | `npm audit --audit-level=high` — fails build on High/Critical |
| Secret scanning | `gitleaks` scan on every push |
| SAST | ESLint security rules — fails build on violations |
| Build reproducibility | Lockfile committed; `npm ci` used (not `npm install`) in CI |
| Environment separation | Dev, staging, production use separate environment configurations and credentials |
| Artefact integrity | Build artefacts are not modified post-build; checksums verified before deployment |

### 6.2 Environment & Secrets Configuration

| Environment | Secret Store | Access |
|---|---|---|
| Development | Local `.env` (not committed) | Developer machine only |
| Staging | Vercel environment variables (staging scope) | CI/CD pipeline + authorised engineers |
| Production | Vercel environment variables (production scope) | CI/CD pipeline + on-call engineers |

Production secrets must not be accessible to developers in day-to-day work. Access requires break-glass procedure with audit logging.

### 6.3 Deployment Gates

The following gates must pass before a build is promoted to production:

1. All CI checks green (SAST, lint, unit tests, integration tests).
2. Peer code review approved.
3. Security-focused review approved (for High Risk changes).
4. `npm audit` — no unwaived High/Critical findings.
5. Secret scan — no new secrets detected.
6. For major releases: DAST scan results reviewed and Critical/High findings resolved.

---

## Phase 7: Deployment & Operations

### 7.1 Infrastructure Hardening

| Component | Control |
|---|---|
| Vercel deployment | HTTPS enforced; security headers via `vercel.json` (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`) |
| Supabase PostgreSQL | Row-Level Security (RLS) enabled on PHI tables; direct public access disabled; connection via pooler only |
| Redis | Password-authenticated; not exposed to public internet; used for session revocation and rate-limit counters |
| CORS | Allowlist of known origins; credentials mode enabled only for authenticated endpoints |
| Helmet.js | Enabled in all environments; `contentSecurityPolicy` configured to restrict script sources |
| Rate limiting | Global rate limit on all `/api/` routes; stricter limits on auth endpoints (`/api/auth/login`, `/api/auth/reset-password`) |

### 7.2 Security Headers (vercel.json)

The following security headers must be present on all responses:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'nonce-{NONCE}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.supabase.co wss:; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

### 7.3 Monitoring & Alerting

| Signal | Tool / Method | Alert Threshold |
|---|---|---|
| Authentication failures | Winston logs → SIEM | > 10 failures in 5 min for same IP or user |
| Unauthorised access attempts (403) | Application logs | > 50 in 5 min |
| Database errors | pg error events → Winston | Any error in production |
| Audit log gaps | Scheduled integrity check | Missing entries for PHI-touching operations |
| Dependency CVEs | `npm audit` weekly run | Any new High/Critical |
| Uptime / availability | Health check endpoint `/health` | Any downtime > 1 min |

### 7.4 Incident Response

Upon detection of a security incident:

1. **Contain** — Isolate affected systems; revoke compromised credentials immediately.
2. **Assess** — Determine scope: was PHI accessed or exfiltrated?
3. **Notify** — If PHI is involved, HIPAA Breach Notification Rule requires notification:
   - Affected individuals: within 60 days of discovery.
   - HHS Secretary: within 60 days (> 500 affected) or annually (< 500).
   - Media: within 60 days if > 500 affected in a state.
4. **Remediate** — Fix the root cause; deploy patch via emergency change process.
5. **Post-Incident Review** — Document timeline, impact, root cause, and corrective actions within 5 business days.

Incident response contacts and escalation paths are maintained in the internal runbook.

---

## Phase 8: Maintenance & Continuous Improvement

### 8.1 Vulnerability Management

| Severity | Response SLA |
|---|---|
| Critical (CVSS ≥ 9.0) | Patch or mitigate within 24 hours |
| High (CVSS 7.0–8.9) | Patch or mitigate within 7 days |
| Medium (CVSS 4.0–6.9) | Patch within 30 days |
| Low (CVSS < 4.0) | Address in next planned release cycle |

Vulnerabilities are tracked in the security register with assigned owner, target date, and status.

### 8.2 Dependency Updates

- Weekly: automated `npm audit` run via CI scheduled workflow; results reviewed by engineering lead.
- Monthly: review `npm outdated` output; update non-breaking minor/patch versions.
- Quarterly: assess major version upgrades for key dependencies (Express, React, pg, jwt, etc.).
- Immediate: critical security patches applied out-of-cycle regardless of schedule.

### 8.3 Access Review

| Review | Frequency |
|---|---|
| User account review (staff, providers) | Quarterly |
| Role and permission assignments | Quarterly |
| Service account and API key inventory | Semi-annually |
| Privileged access (admin, super-admin) | Monthly |
| Third-party integration credentials | Annually or on personnel change |

Terminated employees and contractors must have access revoked within 4 hours of offboarding notification.

### 8.4 Security Training

| Role | Training Required | Frequency |
|---|---|---|
| All engineers | OWASP Top 10, secure coding basics, HIPAA awareness | Annually |
| Senior / security engineers | Threat modelling, penetration testing concepts, incident response | Annually |
| Newly onboarded developers | SSDLC orientation, codebase security controls | Before first commit |
| Product / QA | HIPAA basics, PHI handling, security testing overview | Annually |

### 8.5 SSDLC Continuous Improvement

The SSDLC is reviewed and updated:

- **Annually:** Full review by engineering lead, security lead, and compliance.
- **After any security incident:** Incorporate lessons learned.
- **After penetration test:** Address process gaps identified.
- **When new regulatory requirements apply:** Update affected phases.

---

## Appendix A: Risk Classification for Features

Use the following table to determine the level of security scrutiny required for a given change:

| Risk Level | Criteria | Required Activities |
|---|---|---|
| **Critical** | Auth flows, PHI bulk export, payment processing, FHIR external disclosure | Threat model, dedicated security review, DAST before release, pen test scope inclusion |
| **High** | New PHI endpoints, new roles/permissions, third-party integrations, file handling | Threat model, security-focused peer review, integration tests with auth/authz cases |
| **Medium** | Changes to existing endpoints, UI changes touching PHI display, config changes | Standard peer review with security checklist, unit tests |
| **Low** | Documentation, styling, non-PHI UI, test code | Standard peer review |

---

## Appendix B: OWASP Top 10 Mapping

| OWASP Risk | AureonCare Mitigation |
|---|---|
| A01 Broken Access Control | RBAC middleware, tenant-scoped queries, ownership checks, IDOR test cases |
| A02 Cryptographic Failures | TLS 1.2+, bcrypt, AES-256 at rest, no PHI in logs |
| A03 Injection | Parameterised SQL (pg), Joi validation, no `eval()` |
| A04 Insecure Design | Threat modelling, security requirements in tickets, secure design principles |
| A05 Security Misconfiguration | Helmet.js, CORS allowlist, environment-separated secrets, no debug in production |
| A06 Vulnerable Components | `npm audit` in CI, weekly dependency review, SLA-based patching |
| A07 Auth & Session Failures | JWT with expiry, bcrypt, MFA (speakeasy), OAuth PKCE, Redis revocation list |
| A08 Software & Data Integrity | Lockfile committed, `npm ci` in CI, artefact checksums |
| A09 Logging & Monitoring | Winston logging, audit trail, SIEM alerting, incident response plan |
| A10 SSRF | Allowlisted outbound HTTP targets; validate URLs for webhook/integration endpoints |

---

## Appendix C: HIPAA Security Rule Control Mapping

| HIPAA Safeguard | Control Reference |
|---|---|
| Access Control (§164.312(a)(1)) | RBAC, least privilege, unique user IDs |
| Audit Controls (§164.312(b)) | Comprehensive audit logging (see `backend/routes/audit.js`) |
| Integrity Controls (§164.312(c)(1)) | Checksums, TLS, parameterised queries |
| Transmission Security (§164.312(e)(1)) | TLS 1.2+, HTTPS enforced |
| Person Authentication (§164.312(d)) | JWT, MFA, password policy |
| Automatic Logoff (§164.312(a)(2)(iii)) | Token expiry (15 min access, 7-day refresh) |
| Encryption of PHI at Rest (§164.312(a)(2)(iv)) | Supabase TDE, field-level encryption for sensitive fields |
| Workstation Security (§164.310(c)) | Covered by endpoint management policy (separate document) |
| Business Associate Agreements (§164.308(b)) | BAA required before any third-party PHI processing |

---

*This document is owned by the Engineering & Compliance teams. Questions or proposed changes should be raised via a Pull Request to this file.*
