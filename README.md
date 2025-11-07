# MedFlow

**Modern Healthcare Practice Management System**

MedFlow is a comprehensive, enterprise-grade medical practice management platform designed to streamline healthcare operations, enhance patient care, and optimize revenue cycles. Built with modern web technologies and HIPAA compliance in mind.

---

## Table of Contents

- [Overview](#overview)
- [Key Highlights](#key-highlights)
- [Core Features](#core-features)
- [Technical Architecture](#technical-architecture)
- [Getting Started](#getting-started)
- [Security & Compliance](#security--compliance)
- [License](#license)

---

## Overview

MedFlow is an all-in-one healthcare management solution that combines Electronic Health Records (EHR), Practice Management, Revenue Cycle Management (RCM), Telehealth, and Patient Engagement tools into a single, integrated platform. Designed for healthcare practices of all sizes, from solo practitioners to large multi-specialty groups.

### Built For

- Private Medical Practices
- Multi-Specialty Clinics
- Healthcare Groups
- Telehealth Providers
- Ambulatory Care Centers

---

## Key Highlights

- ✅ **FHIR R4 Compliant** - Full interoperability support
- ✅ **HIPAA Ready** - Built with security and compliance in mind
- ✅ **Multi-Language Support** - 8 languages (EN, ES, FR, DE, PT, ZH, AR, HI)
- ✅ **Cloud-Based** - Accessible anywhere, anytime
- ✅ **Role-Based Access Control** - Granular permissions system
- ✅ **Flexible Subscription Plans** - Free to Enterprise tiers
- ✅ **Modern UI/UX** - Responsive design with dark mode
- ✅ **Real-Time Updates** - Live notifications and updates

---

## Core Features

### 1. 🔐 Authentication & User Management

**Advanced Authentication**
- Email/password authentication with bcrypt encryption
- OAuth social login (Google, Microsoft, Facebook)
- Password reset flow with secure tokens (1-hour expiration)
- Session management and tracking
- Two-portal system (Staff Portal + Patient Portal)

**User Management**
- Complete user lifecycle management (CRUD operations)
- Multiple user roles: Admin, Doctor, Patient, Nurse, Receptionist, Billing Manager, CRM Manager, Staff
- User status control (Active, Pending, Blocked)
- Avatar support and user preferences
- License number and specialty tracking
- Multi-language user preferences

### 2. 🛡️ Role-Based Access Control (RBAC)

**Comprehensive Permission System**
- 8 predefined system roles (cannot be deleted)
- Custom role creation and management
- 24 granular permissions across modules
- Multi-role support (users can have multiple roles simultaneously)
- Active role switching
- Role assignment history and tracking
- Module-based permissions: Patients, Appointments, Billing, CRM, EHR, Reports, Admin
- Action-based permissions: View, Create, Edit, Delete, Manage, Process, Export

**Role Management Features**
- Role activation/deactivation
- Role user count tracking
- Role permission count tracking
- Cannot remove last role from user (safety check)

### 3. 💼 Subscription Plans & Organization Settings

**Flexible Subscription Tiers**
- **Free Plan** - Get started with basic features
- **Starter Plan** - Essential features for small practices
- **Professional Plan** - Advanced features for growing practices
- **Enterprise Plan** - Complete feature set for large organizations

**Plan Management**
- User and patient limits per plan
- Feature gates and access control
- Billing cycle management (monthly/yearly)
- Auto-renewal settings
- Plan comparison and upgrades
- Usage tracking and limits enforcement

**Organization Settings**
- Custom organization configuration
- Plan assignment and tracking
- Plan start/end date management
- Flexible settings stored as JSONB

### 4. 👥 Patient Management

**Comprehensive Patient Records**
- Complete demographics (name, DOB, gender, contact info)
- Unique Medical Record Number (MRN)
- Address management (street, city, state, zip)
- Insurance information (carrier, policy ID)
- Patient status tracking (Active, Inactive)

**Medical Profile**
- Height and weight tracking
- Blood type
- Allergies documentation
- Past medical history
- Family history
- Current medications list
- Automatic patient portal account creation

**Patient Search & Filtering**
- Advanced search capabilities
- Status-based filtering
- Quick patient lookup

### 5. 📅 Appointment Management

**Smart Scheduling**
- Complete appointment lifecycle management
- Patient-provider association
- Multiple appointment types
- Date and time scheduling with duration tracking
- Start time and end time management
- Appointment reason and notes

**Scheduling Intelligence**
- Double-booking prevention
- Scheduling conflict detection
- Multiple view types (list, calendar)
- Calendar views (day, week, month)
- Provider-specific scheduling

**Appointment Status**
- Scheduled
- Completed
- Cancelled
- No-Show

### 6. 👨‍⚕️ Provider Management

**Provider Directory**
- Provider CRUD operations
- Specialization tracking
- Contact information management
- Provider-user linking
- Active provider filtering
- Provider association with appointments
- License number and credentials

### 7. 📋 Electronic Health Records (EHR)

**Medical Records Management**
- Complete medical record lifecycle
- Record types categorization
- Record date tracking
- Title and description
- Diagnosis information
- Treatment plans
- Medications tracking (structured JSONB)
- Attachments support
- Provider association
- Complete patient history view

**Prescriptions Module**
- Prescription CRUD operations
- Medication name and dosage
- Frequency and duration
- Special instructions
- Refill tracking
- Prescription status (Active, Inactive, Discontinued)
- Prescribed date tracking
- Provider and patient association
- Appointment linkage

**Diagnosis Module**
- Diagnosis CRUD operations
- ICD diagnosis codes support
- Diagnosis name and description
- Severity levels
- Status tracking (Active, Resolved, Chronic)
- Diagnosed date
- Clinical notes
- Provider and patient association
- Appointment linkage

### 8. 🎥 Telehealth

**Integrated Video Consultations**
- Telehealth session management
- Virtual room creation with unique IDs
- Secure meeting URL generation
- Session status tracking (Scheduled, In Progress, Completed, Cancelled)
- Start and end time tracking
- Duration tracking
- Recording capability toggle
- Recording URL storage
- Participant tracking
- Join session functionality
- Session notes
- Provider and patient association
- Appointment integration

### 9. 💰 Revenue Cycle Management (RCM)

**Claims Management**
- Complete claims lifecycle management
- Unique claim numbers
- Patient and payer association
- Amount tracking
- Service date tracking
- Diagnosis codes support (JSONB)
- Procedure codes support (JSONB)
- Claim status (Pending, Submitted, Approved, Denied, Paid)
- Claim notes and documentation

**Payment Processing**
- Payment CRUD operations
- Unique payment numbers
- Multiple payment methods:
  - Credit Card
  - Debit Card
  - Cash
  - Check
  - Bank Transfer
  - Insurance
- Payment status tracking (Pending, Completed, Failed, Refunded)
- Transaction ID storage
- Card information storage (last 4 digits, brand)
- Payment date tracking
- Patient and claim association
- Payment descriptions and notes

### 10. 🔄 FHIR HL7 Integration

**FHIR R4 Compliance**
- FHIR resource CRUD operations
- FHIR R4 standard compliance
- Resource types support: Patient, Observation, Condition, etc.
- Patient to FHIR conversion
- Resource data stored as JSONB
- Patient-resource association
- FHIR bundle generation
- Resource versioning with timestamps
- FHIR sync functionality

**Interoperability**
- Standards-based data exchange
- External system connectivity
- Healthcare data integration

### 11. 🏥 Patient Portal

**Patient Self-Service Features**
- Dedicated patient portal authentication
- Patient login with email/password
- Social login support for patients
- Session token management (24-hour expiration)
- Portal enable/disable per patient
- Patient registration

**Patient Portal Capabilities**
- View appointments
- View medical records
- Profile management
- View prescriptions
- View diagnosis information
- Secure messaging (framework ready)

**Security Features**
- IP address tracking
- User agent tracking
- Session management
- Secure token-based authentication

### 12. 🔔 Notifications

**Real-Time Notification System**
- Notification CRUD operations
- Multiple notification types
- Read/unread status tracking
- Timestamp tracking
- Mark as read functionality
- Clear individual notifications
- Clear all notifications
- Latest 50 notifications display
- Real-time notification delivery

### 13. ✅ Tasks & Workflow

**Task Management**
- Task CRUD operations
- Task title and description
- Priority levels:
  - High
  - Medium
  - Low
- Due date tracking
- Status tracking:
  - Pending
  - In Progress
  - Completed
  - Cancelled
- Priority-based sorting
- Task completion tracking

### 14. 📊 Reports & Analytics

**Reporting Module**
- Revenue reports
- Appointment analytics
- Patient statistics
- Claims analytics
- Report export capability
- Date range filtering
- Multiple report formats
- Performance metrics
- Trend analysis

### 15. 🤝 Customer Relationship Management (CRM)

**CRM Features**
- Customer interaction tracking
- CRM record management
- Customer data management
- CRM permissions system
- Integration with patient data
- Communication history
- Relationship tracking

### 16. 🔌 Integrations

**Integration Hub**
- FHIR HL7 integration
- OAuth provider integration:
  - Google
  - Microsoft
  - Facebook
- Social authentication
- API integration framework
- External system connectivity
- Third-party service integration

### 17. ⚙️ Admin Panel

**Administrative Features**
- User management interface
- Role management
- Permission management
- Plan management
- Organization settings
- User status control
- User role assignment
- Bulk operations
- System configuration
- Plan selection and upgrades

**System Management**
- Health check endpoints
- Database management
- Migration tools
- Seed data scripts
- System monitoring

### 18. 🎨 UI/UX Features

**Modern Interface**
- Dark mode / Light mode toggle
- Multi-language support (8 languages)
- Responsive design
- Mobile-friendly interface
- Quick actions dashboard
- Customizable quick actions
- Stat cards with trend indicators
- Module cards

**Dashboard Components**
- Today's appointments counter
- Pending tasks counter
- Total patients counter
- Monthly revenue counter
- Upcoming appointments list
- Recent tasks list
- Revenue quick view
- Patients quick view

**UI Components**
- Search functionality
- AI Assistant panel (framework)
- Notifications panel
- Settings modal
- User profile modal
- Confirmation modals
- View/Edit modals
- Form modals for data entry
- Calendar views (day, week, month)
- List views
- Quick view panels

### 19. 🔒 Security & Compliance

**Security Features**
- Password hashing with bcrypt
- JWT token support
- Session management
- HIPAA compliance indicators
- Role-based access control
- Permission checking
- Password reset tokens with expiration
- Secure API endpoints
- CORS configuration
- Helmet security headers
- SQL injection prevention (parameterized queries)

**Audit & Tracking**
- Created_at timestamps on all records
- Updated_at timestamps on all records
- User activity tracking
- Role assignment tracking
- Last login tracking
- Portal session tracking with IP/user agent
- Complete audit trail

### 20. 🗄️ Database Architecture

**PostgreSQL Database**
- UUID support for record IDs
- JSONB for flexible data storage
- Foreign key constraints
- Cascade delete configurations
- Indexes for performance optimization
- Multi-role user support
- Historical data preservation
- Data integrity enforcement

**20+ Database Tables:**
- users
- patients
- providers
- appointments
- claims
- payments
- prescriptions
- diagnosis
- medical_records
- telehealth_sessions
- fhir_resources
- patient_portal_sessions
- social_auth
- notifications
- tasks
- roles
- permissions
- role_permissions
- user_roles
- subscription_plans
- organization_settings

### 21. 🚀 API Architecture

**RESTful API Design**
- 100+ API endpoints
- Consistent error handling
- Snake_case to camelCase conversion
- Query parameter support
- Filtering capabilities
- Sorting capabilities
- Relationship loading (JOIN queries)
- Validation
- Standard HTTP status codes
- JSON response format

---

## Technical Architecture

### Backend Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Direct SQL queries with node-postgres
- **Authentication**: bcrypt, JWT, OAuth 2.0
- **Security**: Helmet, CORS

### Frontend Stack
- **Framework**: React
- **Build Tool**: Modern bundler
- **UI Components**: Custom component library
- **State Management**: Context API ready
- **Styling**: Modern CSS with theming

### Infrastructure
- **Cloud-Ready**: Designed for cloud deployment
- **Scalable**: Modular architecture
- **Real-Time Ready**: Redis configured for real-time features
- **Multi-Tenant**: Organization-based data isolation

---

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/rajbizchannels/MedFlow.git
cd MedFlow
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database
```bash
npm run db:setup
```

5. Run migrations
```bash
npm run migrate
```

6. Start the development server
```bash
npm run dev
```

### Configuration

MedFlow requires the following environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `OAUTH_*` - OAuth provider credentials
- `PORT` - Server port (default: 3000)

---

## Security & Compliance

### HIPAA Compliance
- Encrypted data transmission (HTTPS)
- Encrypted data at rest
- Access control and authentication
- Audit logging
- Session management
- Secure password handling

### Data Protection
- Role-based access control
- Permission-based authorization
- Audit trails for all actions
- Secure session management
- Password policies
- Data encryption

### Privacy
- Patient data isolation
- Configurable data retention
- Secure patient portal
- Privacy controls
- Consent management ready

---

## System Capabilities

### Multi-Tenancy
- Organization-based data isolation
- Plan-based feature gates
- Resource limits per organization
- Usage tracking and enforcement

### Scalability
- Modular architecture
- Separated concerns
- Horizontal scaling ready
- Database optimization
- Caching support (Redis)

### Extensibility
- Plugin-style module system
- Plan-based feature gates
- API-first design
- Integration framework
- Custom field support (JSONB)

### Standards Compliance
- FHIR R4 for interoperability
- HL7 integration support
- ICD code support
- RESTful API design
- OAuth 2.0 authentication

---

## Support & Documentation

For detailed documentation, please visit:
- API Documentation: `/api/docs`
- User Guide: Coming soon
- Developer Guide: Coming soon

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

---

## License

[License details to be added]

---

## Contact

For questions and support, please contact:
- Email: support@medflow.com
- Website: https://medflow.com
- GitHub Issues: https://github.com/rajbizchannels/MedFlow/issues

---

**MedFlow** - Empowering Healthcare Practices with Modern Technology

---

*Built with ❤️ for Healthcare Professionals*
