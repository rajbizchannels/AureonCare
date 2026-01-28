# AureonCare Multi-Tenant Edition

**Enterprise-Grade Multi-Tenant Healthcare Practice Management Platform**

AureonCare Multi-Tenant is designed for SaaS deployments, enabling multiple healthcare organizations to operate on a single platform with complete data isolation, custom branding, and independent configuration.

---

## Multi-Tenant Features

### Complete Tenant Isolation
- Row-level security ensuring complete data separation
- Per-tenant database schemas (optional)
- No cross-tenant data access possible
- Isolated session management

### Per-Tenant Customization
- **Branding**: Logo, colors, fonts, custom domain/subdomain
- **Settings**: Working hours, appointment types, notification preferences
- **Security**: Password policies, MFA requirements, IP whitelisting
- **Features**: Enable/disable modules based on subscription plan
- **Workflows**: Custom automation rules per tenant

### Subscription & Billing
| Plan | Users | Patients | Monthly | Key Features |
|------|-------|----------|---------|--------------|
| Free | 2 | 100 | $0 | Basic EHR, Patient Portal |
| Starter | 10 | 1,000 | $99 | Telehealth, eRx, CRM |
| Professional | 50 | 10,000 | $299 | FHIR, EDI 835/837, API Access |
| Enterprise | Unlimited | Unlimited | $799 | SSO, White-label, Dedicated Support |

### Security & Compliance
- HIPAA-compliant comprehensive audit logging
- PHI (Protected Health Information) access tracking
- Session management with device tracking
- Role-based access control per tenant
- API key management with granular scopes
- MFA enforcement options
- Password policy configuration

### Governance & Administration
- Central admin console for platform management
- Tenant provisioning and lifecycle management
- Compliance report generation (HIPAA, PHI disclosure)
- Security event monitoring and alerting
- Usage tracking and billing automation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Central Admin Console                          │
│    (Platform administrators, tenant provisioning, billing)          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Tenant A     │     │    Tenant B     │     │    Tenant C     │
│   (Clinic X)    │     │  (Hospital Y)   │     │  (Practice Z)   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Own users     │     │ • Own users     │     │ • Own users     │
│ • Own patients  │     │ • Own patients  │     │ • Own patients  │
│ • Own config    │     │ • Own config    │     │ • Own config    │
│ • Own branding  │     │ • Own branding  │     │ • Own branding  │
│ • Own roles     │     │ • Own roles     │     │ • Own roles     │
│ • Own audit log │     │ • Own audit log │     │ • Own audit log │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/AureonCare-MultiTenant.git
   cd AureonCare-MultiTenant
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   cd backend && npm install && cd ..
   ```

3. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your database credentials
   ```

4. **Run database migrations**
   ```bash
   # Create database
   psql -U postgres -c "CREATE DATABASE aureoncare_mt;"

   # Run base schema
   psql -d aureoncare_mt -f backend/schema.sql

   # Run multi-tenant migrations
   psql -d aureoncare_mt -f backend/multitenancy/migrations/001_tenant_management_schema.sql
   psql -d aureoncare_mt -f backend/multitenancy/migrations/002_add_tenant_columns.sql
   ```

5. **Start the application**
   ```bash
   npm start
   ```

### Default Credentials
- **Platform Admin**: admin@aureoncare.com / Admin123!

---

## API Documentation

### Tenant Resolution
Tenants are resolved via (in priority order):
1. JWT token (contains tenantId)
2. `X-Tenant-ID` header
3. `X-Tenant-Code` header
4. Subdomain (e.g., `clinic-x.aureoncare.com`)
5. Custom domain

### Central Admin API Endpoints
```
POST   /api/tenant-admin/auth/login           - Admin login
GET    /api/tenant-admin/tenants              - List all tenants
POST   /api/tenant-admin/tenants              - Create tenant
GET    /api/tenant-admin/tenants/:id          - Get tenant details
PUT    /api/tenant-admin/tenants/:id          - Update tenant
POST   /api/tenant-admin/tenants/:id/suspend  - Suspend tenant
POST   /api/tenant-admin/tenants/:id/reactivate - Reactivate tenant
POST   /api/tenant-admin/tenants/:id/terminate  - Terminate tenant
GET    /api/tenant-admin/tenants/:id/statistics - Get tenant stats
GET    /api/tenant-admin/tenants/:id/audit-logs - Get audit logs
GET    /api/tenant-admin/statistics           - Platform-wide stats
GET    /api/tenant-admin/plans                - List subscription plans
```

### Tenant-Specific API Endpoints
```
GET    /api/tenant/info                       - Get tenant info
GET    /api/tenant/branding                   - Get branding config
PUT    /api/tenant/branding                   - Update branding
GET    /api/tenant/settings                   - Get all settings
PUT    /api/tenant/settings                   - Update settings
GET    /api/tenant/users                      - List tenant users
POST   /api/tenant/users                      - Add user to tenant
PUT    /api/tenant/users/:id                  - Update user access
DELETE /api/tenant/users/:id                  - Remove user
GET    /api/tenant/roles                      - List roles
POST   /api/tenant/roles                      - Create custom role
PUT    /api/tenant/roles/:id                  - Update role
GET    /api/tenant/subscription               - Get subscription
POST   /api/tenant/subscription/change-plan   - Change plan
GET    /api/tenant/invoices                   - List invoices
GET    /api/tenant/usage                      - Get usage stats
GET    /api/tenant/audit-logs                 - View audit logs
GET    /api/tenant/api-keys                   - List API keys
POST   /api/tenant/api-keys                   - Create API key
POST   /api/tenant/api-keys/:id/revoke        - Revoke API key
```

---

## Database Schema

### Tenant Management Tables
| Table | Description |
|-------|-------------|
| `tenants` | Master tenant registry with config |
| `tenant_administrators` | Platform admin accounts |
| `tenant_users` | User-tenant associations |
| `tenant_subscriptions` | Active subscriptions |
| `tenant_subscription_plans` | Available subscription plans |
| `tenant_invoices` | Billing invoices |
| `tenant_payment_methods` | Stored payment methods |
| `tenant_usage` | Resource usage tracking |
| `tenant_audit_logs` | Comprehensive audit trail |
| `tenant_security_events` | Security incident log |
| `tenant_compliance_reports` | Generated reports |
| `tenant_settings` | Per-tenant configuration |
| `tenant_custom_fields` | Extensible entity fields |
| `tenant_roles` | Custom roles per tenant |
| `tenant_permission_definitions` | Available permissions |
| `tenant_api_keys` | API access management |
| `tenant_sessions` | Active session tracking |
| `tenant_integrations` | Third-party integrations |
| `tenant_webhooks` | Outgoing webhook config |

---

## Compliance

### HIPAA Compliance Features
- All PHI access logged with user, timestamp, IP, and reason
- Audit logs retained for 7 years (configurable)
- Encryption at rest and in transit
- Session timeout enforcement
- Access control audit reports
- Automatic BAA tracking per tenant

### Data Retention
- Configurable retention policies per tenant
- Automatic data archival
- Compliance report generation on demand
- Data export for portability

---

## Core Features (Inherited from AureonCare)

- Electronic Health Records (EHR)
- Practice Management
- Revenue Cycle Management (RCM)
- Telehealth Integration
- FHIR R4 Interoperability
- Patient Portal
- E-Prescriptions
- Claims Processing
- Role-Based Access Control
- Multi-Language Support (8 languages)

---

## Technical Stack

### Backend
- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: PostgreSQL 12+
- **Authentication**: JWT with tenant context
- **Security**: Helmet, CORS, bcrypt

### Frontend
- **Framework**: React 18+
- **State**: React Context + TenantContext
- **Styling**: Tailwind CSS
- **Build**: Modern bundler

---

## Support

For enterprise support and custom deployments:
- Email: enterprise@aureoncare.com
- Documentation: /docs

---

## License

Proprietary - All rights reserved

---

**AureonCare Multi-Tenant** - Enterprise Healthcare SaaS Platform

*Empowering Healthcare Organizations at Scale*
