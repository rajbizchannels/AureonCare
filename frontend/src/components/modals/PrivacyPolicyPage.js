import React, { useState } from 'react';
import { X, Shield, ChevronDown, ChevronRight, Lock, Eye, FileText, Users, Globe, Trash2, Download, AlertCircle, Mail } from 'lucide-react';

const EFFECTIVE_DATE = 'February 28, 2026';
const LAST_UPDATED = 'February 28, 2026';
const CONTACT_EMAIL = 'privacy@aureoncare.com';
const CONTACT_ADDRESS = 'AureonCare, Inc., Privacy Office, 123 Healthcare Blvd, Suite 400, San Francisco, CA 94105';
const DPO_EMAIL = 'dpo@aureoncare.com';
const HIPAA_PRIVACY_OFFICER = 'privacy@aureoncare.com';

const Section = ({ title, icon: Icon, children, theme, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
      <button
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
          theme === 'dark'
            ? 'bg-slate-800 hover:bg-slate-750 text-white'
            : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open
          ? <ChevronDown className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`} />
          : <ChevronRight className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`} />
        }
      </button>
      {open && (
        <div className={`px-5 py-4 text-sm leading-relaxed space-y-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
          {children}
        </div>
      )}
    </div>
  );
};

const PrivacyPolicyPage = ({ theme, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${
          theme === 'dark'
            ? 'bg-slate-900 border-slate-700'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-start justify-between px-6 py-5 border-b flex-shrink-0 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Privacy Policy &amp; HIPAA Notice of Privacy Practices
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                Effective: {EFFECTIVE_DATE} &nbsp;&bull;&nbsp; Last updated: {LAST_UPDATED}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ml-4 ${
              theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto px-6 py-5 flex-1">

          {/* Intro banner */}
          <div className={`rounded-xl p-4 mb-5 flex gap-3 ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
            <AlertCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <p className={`text-sm ${theme === 'dark' ? 'text-purple-300' : 'text-purple-800'}`}>
              AureonCare is committed to protecting your privacy and safeguarding your protected health information (PHI) in compliance with the <strong>Health Insurance Portability and Accountability Act (HIPAA)</strong> and the <strong>General Data Protection Regulation (EU/UK GDPR)</strong>. Please read this notice carefully.
            </p>
          </div>

          {/* ── 1. Who We Are ── */}
          <Section title="1. Who We Are (Data Controller)" icon={Users} theme={theme} defaultOpen>
            <p>
              <strong>AureonCare, Inc.</strong> ("AureonCare," "we," "us," or "our") is the data controller and a HIPAA-covered business associate for the personal and health information processed through this platform.
            </p>
            <p><strong>Privacy / HIPAA Privacy Officer:</strong> <a href={`mailto:${HIPAA_PRIVACY_OFFICER}`} className="text-purple-500 hover:underline">{HIPAA_PRIVACY_OFFICER}</a></p>
            <p><strong>EU/UK Data Protection Officer (DPO):</strong> <a href={`mailto:${DPO_EMAIL}`} className="text-purple-500 hover:underline">{DPO_EMAIL}</a></p>
            <p><strong>Mailing address:</strong> {CONTACT_ADDRESS}</p>
          </Section>

          {/* ── 2. Information We Collect ── */}
          <Section title="2. Information We Collect" icon={FileText} theme={theme}>
            <p>We collect the following categories of personal and protected health information:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Identity data:</strong> first name, last name, date of birth, gender, Medical Record Number (MRN)</li>
              <li><strong>Contact data:</strong> email address, phone number, mailing address</li>
              <li><strong>Authentication data:</strong> hashed passwords, OAuth tokens (Google, Microsoft)</li>
              <li><strong>Clinical / PHI data:</strong> diagnoses (ICD-10), prescriptions, medical records, lab results, allergies, past and family medical history, current medications, blood type, height, weight, vital signs</li>
              <li><strong>Appointment data:</strong> scheduled visits, telehealth session records, appointment types and reminders</li>
              <li><strong>Insurance data:</strong> insurance payer, policy ID, group number</li>
              <li><strong>Billing &amp; financial data:</strong> claims, payments, pre-authorizations, denial records</li>
              <li><strong>Technical data:</strong> IP address, browser/device type (user agent), session identifiers, login timestamps</li>
              <li><strong>Communications:</strong> WhatsApp opt-in status, notification preferences, messages sent through the platform</li>
              <li><strong>Audit data:</strong> records of who accessed or modified data and when</li>
            </ul>
            <p className="mt-2">We collect this information directly from you, from your healthcare provider, and automatically as you use the platform.</p>
          </Section>

          {/* ── 3. How We Use Your Information ── */}
          <Section title="3. How We Use Your Information" icon={Eye} theme={theme}>
            <p>We use your personal and health information for the following purposes and legal bases:</p>

            <div className="space-y-3">
              <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <p className="font-semibold text-purple-500 mb-1">Treatment</p>
                <p>Sharing your health information with your healthcare providers to deliver clinical care, coordinate appointments, manage prescriptions, and support telehealth consultations.</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>HIPAA: Treatment / GDPR: Performance of a contract; Vital interests (Art. 6(1)(b), 9(2)(h))</p>
              </div>

              <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <p className="font-semibold text-purple-500 mb-1">Payment &amp; Revenue Cycle</p>
                <p>Processing insurance claims, billing, payment posting, pre-authorizations, and denial management.</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>HIPAA: Payment / GDPR: Performance of a contract; Legal obligation (Art. 6(1)(b), (c))</p>
              </div>

              <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <p className="font-semibold text-purple-500 mb-1">Healthcare Operations</p>
                <p>Quality assessment, staff training, administration, FHIR HL7 interoperability, audit logging, and platform security.</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>HIPAA: Healthcare Operations / GDPR: Legitimate interests; Legal obligation (Art. 6(1)(c), (f))</p>
              </div>

              <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <p className="font-semibold text-purple-500 mb-1">Communication &amp; Reminders</p>
                <p>Sending appointment reminders, health notifications, and platform-related communications via email, SMS, or WhatsApp (where you have opted in).</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>HIPAA: Treatment / GDPR: Consent; Legitimate interests (Art. 6(1)(a), (f))</p>
              </div>

              <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                <p className="font-semibold text-purple-500 mb-1">Legal &amp; Compliance</p>
                <p>Meeting regulatory obligations, responding to lawful requests from public authorities, and maintaining audit trails as required by HIPAA, GDPR, and applicable law.</p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>GDPR: Legal obligation (Art. 6(1)(c))</p>
              </div>
            </div>
          </Section>

          {/* ── 4. HIPAA Permitted Disclosures ── */}
          <Section title="4. HIPAA — Permitted Uses &amp; Disclosures of PHI" icon={Shield} theme={theme}>
            <p>Under HIPAA, we may use or disclose your Protected Health Information (PHI) without your written authorization for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Treatment, payment, and healthcare operations</strong> (as described in Section 3)</li>
              <li><strong>Required by law:</strong> court orders, lawful subpoenas, public health activities (e.g., reporting communicable diseases)</li>
              <li><strong>Health oversight activities:</strong> audits, inspections, or investigations by government agencies</li>
              <li><strong>Serious threats to health or safety</strong> — disclosures necessary to prevent imminent harm</li>
              <li><strong>Workers' compensation</strong> — as authorized by and necessary to comply with applicable law</li>
              <li><strong>Specialized government functions</strong> — military command, national security, correctional institutions</li>
              <li><strong>Decedents:</strong> funeral directors and medical examiners, as necessary</li>
              <li><strong>Research:</strong> only with appropriate IRB waiver or de-identification</li>
            </ul>
            <p className="mt-2 font-semibold">All other uses and disclosures require your written authorization.</p>
            <p>You may revoke a written authorization at any time by contacting us at <a href={`mailto:${HIPAA_PRIVACY_OFFICER}`} className="text-purple-500 hover:underline">{HIPAA_PRIVACY_OFFICER}</a>. Revocation does not affect disclosures already made in reliance on your authorization.</p>
          </Section>

          {/* ── 5. Data Sharing ── */}
          <Section title="5. Data Sharing &amp; Third-Party Recipients" icon={Users} theme={theme}>
            <p>We share your information only as permitted by HIPAA and GDPR:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Business Associates:</strong> Vendors acting as HIPAA Business Associates (cloud hosting providers, telehealth platforms, payment processors) under signed Business Associate Agreements (BAAs)</li>
              <li><strong>Healthcare providers &amp; care teams:</strong> Physicians, nurses, labs, and pharmacies involved in your care</li>
              <li><strong>Insurance payers:</strong> For claims processing and pre-authorization</li>
              <li><strong>Regulatory authorities:</strong> Government bodies when required by law</li>
              <li><strong>OAuth providers:</strong> Google and Microsoft, solely for authentication (we do not share PHI with them)</li>
              <li><strong>Analytics &amp; infrastructure:</strong> Supabase (database), Zoom (telehealth video), with appropriate data processing agreements</li>
            </ul>
            <p className="mt-2">We <strong>do not</strong> sell, rent, or trade your personal or health information for marketing purposes.</p>
          </Section>

          {/* ── 6. International Transfers ── */}
          <Section title="6. International Data Transfers" icon={Globe} theme={theme}>
            <p>If you are located in the European Economic Area (EEA) or United Kingdom, your data may be transferred to and processed in the United States. Such transfers are made under appropriate safeguards, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>UK Addendum to SCCs (for UK transfers)</li>
              <li>Adequacy decisions where applicable</li>
            </ul>
            <p>You may request a copy of the relevant transfer mechanisms by contacting our DPO at <a href={`mailto:${DPO_EMAIL}`} className="text-purple-500 hover:underline">{DPO_EMAIL}</a>.</p>
          </Section>

          {/* ── 7. Data Retention ── */}
          <Section title="7. Data Retention" icon={Trash2} theme={theme}>
            <p>We retain your information for as long as necessary to fulfill the purposes described in this policy, subject to the following:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Medical records / PHI:</strong> Retained for a minimum of <strong>6 years</strong> from the date of creation or the date it was last in effect, in accordance with HIPAA (45 CFR §164.530(j)). Some states require longer retention periods.</li>
              <li><strong>Audit logs:</strong> Retained for a minimum of <strong>6 years</strong> per HIPAA requirements; platform default is 90 days for operational logs (configurable by your organization).</li>
              <li><strong>Account data:</strong> Retained while your account is active and for up to <strong>7 years</strong> after account closure, to comply with legal obligations.</li>
              <li><strong>Session data:</strong> Retained for <strong>90 days</strong> for security and fraud prevention.</li>
              <li><strong>Backups:</strong> Encrypted backups are retained for <strong>30 days</strong> before secure deletion.</li>
            </ul>
            <p className="mt-2">When data is no longer needed, it is securely destroyed using industry-standard methods (e.g., cryptographic erasure, secure wipe).</p>
          </Section>

          {/* ── 8. Security ── */}
          <Section title="8. Security Measures" icon={Lock} theme={theme}>
            <p>We implement administrative, physical, and technical safeguards to protect your information as required by HIPAA (45 CFR Part 164) and GDPR (Art. 32):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Encryption in transit:</strong> TLS 1.2+ for all data transmitted over networks</li>
              <li><strong>Encryption at rest:</strong> AES-256 encryption for stored PHI and sensitive data</li>
              <li><strong>Access controls:</strong> Role-Based Access Control (RBAC) with 8 granular roles and 24+ permissions</li>
              <li><strong>Authentication:</strong> bcrypt password hashing, JWT tokens (RS256), multi-factor authentication (MFA) support, OAuth 2.0</li>
              <li><strong>Audit logging:</strong> Comprehensive audit trails for all access, creation, modification, and deletion of PHI</li>
              <li><strong>Session management:</strong> Automatic session expiration, IP and user-agent tracking</li>
              <li><strong>Rate limiting:</strong> API rate limiting to prevent brute-force and denial-of-service attacks</li>
              <li><strong>Input validation:</strong> Server-side validation to prevent injection attacks (SQL injection, XSS)</li>
              <li><strong>HTTP security headers:</strong> Implemented via Helmet.js (HSTS, CSP, X-Frame-Options, etc.)</li>
              <li><strong>Vulnerability management:</strong> Regular security assessments and dependency audits</li>
            </ul>
            <p className="mt-2">In the event of a security incident involving your PHI, we will notify you and the relevant authorities as required by HIPAA's Breach Notification Rule (45 CFR §164.400) and GDPR Article 33/34, within the applicable timeframes (72 hours for GDPR; 60 days for HIPAA).</p>
          </Section>

          {/* ── 9. Your HIPAA Rights ── */}
          <Section title="9. Your HIPAA Patient Rights" icon={FileText} theme={theme}>
            <p>As a patient, you have the following rights under HIPAA (45 CFR §164.520):</p>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">Right to Access Your PHI</p>
                <p>You may request a copy of your medical records and other health information we maintain about you. We will provide access within 30 days (or 60 days with written notice if the information is not readily available).</p>
              </div>
              <div>
                <p className="font-semibold">Right to Amend</p>
                <p>You may request that we correct or add information to your health record if you believe it is incomplete or inaccurate. We may deny your request in certain circumstances and will explain why in writing.</p>
              </div>
              <div>
                <p className="font-semibold">Right to an Accounting of Disclosures</p>
                <p>You may request a list of disclosures of your PHI made during the past 6 years (excluding disclosures for treatment, payment, or healthcare operations).</p>
              </div>
              <div>
                <p className="font-semibold">Right to Request Restrictions</p>
                <p>You may request restrictions on how we use or disclose your PHI. We must comply if the restriction is to a health plan for purposes of payment or healthcare operations and the PHI pertains solely to services you paid for out-of-pocket in full.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Confidential Communications</p>
                <p>You may request that we contact you by alternative means or at an alternative location (e.g., only by mail, not by phone).</p>
              </div>
              <div>
                <p className="font-semibold">Right to a Paper Copy of This Notice</p>
                <p>You may request a printed copy of this Notice of Privacy Practices at any time, even if you have agreed to receive it electronically.</p>
              </div>
            </div>
            <p className="mt-3">To exercise any of these rights, contact our HIPAA Privacy Officer at <a href={`mailto:${HIPAA_PRIVACY_OFFICER}`} className="text-purple-500 hover:underline">{HIPAA_PRIVACY_OFFICER}</a>.</p>
          </Section>

          {/* ── 10. GDPR Rights ── */}
          <Section title="10. Your GDPR Data Subject Rights (EEA &amp; UK)" icon={Download} theme={theme}>
            <p>If you are located in the EEA or UK, you have the following rights under the GDPR (Articles 15–22):</p>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">Right of Access (Art. 15)</p>
                <p>Obtain confirmation of whether we process your personal data and receive a copy of it, along with information about how it is used.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Rectification (Art. 16)</p>
                <p>Have inaccurate or incomplete personal data corrected without undue delay.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Erasure / "Right to be Forgotten" (Art. 17)</p>
                <p>Request deletion of your personal data where there is no compelling reason for its continued processing — subject to our legal obligations to retain medical records under HIPAA and applicable healthcare law.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Restriction of Processing (Art. 18)</p>
                <p>Request that we limit processing of your data in certain circumstances (e.g., while accuracy is contested).</p>
              </div>
              <div>
                <p className="font-semibold">Right to Data Portability (Art. 20)</p>
                <p>Receive your personal data in a structured, commonly used, machine-readable format (e.g., JSON or CSV) and transmit it to another controller. For health records, we also support FHIR R4 export.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Object (Art. 21)</p>
                <p>Object to processing based on legitimate interests or for direct marketing purposes.</p>
              </div>
              <div>
                <p className="font-semibold">Right to Withdraw Consent (Art. 7(3))</p>
                <p>Where processing is based on consent, withdraw it at any time without affecting the lawfulness of prior processing.</p>
              </div>
              <div>
                <p className="font-semibold">Right Not to be Subject to Automated Decision-Making (Art. 22)</p>
                <p>We do not make legally significant decisions about you solely through automated processing without human involvement.</p>
              </div>
            </div>
            <p className="mt-3">To exercise any GDPR rights, contact our DPO at <a href={`mailto:${DPO_EMAIL}`} className="text-purple-500 hover:underline">{DPO_EMAIL}</a>. We will respond within <strong>30 days</strong>. You also have the right to lodge a complaint with your local data protection supervisory authority (e.g., the ICO in the UK, or your EU Member State's authority).</p>
          </Section>

          {/* ── 11. Cookies ── */}
          <Section title="11. Cookies &amp; Tracking Technologies" icon={Globe} theme={theme}>
            <p>We use only strictly necessary cookies and local storage to operate the platform:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Session cookies:</strong> Maintain your authenticated session (expire when you close the browser)</li>
              <li><strong>Preference cookies:</strong> Remember your language and theme preferences (persistent, up to 1 year)</li>
              <li><strong>Security tokens:</strong> CSRF protection and session integrity</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> use third-party advertising cookies, cross-site tracking pixels, or behavioral analytics that share data with advertisers.</p>
          </Section>

          {/* ── 12. Children ── */}
          <Section title="12. Minors &amp; Children's Privacy" icon={Users} theme={theme}>
            <p>AureonCare may process health information about patients under the age of 18 solely for the purposes of providing healthcare services requested by or on behalf of the minor's legal guardian. We do not knowingly collect personal data from children for any marketing or commercial purpose.</p>
            <p>Parents or legal guardians may exercise all rights described in Sections 9 and 10 on behalf of a minor patient, subject to applicable laws governing minor consent (e.g., a minor's right to confidentiality regarding certain sensitive health services).</p>
          </Section>

          {/* ── 13. Changes ── */}
          <Section title="13. Changes to This Privacy Policy" icon={FileText} theme={theme}>
            <p>We may update this Privacy Policy and HIPAA Notice of Privacy Practices from time to time. When we make material changes, we will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Update the "Last Updated" date at the top of this document</li>
              <li>Display a notice within the platform on your next login</li>
              <li>Send an email notification to registered users</li>
            </ul>
            <p className="mt-2">Your continued use of AureonCare after the effective date of any changes constitutes your acceptance of the updated policy. Where required by law (e.g., GDPR), we will seek fresh consent before processing your data for new purposes.</p>
          </Section>

          {/* ── 14. Complaints ── */}
          <Section title="14. Filing a Complaint" icon={Mail} theme={theme}>
            <p>You have the right to file a complaint if you believe your privacy rights have been violated. You will not be penalized or retaliated against for filing a complaint.</p>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">Internal Complaint</p>
                <p>Contact our HIPAA Privacy Officer / DPO at <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-500 hover:underline">{CONTACT_EMAIL}</a> or write to us at: {CONTACT_ADDRESS}</p>
              </div>
              <div>
                <p className="font-semibold">U.S. — HHS Office for Civil Rights (HIPAA)</p>
                <p>Submit a complaint to the U.S. Department of Health and Human Services, Office for Civil Rights (OCR): <a href="https://www.hhs.gov/hipaa/filing-a-complaint" className="text-purple-500 hover:underline" target="_blank" rel="noopener noreferrer">www.hhs.gov/hipaa/filing-a-complaint</a></p>
              </div>
              <div>
                <p className="font-semibold">EU/EEA — Supervisory Authority (GDPR)</p>
                <p>Lodge a complaint with the data protection authority in your EU Member State of residence. A list of EU supervisory authorities is available at <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" className="text-purple-500 hover:underline" target="_blank" rel="noopener noreferrer">edpb.europa.eu</a>.</p>
              </div>
              <div>
                <p className="font-semibold">UK — Information Commissioner's Office (ICO)</p>
                <p>Report concerns at <a href="https://ico.org.uk/make-a-complaint" className="text-purple-500 hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk/make-a-complaint</a></p>
              </div>
            </div>
          </Section>

          {/* ── 15. Contact ── */}
          <div className={`rounded-xl p-5 mt-2 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Contact Us</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              For any privacy-related questions, requests, or concerns, please contact:
            </p>
            <ul className={`text-sm mt-2 space-y-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              <li><strong>Email:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-500 hover:underline">{CONTACT_EMAIL}</a></li>
              <li><strong>HIPAA Privacy Officer:</strong> <a href={`mailto:${HIPAA_PRIVACY_OFFICER}`} className="text-purple-500 hover:underline">{HIPAA_PRIVACY_OFFICER}</a></li>
              <li><strong>EU/UK DPO:</strong> <a href={`mailto:${DPO_EMAIL}`} className="text-purple-500 hover:underline">{DPO_EMAIL}</a></li>
              <li><strong>Address:</strong> {CONTACT_ADDRESS}</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex-shrink-0 flex items-center justify-between ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
            AureonCare, Inc. &copy; {new Date().getFullYear()} &mdash; HIPAA &amp; GDPR Compliant
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
