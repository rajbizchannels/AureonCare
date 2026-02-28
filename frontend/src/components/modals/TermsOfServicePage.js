import React, { useState } from 'react';
import { X, FileText, ChevronDown, ChevronRight, Shield, Users, CreditCard, AlertTriangle, Lock, Scale, Globe, Settings, Ban, RefreshCw, Mail, Stethoscope } from 'lucide-react';

const EFFECTIVE_DATE = 'February 28, 2026';
const LAST_UPDATED = 'February 28, 2026';
const CONTACT_EMAIL = 'legal@aureoncare.com';
const CONTACT_ADDRESS = 'AureonCare, Inc., Legal Department, 123 Healthcare Blvd, Suite 400, San Francisco, CA 94105';
const SUPPORT_EMAIL = 'support@aureoncare.com';
const GOVERNING_STATE = 'California';
const GOVERNING_COUNTRY = 'United States';

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
          <Icon className="w-5 h-5 text-cyan-500 flex-shrink-0" />
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

const TermsOfServicePage = ({ theme, onClose }) => {
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Terms of Service
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
          <div className={`rounded-xl p-4 mb-5 flex gap-3 ${theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
            <AlertTriangle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
            <p className={`text-sm ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-800'}`}>
              Please read these Terms of Service carefully before using AureonCare. By accessing or using the platform, you agree to be bound by these terms. These Terms include HIPAA and GDPR-specific provisions relevant to healthcare data processing. If you do not agree, do not use the platform.
            </p>
          </div>

          {/* ── 1. Acceptance ── */}
          <Section title="1. Acceptance of Terms" icon={FileText} theme={theme} defaultOpen>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and <strong>AureonCare, Inc.</strong> ("AureonCare," "we," "us," or "our"), governing your access to and use of the AureonCare healthcare practice management platform, including all software, services, APIs, and related content (collectively, the "Service").
            </p>
            <p>
              By creating an account, clicking "I Agree," or otherwise accessing or using the Service, you represent that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You are at least 18 years of age (or the age of majority in your jurisdiction)</li>
              <li>You have the legal authority to enter into this agreement on behalf of yourself or your organization</li>
              <li>You have read, understood, and agree to be bound by these Terms and our <strong>Privacy Policy & HIPAA Notice of Privacy Practices</strong></li>
              <li>If acting on behalf of an organization, you have the authority to bind that organization to these Terms</li>
            </ul>
            <p>
              These Terms are effective as of the date you first access or use the Service and remain in effect until terminated in accordance with Section 15.
            </p>
          </Section>

          {/* ── 2. Definitions ── */}
          <Section title="2. Definitions" icon={FileText} theme={theme}>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>"Account"</strong> — your registered account on the AureonCare platform</li>
              <li><strong>"Business Associate"</strong> — as defined under HIPAA (45 CFR §160.103), a person or entity that performs functions or activities involving the use or disclosure of PHI on behalf of a covered entity</li>
              <li><strong>"Content"</strong> — all data, text, files, images, records, and other materials uploaded, submitted, or transmitted through the Service</li>
              <li><strong>"Covered Entity"</strong> — a healthcare provider, health plan, or healthcare clearinghouse as defined under HIPAA</li>
              <li><strong>"Data Processing Agreement" / "DPA"</strong> — a supplementary agreement governing GDPR-compliant processing of personal data</li>
              <li><strong>"EEA"</strong> — the European Economic Area</li>
              <li><strong>"GDPR"</strong> — the General Data Protection Regulation (EU) 2016/679 and its UK equivalent (UK GDPR)</li>
              <li><strong>"HIPAA"</strong> — the Health Insurance Portability and Accountability Act of 1996, as amended by HITECH, and all implementing regulations</li>
              <li><strong>"Patient Portal"</strong> — the patient-facing interface within the Service enabling patients to access their own health information</li>
              <li><strong>"PHI"</strong> — Protected Health Information as defined under HIPAA (45 CFR §160.103)</li>
              <li><strong>"Personal Data"</strong> — any information relating to an identified or identifiable natural person, as defined under the GDPR</li>
              <li><strong>"Practice"</strong> — a healthcare organization or medical practice that subscribes to the Service</li>
              <li><strong>"Subscription Plan"</strong> — the tier of service (Free, Starter, Professional, or Enterprise) to which you subscribe</li>
            </ul>
          </Section>

          {/* ── 3. Description of Services ── */}
          <Section title="3. Description of Services" icon={Stethoscope} theme={theme}>
            <p>AureonCare provides an integrated, cloud-based healthcare practice management platform offering the following modules, subject to your Subscription Plan:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Electronic Health Records (EHR)</strong> — patient medical records, diagnoses, and clinical documentation</li>
              <li><strong>Practice Management</strong> — appointment scheduling, provider management, and operational workflows</li>
              <li><strong>Revenue Cycle Management (RCM)</strong> — claims processing, billing, payments, and pre-authorizations</li>
              <li><strong>Telehealth</strong> — secure video consultation services</li>
              <li><strong>Patient Portal</strong> — patient self-service access to health records, appointments, and communications</li>
              <li><strong>FHIR HL7 Interoperability</strong> — healthcare data exchange using FHIR R4 standards</li>
              <li><strong>Patient CRM &amp; Engagement</strong> — campaigns, notifications, and patient relationship management</li>
              <li><strong>Reporting &amp; Analytics</strong> — operational and clinical reporting dashboards</li>
              <li><strong>Integrations</strong> — connections to third-party healthcare vendors and systems</li>
            </ul>
            <p>We reserve the right to modify, add, or discontinue features at any time, with reasonable notice provided for material changes that affect existing functionality.</p>
          </Section>

          {/* ── 4. Accounts ── */}
          <Section title="4. Account Registration &amp; Security" icon={Users} theme={theme}>
            <p>To access the Service, you must create an account. You agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide accurate, complete, and current registration information</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Notify AureonCare immediately at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-500 hover:underline">{SUPPORT_EMAIL}</a> of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Not share your credentials with unauthorized individuals</li>
              <li>Not create more than one account for the same individual without our written consent</li>
            </ul>
            <p>New accounts are subject to administrator approval and will remain in "pending" status until activated. AureonCare reserves the right to refuse, suspend, or terminate any account at our sole discretion.</p>
            <p>You must be a licensed healthcare professional, authorized practice staff member, or a registered patient to use the relevant modules of the Service.</p>
          </Section>

          {/* ── 5. HIPAA ── */}
          <Section title="5. HIPAA Compliance Provisions" icon={Shield} theme={theme}>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-cyan-500">5.1 Business Associate Agreement (BAA)</p>
                <p>If you are a Covered Entity or a Business Associate under HIPAA, your use of the Service for the creation, receipt, maintenance, or transmission of PHI requires execution of a <strong>Business Associate Agreement (BAA)</strong> with AureonCare. Enterprise plan customers receive a BAA as part of their subscription. Starter and Professional plan customers should request a BAA at <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-500 hover:underline">{CONTACT_EMAIL}</a>. Do not upload PHI until a BAA is in place.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">5.2 Minimum Necessary Standard</p>
                <p>You agree to access, use, and disclose PHI only to the extent necessary to accomplish the intended purpose of the Service, consistent with HIPAA's Minimum Necessary Standard (45 CFR §164.514(d)).</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">5.3 Security Safeguards</p>
                <p>You are responsible for implementing appropriate administrative, physical, and technical safeguards within your organization as required by the HIPAA Security Rule (45 CFR Part 164, Subpart C). This includes ensuring that workforce members who access the Service are trained and authorized.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">5.4 Breach Notification</p>
                <p>If you discover or reasonably suspect a security incident involving PHI, you must notify AureonCare at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-500 hover:underline">{SUPPORT_EMAIL}</a> within <strong>24 hours</strong> of discovery. AureonCare will fulfill its Business Associate breach notification obligations under the HIPAA Breach Notification Rule (45 CFR §164.400 et seq.).</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">5.5 Audit Logs</p>
                <p>AureonCare maintains comprehensive audit logs of all access to and modifications of PHI. You agree not to attempt to disable, circumvent, or interfere with audit logging mechanisms.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">5.6 Patient Rights</p>
                <p>You are responsible for facilitating patients' HIPAA rights (access, amendment, accounting, restrictions) through the features provided in the Service. AureonCare will cooperate with reasonable requests to support these obligations within the scope of the BAA.</p>
              </div>
            </div>
          </Section>

          {/* ── 6. GDPR ── */}
          <Section title="6. GDPR &amp; Data Protection Provisions" icon={Globe} theme={theme}>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-cyan-500">6.1 Roles</p>
                <p>For purposes of the GDPR:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Where you (as a Practice or healthcare organization) determine the purposes and means of processing patient personal data, you are the <strong>Data Controller</strong> and AureonCare acts as your <strong>Data Processor</strong>.</li>
                  <li>Where AureonCare determines the purposes and means of processing (e.g., account management, platform security, billing), AureonCare is an <strong>independent Data Controller</strong>.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">6.2 Data Processing Agreement (DPA)</p>
                <p>If you are established in the EEA or UK, or process personal data of EEA/UK residents, you must execute a Data Processing Agreement (DPA) with AureonCare as required by GDPR Article 28. A DPA is available upon request at <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-500 hover:underline">{CONTACT_EMAIL}</a>. Enterprise customers receive a DPA as part of onboarding.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">6.3 Lawful Basis for Processing</p>
                <p>You represent and warrant that you have identified and documented an appropriate lawful basis under GDPR Article 6 (and Article 9 for special category health data) for each processing activity you conduct using the Service.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">6.4 Sub-processors</p>
                <p>AureonCare uses vetted sub-processors (e.g., cloud infrastructure, video conferencing, payment processing) under appropriate data processing agreements. A current list of sub-processors is available at <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-500 hover:underline">{CONTACT_EMAIL}</a>. We will provide advance notice of material changes to our sub-processor list.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">6.5 Data Subject Rights Assistance</p>
                <p>AureonCare will provide reasonable technical assistance to help you respond to data subject rights requests (access, rectification, erasure, portability, restriction, objection) within the timelines required by the GDPR.</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-500">6.6 International Transfers</p>
                <p>Any transfer of personal data outside the EEA or UK will be subject to appropriate safeguards in accordance with GDPR Chapter V, including Standard Contractual Clauses (SCCs) as set out in the DPA.</p>
              </div>
            </div>
          </Section>

          {/* ── 7. Subscription & Billing ── */}
          <Section title="7. Subscription Plans &amp; Billing" icon={CreditCard} theme={theme}>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">7.1 Subscription Tiers</p>
                <p>AureonCare offers Free, Starter, Professional, and Enterprise subscription plans. Features available under each plan are described on the pricing page. We reserve the right to modify plan features with 30 days' written notice.</p>
              </div>
              <div>
                <p className="font-semibold">7.2 Fees &amp; Payment</p>
                <p>Paid subscription fees are billed in advance on a monthly or annual basis, as selected during sign-up. All fees are non-refundable except as expressly stated in these Terms or required by applicable law. You authorize us to charge your designated payment method for all applicable fees.</p>
              </div>
              <div>
                <p className="font-semibold">7.3 Taxes</p>
                <p>You are responsible for all applicable taxes, levies, or duties imposed by taxing authorities, excluding taxes on AureonCare's income.</p>
              </div>
              <div>
                <p className="font-semibold">7.4 Free Trial</p>
                <p>Where a free trial is offered, it is provided "as-is" without warranty. AureonCare may terminate a free trial at any time at its discretion.</p>
              </div>
              <div>
                <p className="font-semibold">7.5 Overage &amp; Fair Use</p>
                <p>Use of the Service is subject to the limits set forth in your Subscription Plan (e.g., number of users, API calls, storage). Excessive use beyond plan limits may result in additional charges or service throttling with prior notice.</p>
              </div>
              <div>
                <p className="font-semibold">7.6 EU/UK Consumer Rights</p>
                <p>If you are a consumer in the EU or UK, you may have a statutory right to cancel within 14 days of entering into a subscription contract ("cooling-off period"). By requesting access to the Service before the 14-day period expires, you acknowledge that the right of withdrawal may be lost once the Service has been fully performed.</p>
              </div>
            </div>
          </Section>

          {/* ── 8. Acceptable Use ── */}
          <Section title="8. Acceptable Use Policy" icon={Ban} theme={theme}>
            <p>You agree to use the Service only for lawful healthcare purposes and in compliance with all applicable laws and regulations. You <strong>must not</strong>:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Upload, transmit, or store content that is unlawful, fraudulent, defamatory, or that violates any third party's rights</li>
              <li>Attempt to gain unauthorized access to any part of the Service, its servers, or connected systems</li>
              <li>Use the Service to process or store PHI or personal data in violation of HIPAA, GDPR, or other applicable data protection law</li>
              <li>Conduct or facilitate any form of data scraping, automated data collection, or reverse engineering of the Service</li>
              <li>Introduce malicious code, viruses, malware, or other harmful software</li>
              <li>Impersonate any person or entity, or falsely represent your affiliation with a person or entity</li>
              <li>Use the Service to send unsolicited communications (spam) or engage in unauthorized marketing to patients</li>
              <li>Sell, resell, sublicense, or transfer access to the Service to any third party without our prior written consent</li>
              <li>Use the Service in any manner that could damage, disable, overburden, or impair AureonCare's infrastructure</li>
              <li>Attempt to circumvent, disable, or interfere with security features, audit logs, or access controls</li>
            </ul>
            <p className="mt-2">Violation of this Acceptable Use Policy may result in immediate suspension or termination of your account and may be reported to relevant regulatory and law enforcement authorities.</p>
          </Section>

          {/* ── 9. Healthcare Disclaimer ── */}
          <Section title="9. Healthcare Disclaimer" icon={Stethoscope} theme={theme}>
            <div className={`rounded-lg p-4 font-semibold ${theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
              AureonCare is a healthcare practice management and administrative platform. It is NOT a provider of medical advice, diagnosis, treatment, or emergency services.
            </div>
            <p className="mt-2">Content available through the Service, including clinical templates, ICD/CPT codes, and reference materials, is provided for administrative and informational purposes only. All clinical decisions must be made by licensed healthcare professionals based on their independent professional judgment.</p>
            <p>In the event of a medical emergency, users and patients should call emergency services (e.g., 911 in the US) immediately. <strong>Do not rely on AureonCare for emergency healthcare or crisis intervention.</strong></p>
            <p>Telehealth sessions facilitated through the Service are conducted by independently licensed healthcare providers. AureonCare is not responsible for the quality, accuracy, or appropriateness of any clinical advice or treatment provided by such providers.</p>
          </Section>

          {/* ── 10. IP ── */}
          <Section title="10. Intellectual Property" icon={Lock} theme={theme}>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">10.1 AureonCare IP</p>
                <p>The Service, including its software, user interface, design, documentation, and all intellectual property rights therein, is owned by AureonCare or its licensors. These Terms do not grant you any ownership interest in the Service. Your right to use the Service is limited to the license described below.</p>
              </div>
              <div>
                <p className="font-semibold">10.2 License to Use the Service</p>
                <p>Subject to your compliance with these Terms and payment of applicable fees, AureonCare grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for your internal healthcare operations during the term of your subscription.</p>
              </div>
              <div>
                <p className="font-semibold">10.3 Your Content</p>
                <p>You retain ownership of all Content you upload or create through the Service, including patient records and clinical data. You grant AureonCare a limited license to process, store, and transmit your Content solely as necessary to provide the Service, as described in our Privacy Policy. You represent that you have all rights necessary to grant this license.</p>
              </div>
              <div>
                <p className="font-semibold">10.4 Feedback</p>
                <p>Any suggestions, ideas, or feedback you provide about the Service may be used by AureonCare without restriction or compensation to you.</p>
              </div>
            </div>
          </Section>

          {/* ── 11. Confidentiality ── */}
          <Section title="11. Confidentiality &amp; Data Security" icon={Lock} theme={theme}>
            <p>Each party agrees to keep the other party's Confidential Information (including but not limited to PHI, trade secrets, pricing, and business strategies) strictly confidential and not to disclose it to any third party without prior written consent, except:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>As required to perform obligations under these Terms</li>
              <li>As required by law, court order, or regulatory authority (with prompt notice to the other party where legally permitted)</li>
              <li>To authorized sub-processors or Business Associates under appropriate confidentiality obligations</li>
            </ul>
            <p className="mt-2">AureonCare employs industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest, role-based access controls, multi-factor authentication, and continuous audit logging. However, no security system is impenetrable. You are responsible for maintaining the security of your own systems and credentials.</p>
          </Section>

          {/* ── 12. Disclaimers ── */}
          <Section title="12. Disclaimers of Warranties" icon={AlertTriangle} theme={theme}>
            <div className={`rounded-lg p-4 text-sm font-medium ${theme === 'dark' ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-gray-100 border border-gray-300 text-gray-700'}`}>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </div>
            <p className="mt-3">AureonCare does not warrant that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The Service will be uninterrupted, error-free, or secure at all times</li>
              <li>Any defects in the Service will be corrected</li>
              <li>The Service or its servers are free from viruses or other harmful components</li>
              <li>Results obtained from use of the Service will be accurate or reliable</li>
            </ul>
            <p className="mt-2"><strong>Note for EEA/UK consumers:</strong> Nothing in this Section limits any statutory rights you may have under applicable consumer protection law that cannot be excluded by contract.</p>
          </Section>

          {/* ── 13. Limitation of Liability ── */}
          <Section title="13. Limitation of Liability" icon={Scale} theme={theme}>
            <div className={`rounded-lg p-4 text-sm font-medium ${theme === 'dark' ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-gray-100 border border-gray-300 text-gray-700'}`}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AUREONCARE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
            </div>
            <p className="mt-3">AureonCare's total aggregate liability for all claims arising from or related to these Terms or the Service shall not exceed the greater of: (a) the amount you paid to AureonCare in the twelve (12) months preceding the claim; or (b) USD $100.</p>
            <p>These limitations apply regardless of the legal theory (contract, tort, statute, or otherwise) and even if AureonCare has been advised of the possibility of such damages.</p>
            <p><strong>HIPAA note:</strong> Nothing in this Section limits AureonCare's liability for obligations expressly set out in a signed Business Associate Agreement.</p>
            <p><strong>Note for EEA/UK consumers:</strong> Statutory liability for death or personal injury caused by negligence, fraud, or fraudulent misrepresentation cannot be excluded or limited under applicable law.</p>
          </Section>

          {/* ── 14. Indemnification ── */}
          <Section title="14. Indemnification" icon={Shield} theme={theme}>
            <p>You agree to defend, indemnify, and hold harmless AureonCare, its officers, directors, employees, agents, and licensors from and against any claims, liabilities, damages, judgments, awards, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your use of the Service in violation of these Terms or applicable law</li>
              <li>Your failure to comply with HIPAA, GDPR, or other applicable data protection or healthcare regulations</li>
              <li>Any Content you upload, submit, or transmit through the Service</li>
              <li>Your negligence, fraud, or willful misconduct</li>
              <li>Any dispute between you and a patient, payer, or other third party</li>
            </ul>
          </Section>

          {/* ── 15. Termination ── */}
          <Section title="15. Termination &amp; Suspension" icon={Ban} theme={theme}>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">15.1 Termination by You</p>
                <p>You may terminate your account at any time by contacting <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-500 hover:underline">{SUPPORT_EMAIL}</a>. Termination does not entitle you to a refund of prepaid fees, except where required by law.</p>
              </div>
              <div>
                <p className="font-semibold">15.2 Termination by AureonCare</p>
                <p>AureonCare may suspend or terminate your account immediately and without prior notice if you breach these Terms, fail to pay applicable fees, or if required by law or to protect the security of the Service or other users.</p>
              </div>
              <div>
                <p className="font-semibold">15.3 Effect of Termination</p>
                <p>Upon termination, your right to access the Service ceases immediately. You may request a data export of your Content within <strong>30 days</strong> of termination. After 30 days, AureonCare may delete your data subject to applicable data retention requirements under HIPAA and other law. PHI will be retained or destroyed in accordance with the BAA.</p>
              </div>
              <div>
                <p className="font-semibold">15.4 Survival</p>
                <p>Sections relating to intellectual property, confidentiality, disclaimers, limitation of liability, indemnification, governing law, and any accrued rights survive termination.</p>
              </div>
            </div>
          </Section>

          {/* ── 16. Governing Law ── */}
          <Section title="16. Governing Law &amp; Dispute Resolution" icon={Scale} theme={theme}>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">16.1 Governing Law</p>
                <p>These Terms are governed by the laws of the State of {GOVERNING_STATE}, {GOVERNING_COUNTRY}, without regard to its conflict-of-law provisions. For users in the EEA or UK, mandatory consumer protection laws of your country of residence may also apply.</p>
              </div>
              <div>
                <p className="font-semibold">16.2 Dispute Resolution — US Users</p>
                <p>Any dispute arising under these Terms shall first be subject to good-faith negotiation. If unresolved within 30 days, disputes shall be resolved by binding arbitration administered by JAMS under its Streamlined Arbitration Rules, with proceedings in San Francisco, California, conducted in English. The arbitrator may award any remedy available at law or equity. You waive the right to a jury trial and to participate in class action litigation.</p>
              </div>
              <div>
                <p className="font-semibold">16.3 Dispute Resolution — EEA/UK Consumers</p>
                <p>If you are a consumer in the EU or UK, you may bring proceedings in the courts of your country of residence. The EU Online Dispute Resolution platform is available at <a href="https://ec.europa.eu/consumers/odr" className="text-cyan-500 hover:underline" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.</p>
              </div>
              <div>
                <p className="font-semibold">16.4 HIPAA Disputes</p>
                <p>Disputes relating to HIPAA obligations shall be governed by federal law and, where applicable, the terms of the BAA. Nothing in this Section limits either party's right to report potential HIPAA violations to the HHS Office for Civil Rights.</p>
              </div>
            </div>
          </Section>

          {/* ── 17. General ── */}
          <Section title="17. General Provisions" icon={Settings} theme={theme}>
            <div className="space-y-2">
              <div>
                <p className="font-semibold">17.1 Entire Agreement</p>
                <p>These Terms, together with the Privacy Policy, any applicable BAA, DPA, and order forms, constitute the entire agreement between you and AureonCare regarding the Service and supersede all prior agreements and understandings.</p>
              </div>
              <div>
                <p className="font-semibold">17.2 Severability</p>
                <p>If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.</p>
              </div>
              <div>
                <p className="font-semibold">17.3 Waiver</p>
                <p>AureonCare's failure to enforce any right or provision of these Terms does not constitute a waiver of that right or provision.</p>
              </div>
              <div>
                <p className="font-semibold">17.4 Assignment</p>
                <p>You may not assign or transfer your rights or obligations under these Terms without AureonCare's prior written consent. AureonCare may assign these Terms in connection with a merger, acquisition, or sale of assets.</p>
              </div>
              <div>
                <p className="font-semibold">17.5 Force Majeure</p>
                <p>Neither party is liable for delays or failures in performance resulting from causes beyond its reasonable control, including natural disasters, acts of government, labor disputes, or internet outages.</p>
              </div>
            </div>
          </Section>

          {/* ── 18. Changes ── */}
          <Section title="18. Changes to These Terms" icon={RefreshCw} theme={theme}>
            <p>AureonCare may update these Terms from time to time. When we make material changes, we will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Update the "Last Updated" date at the top of this document</li>
              <li>Provide at least <strong>30 days' advance notice</strong> via email and an in-app banner for material changes</li>
              <li>For GDPR-regulated processing, obtain fresh consent where required by law</li>
            </ul>
            <p className="mt-2">Your continued use of the Service after the effective date of any changes constitutes your acceptance of the revised Terms. If you do not agree with the revised Terms, you must discontinue use of the Service and may request account termination per Section 15.</p>
          </Section>

          {/* ── 19. Contact ── */}
          <div className={`rounded-xl p-5 mt-2 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>19. Contact Us</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              For legal inquiries, BAA/DPA requests, or questions about these Terms, please contact:
            </p>
            <ul className={`text-sm mt-2 space-y-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              <li><strong>Legal:</strong> <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-500 hover:underline">{CONTACT_EMAIL}</a></li>
              <li><strong>Support:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-500 hover:underline">{SUPPORT_EMAIL}</a></li>
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
            className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
