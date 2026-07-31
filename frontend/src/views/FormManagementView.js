import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, FileText, Edit2, Trash2, Eye, Download, Copy, History,
  CheckCircle, XCircle, Clock, Shield, GitBranch, Filter, ChevronDown,
  ChevronLeft, LayoutGrid, List, Activity, Settings, Users, BookOpen,
  ClipboardList, PenLine, Globe, Tag, AlertCircle, RefreshCw, X, Check,
  ArrowLeft, ChevronRight, Languages, Send, Star
} from 'lucide-react';
import { useAudit } from '../hooks/useAudit';
import DynamicFormBuilder from '../components/forms/DynamicFormBuilder';
import DynamicFormRenderer from '../components/forms/DynamicFormRenderer';
import FormTemplateLibrary from '../components/forms/FormTemplateLibrary';
import SignatureCapture from '../components/forms/SignatureCapture';
import ConfirmationModal from '../components/modals/ConfirmationModal';
import { FORM_TEMPLATES, FORM_CATEGORIES } from '../data/formTemplates';
import { useShellTab } from '../hooks/useShellTab';

// ─── PDF Export ────────────────────────────────────────────────────────────
const exportToPDF = async (template, submission, signatures) => {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(template.name || 'Form', pageW / 2, y, { align: 'center' });
    y += 8;

    if (template.description) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(template.description, pageW / 2, y, { align: 'center' });
      y += 6;
    }

    doc.setDrawColor(200);
    doc.line(14, y, pageW - 14, y);
    y += 8;

    if (submission) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Patient: ${submission.patient_name || 'N/A'}`, 14, y); y += 5;
      doc.text(`Date: ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : 'N/A'}`, 14, y); y += 5;
      doc.text(`Status: ${submission.status || 'draft'}`, 14, y); y += 8;
    }

    const fields = template.fields || [];
    const formData = submission?.form_data || {};

    for (const field of fields) {
      if (field.type === 'heading') {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(field.label, 14, y); y += 5;
        doc.setDrawColor(200);
        doc.line(14, y, pageW - 14, y); y += 6;
        continue;
      }
      if (field.type === 'paragraph') {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const lines = doc.splitTextToSize(field.label, pageW - 28);
        doc.text(lines, 14, y); y += lines.length * 4 + 3;
        continue;
      }
      if (['heading', 'paragraph', 'signature'].includes(field.type)) continue;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${field.label}${field.required ? ' *' : ''}:`, 14, y);
      doc.setFont('helvetica', 'normal');

      const val = formData[field.id];
      const displayVal = Array.isArray(val) ? val.join(', ') : (val !== undefined && val !== null && val !== '' ? String(val) : '___________________________');
      const lines = doc.splitTextToSize(displayVal, pageW - 80);
      doc.text(lines, 70, y);
      y += Math.max(lines.length * 4, 5) + 3;

      if (y > 270) { doc.addPage(); y = 20; }
    }

    // Signatures
    if (signatures && signatures.length > 0) {
      doc.addPage(); y = 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Signatures', 14, y); y += 8;
      doc.line(14, y, pageW - 14, y); y += 8;

      for (const sig of signatures) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${sig.signer_name} (${sig.signer_role || 'signer'})`, 14, y); y += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`Signed: ${sig.signed_at ? new Date(sig.signed_at).toLocaleString() : 'N/A'}`, 14, y); y += 5;
        if (sig.signature_data && sig.signature_data.startsWith('data:image')) {
          try {
            doc.addImage(sig.signature_data, 'PNG', 14, y, 80, 25);
            y += 30;
          } catch (e) { y += 5; }
        }
        y += 5;
      }
    }

    doc.save(`${(template.name || 'form').replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    return true;
  } catch (e) {
    console.error('PDF export error:', e);
    return false;
  }
};

// ─── Status Badge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    draft: { bg: 'bg-gray-100 text-gray-700', icon: Clock },
    submitted: { bg: 'bg-blue-100 text-blue-700', icon: Send },
    reviewed: { bg: 'bg-amber-100 text-amber-700', icon: Eye },
    approved: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
    rejected: { bg: 'bg-red-100 text-red-700', icon: XCircle },
    active: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
    inactive: { bg: 'bg-gray-100 text-gray-500', icon: XCircle },
    signed: { bg: 'bg-emerald-100 text-emerald-700', icon: PenLine },
  }[status] || { bg: 'bg-gray-100 text-gray-600', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
};

// ─── Main View ──────────────────────────────────────────────────────────────
const FormManagementView = ({
  theme = 'light',
  activeTab: shellTab,
  onTabChange,
  api,
  addNotification,
  user,
  patients = [],
  setCurrentModule,
  t = {}
}) => {
  const dark = theme === 'dark';
  const { logViewAccess, logAction } = useAudit();

  // Tabs: templates | submissions | builder | audit
  const [activeTab, setActiveTab, tabsInShell] = useShellTab(shellTab, onTabChange, 'templates');
  const [subView, setSubView] = useState(null); // null | 'edit' | 'preview' | 'submit' | 'view'

  // Templates
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Submissions
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState([]);

  // Stats
  const [stats, setStats] = useState({});

  // UI
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [submissionFormData, setSubmissionFormData] = useState({});
  const [submissionLanguage, setSubmissionLanguage] = useState('en');
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [signatures, setSignatures] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState([]);
  const [errors, setErrors] = useState({});

  // Builder state
  const [builderFields, setBuilderFields] = useState([]);
  const [builderSettings, setBuilderSettings] = useState({
    name: '', description: '', category_slug: 'onboarding', template_type: 'onboarding',
    require_signature: false, require_witness: false, languages: ['en'],
    compliance_tags: [], specialty: '', intake_flow_eligible: true,
    role_visibility: ['admin', 'provider', 'staff', 'patient']
  });
  const [builderPreview, setBuilderPreview] = useState(false);

  // Send-to-patient modal state
  const [sendModal, setSendModal] = useState(null); // null | template object
  const [sendPatientId, setSendPatientId] = useState('');
  const [sendingForm, setSendingForm] = useState(false);

  // Seed local templates (client-side) into state on load
  useEffect(() => {
    logViewAccess('FormManagementView', { module: 'Form Management' });
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apiTemplates, subData, statsData] = await Promise.all([
        api.getFormTemplates({ is_active: 'true' }).catch(() => []),
        api.getFormSubmissions({}).catch(() => []),
        api.getFormManagementStats().catch(() => ({}))
      ]);

      // Merge API templates with local seed templates (show local ones with is_system_template marker)
      const seedTemplates = FORM_TEMPLATES.map(t => ({ ...t, _seed: true }));
      const apiIds = new Set(apiTemplates.map(t => t.slug));
      const uniqueSeeds = seedTemplates.filter(t => !apiIds.has(t.id));
      setTemplates([...apiTemplates, ...uniqueSeeds]);
      setSubmissions(subData);
      setStats(statsData);
    } catch (e) {
      addNotification && addNotification({ type: 'error', message: 'Failed to load form data' });
    } finally {
      setLoading(false);
    }
  }, [api, addNotification]);

  const loadAuditLogs = useCallback(async () => {
    const logs = await api.getFormAuditLogs({ limit: 200 }).catch(() => []);
    setAuditLogs(logs);
  }, [api]);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadAuditLogs]);

  // ─── Send Form to Patient ──────────────────────────────────────────────

  const handleSendToPatient = async () => {
    if (!sendModal || !sendPatientId) return;
    setSendingForm(true);
    try {
      await api.createFormSubmission({
        template_id: sendModal._seed ? null : sendModal.id,
        template_name: sendModal.name,
        template_version: sendModal.version || '1.0',
        patient_id: sendPatientId,
        form_data: {},
        status: 'draft',
        language: 'en',
        metadata: {
          trigger: 'practice_sent',
          template_slug: sendModal.id || sendModal.slug,
          sent_by: user?.id
        }
      });
      addNotification && addNotification({ type: 'success', message: `"${sendModal.name}" sent to patient successfully` });
      setSendModal(null);
      setSendPatientId('');
      loadData();
    } catch (err) {
      addNotification && addNotification({ type: 'error', message: 'Failed to send form to patient' });
    } finally {
      setSendingForm(false);
    }
  };

  // ─── Template actions ───────────────────────────────────────────────────

  const openTemplateForSubmission = (template) => {
    setSelectedTemplate(template);
    setSubmissionFormData({});
    setSignatures([]);
    setErrors({});
    setSubView('submit');
  };

  const openTemplatePreview = (template) => {
    setSelectedTemplate(template);
    setSubView('preview');
  };

  const openTemplateEdit = (template) => {
    if (template._seed) {
      // Clone seed template for editing
      setBuilderFields(template.fields || []);
      setBuilderSettings({
        name: template.name + ' (Custom)',
        description: template.description || '',
        category_slug: template.category_slug || 'onboarding',
        template_type: template.template_type || 'onboarding',
        require_signature: template.require_signature || false,
        require_witness: template.require_witness || false,
        languages: template.languages || ['en'],
        compliance_tags: template.compliance_tags || [],
        specialty: template.specialty || '',
        intake_flow_eligible: template.intake_flow_eligible !== false,
        role_visibility: template.role_visibility || ['admin', 'provider', 'staff', 'patient']
      });
      setEditingTemplate(null);
      setActiveTab('builder');
      return;
    }
    setBuilderFields(template.fields || []);
    setBuilderSettings({
      name: template.name,
      description: template.description || '',
      category_slug: template.category_slug || 'onboarding',
      template_type: template.template_type || 'onboarding',
      require_signature: template.require_signature || false,
      require_witness: template.require_witness || false,
      languages: template.languages || ['en'],
      compliance_tags: template.compliance_tags || [],
      specialty: template.specialty || '',
      intake_flow_eligible: template.intake_flow_eligible !== false,
      role_visibility: template.role_visibility || ['admin', 'provider', 'staff', 'patient']
    });
    setEditingTemplate(template);
    setActiveTab('builder');
  };

  const handleDeleteTemplate = (template) => {
    if (template._seed || template.is_system_template) {
      addNotification && addNotification({ type: 'error', message: 'System templates cannot be deleted.' });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"? This cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        await api.deleteFormTemplate(template.id).catch(() => null);
        await loadData();
        addNotification && addNotification({ type: 'success', message: 'Template deleted.' });
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleDuplicateTemplate = async (template) => {
    const dup = {
      ...template,
      name: template.name + ' (Copy)',
      slug: undefined,
      is_system_template: false,
      _seed: undefined,
      id: undefined
    };
    delete dup._seed;
    delete dup.id;
    delete dup.slug;
    try {
      await api.createFormTemplate(dup);
      await loadData();
      addNotification && addNotification({ type: 'success', message: 'Template duplicated.' });
    } catch (e) {
      addNotification && addNotification({ type: 'error', message: 'Failed to duplicate template.' });
    }
  };

  const loadVersionHistory = async (template) => {
    if (template._seed) return;
    const v = await api.getFormTemplateVersions(template.id).catch(() => []);
    setVersions(v);
    setShowVersionHistory(true);
  };

  // ─── Submission actions ────────────────────────────────────────────────

  const validateForm = (fields, data) => {
    const errs = {};
    (fields || []).forEach(f => {
      if (f.required && !['heading', 'paragraph'].includes(f.type)) {
        const val = data[f.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errs[f.id] = 'This field is required';
        }
      }
    });
    return errs;
  };

  const handleSubmitForm = async (status = 'submitted') => {
    if (!selectedTemplate) return;
    const validationErrors = validateForm(selectedTemplate.fields, submissionFormData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      addNotification && addNotification({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    setErrors({});

    try {
      const sub = await api.createFormSubmission({
        template_id: selectedTemplate._seed ? undefined : selectedTemplate.id,
        template_name: selectedTemplate.name,
        template_version: selectedTemplate.version || '1.0',
        form_data: submissionFormData,
        status,
        language: submissionLanguage
      });

      // Add signatures
      for (const sig of signatures) {
        await api.addFormSignature(sub.id, {
          signer_name: sig.signer_name,
          signer_role: sig.signer_role || user?.role || 'patient',
          signature_data: sig.signature_data,
          signature_type: sig.signature_type || 'drawn'
        }).catch(() => null);
      }

      await loadData();
      addNotification && addNotification({ type: 'success', message: 'Form submitted successfully.' });
      setSubView(null);
      setSelectedTemplate(null);
    } catch (e) {
      addNotification && addNotification({ type: 'error', message: 'Failed to submit form.' });
    }
  };

  const handleExportPDF = async (template, submission) => {
    const sigs = submission ? await api.getFormSignatures(submission.id).catch(() => []) : signatures;
    const ok = await exportToPDF(template, submission || { form_data: submissionFormData }, sigs);
    if (ok) addNotification && addNotification({ type: 'success', message: 'PDF exported successfully.' });
    else addNotification && addNotification({ type: 'error', message: 'PDF export failed.' });
  };

  // ─── Builder actions ───────────────────────────────────────────────────

  const handleSaveTemplate = async () => {
    if (!builderSettings.name.trim()) {
      addNotification && addNotification({ type: 'error', message: 'Template name is required.' });
      return;
    }
    try {
      if (editingTemplate && !editingTemplate._seed) {
        await api.updateFormTemplate(editingTemplate.id, {
          ...builderSettings,
          fields: builderFields,
          change_summary: 'Updated via form builder'
        });
        addNotification && addNotification({ type: 'success', message: 'Template updated.' });
      } else {
        await api.createFormTemplate({
          ...builderSettings,
          fields: builderFields,
        });
        addNotification && addNotification({ type: 'success', message: 'Template created.' });
      }
      await loadData();
      setEditingTemplate(null);
      setActiveTab('templates');
      setSubView(null);
    } catch (e) {
      addNotification && addNotification({ type: 'error', message: 'Failed to save template.' });
    }
  };

  // ─── Filtered templates ────────────────────────────────────────────────

  const filteredTemplates = templates.filter(t => {
    if (filterCategory !== 'all' && t.category_slug !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.subcategory || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredSubmissions = submissions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.template_name || '').toLowerCase().includes(q) ||
        (s.patient_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Styles ────────────────────────────────────────────────────────────

  const card = `rounded-xl border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`;
  const inputCls = `rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;
  const tabBtn = (active) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : dark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`;

  // ─── Subviews ──────────────────────────────────────────────────────────

  if (subView === 'submit' && selectedTemplate) {
    return (
      <div className={`h-full flex flex-col ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <button onClick={() => setSubView(null)} className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${dark ? 'text-slate-100' : 'text-gray-900'}`}>{selectedTemplate.name}</h2>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{selectedTemplate.description}</p>
          </div>
          <div className="flex gap-2">
            <select value={submissionLanguage} onChange={e => setSubmissionLanguage(e.target.value)} className={inputCls}>
              {(selectedTemplate.languages || ['en']).map(lang => (
                <option key={lang} value={lang}>{lang === 'en' ? 'English' : lang === 'es' ? 'Español' : lang === 'fr' ? 'Français' : lang}</option>
              ))}
            </select>
            <button onClick={() => handleExportPDF(selectedTemplate, null)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button onClick={() => handleSubmitForm('draft')} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              Save Draft
            </button>
            <button onClick={() => handleSubmitForm('submitted')} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              Submit Form
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className={`max-w-3xl mx-auto ${card} p-6`}>
            {Object.keys(errors).length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Please fill in all required fields before submitting.
              </div>
            )}
            <DynamicFormRenderer
              fields={selectedTemplate.fields || []}
              formData={submissionFormData}
              onChange={setSubmissionFormData}
              theme={theme}
              language={submissionLanguage}
              userRole={user?.role || 'patient'}
              errors={errors}
              signerName={user?.name || ''}
              onSignatureSave={(sigData) => setSignatures(prev => [...prev, { ...sigData, signer_role: user?.role }])}
            />

            {selectedTemplate.require_signature && signatures.length === 0 && (
              <div className="mt-6">
                <h3 className={`font-medium mb-3 ${dark ? 'text-slate-200' : 'text-gray-800'}`}>Signature Required</h3>
                <SignatureCapture
                  onSave={(sigData) => setSignatures(prev => [...prev, { ...sigData, signer_role: user?.role || 'patient' }])}
                  signerName={user?.name || ''}
                  theme={theme}
                  label="Patient Signature"
                  required
                />
              </div>
            )}

            {signatures.length > 0 && (
              <div className={`mt-4 p-3 rounded-lg ${dark ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'} flex items-center gap-2`}>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className={`text-sm ${dark ? 'text-green-400' : 'text-green-700'}`}>Signature captured</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'preview' && selectedTemplate) {
    return (
      <div className={`h-full flex flex-col ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <button onClick={() => setSubView(null)} className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className={`text-lg font-semibold flex-1 ${dark ? 'text-slate-100' : 'text-gray-900'}`}>
            Preview: {selectedTemplate.name}
          </h2>
          <button onClick={() => openTemplateForSubmission(selectedTemplate)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
            Fill This Form
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className={`max-w-3xl mx-auto ${card} p-6`}>
            <DynamicFormRenderer
              fields={selectedTemplate.fields || []}
              formData={{}}
              readOnly
              theme={theme}
              userRole={user?.role || 'admin'}
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'builder') {
    return (
      <div className={`h-full flex flex-col ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        {/* Builder header */}
        <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <button onClick={() => { setActiveTab('templates'); setEditingTemplate(null); }} className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className={`font-semibold ${dark ? 'text-slate-100' : 'text-gray-900'}`}>
            {editingTemplate ? 'Edit Template' : 'New Template'}
          </h2>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setBuilderPreview(p => !p)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${builderPreview ? 'bg-blue-600 border-blue-600 text-white' : dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 hover:bg-gray-50'}`}>
              <Eye className="w-4 h-4" /> {builderPreview ? 'Back to Editor' : 'Preview'}
            </button>
            <button onClick={handleSaveTemplate} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
              <Check className="w-4 h-4" /> Save Template
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-0">
          {/* Settings panel */}
          <div className={`w-72 flex-shrink-0 border-r overflow-y-auto p-4 space-y-3 ${dark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-gray-500'}`}>FORM SETTINGS</p>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Form Name *</label>
              <input type="text" value={builderSettings.name} onChange={e => setBuilderSettings(p => ({...p, name: e.target.value}))} className={`${inputCls} w-full`} placeholder="Form name" />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Description</label>
              <textarea value={builderSettings.description} onChange={e => setBuilderSettings(p => ({...p, description: e.target.value}))} rows={2} className={`${inputCls} w-full resize-none`} placeholder="Brief description" />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Category</label>
              <select value={builderSettings.category_slug} onChange={e => setBuilderSettings(p => ({...p, category_slug: e.target.value}))} className={`${inputCls} w-full`}>
                {FORM_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Template Type</label>
              <select value={builderSettings.template_type} onChange={e => setBuilderSettings(p => ({...p, template_type: e.target.value}))} className={`${inputCls} w-full`}>
                {['onboarding','medical','consent','privacy','billing','scheduling','clinical','communication','legal','feedback','specialized','operational'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
              <select value={builderSettings.specialty} onChange={e => setBuilderSettings(p => ({...p, specialty: e.target.value}))} className={`${inputCls} w-full`}>
                <option value="">General</option>
                {['behavioral_health','dentistry','pediatrics','cardiology','orthopedics','oncology','dermatology'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Languages</label>
              <div className="flex flex-wrap gap-2">
                {[{code:'en',label:'English'},{code:'es',label:'Español'},{code:'fr',label:'Français'},{code:'de',label:'Deutsch'},{code:'pt',label:'Português'}].map(({code,label}) => (
                  <label key={code} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={(builderSettings.languages || []).includes(code)}
                      onChange={e => {
                        const curr = builderSettings.languages || ['en'];
                        setBuilderSettings(p => ({...p, languages: e.target.checked ? [...curr, code] : curr.filter(l => l !== code)}));
                      }}
                      className="w-3 h-3 text-blue-600 rounded"
                    />
                    <span className={dark ? 'text-slate-300' : 'text-gray-700'}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Compliance Tags</label>
              <div className="flex flex-wrap gap-2">
                {['HIPAA','GDPR','CMS','JCAHO'].map(tag => (
                  <label key={tag} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={(builderSettings.compliance_tags || []).includes(tag)}
                      onChange={e => {
                        const curr = builderSettings.compliance_tags || [];
                        setBuilderSettings(p => ({...p, compliance_tags: e.target.checked ? [...curr, tag] : curr.filter(c => c !== tag)}));
                      }}
                      className="w-3 h-3 text-blue-600 rounded"
                    />
                    <span className={dark ? 'text-slate-300' : 'text-gray-700'}>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[
                { key: 'require_signature', label: 'Require Signature' },
                { key: 'require_witness', label: 'Require Witness' },
                { key: 'intake_flow_eligible', label: 'Intake Flow Eligible' },
              ].map(({key, label}) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={builderSettings[key] || false}
                    onChange={e => setBuilderSettings(p => ({...p, [key]: e.target.checked}))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className={`text-xs ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Builder canvas */}
          <div className="flex-1 overflow-y-auto p-4">
            {builderPreview ? (
              <div className={`max-w-2xl mx-auto ${card} p-6`}>
                <h2 className={`text-lg font-semibold mb-1 ${dark ? 'text-slate-100' : 'text-gray-900'}`}>{builderSettings.name || 'Untitled Form'}</h2>
                {builderSettings.description && <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{builderSettings.description}</p>}
                <DynamicFormRenderer fields={builderFields} formData={{}} readOnly theme={theme} userRole="patient" />
              </div>
            ) : (
              <DynamicFormBuilder
                fields={builderFields}
                onChange={setBuilderFields}
                theme={theme}
                onPreview={() => setBuilderPreview(true)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main tabs view ────────────────────────────────────────────────────

  return (
    <div className={`h-full flex flex-col ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`flex-shrink-0 px-6 py-4 border-b ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className={`text-xl font-bold ${dark ? 'text-slate-100' : 'text-gray-900'}`}>Form Management</h1>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Dynamic form builder, templates, eSignatures, and submissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadData} className={`p-2 rounded-lg border transition-colors ${dark ? 'border-slate-600 hover:bg-slate-700 text-slate-400' : 'border-gray-300 hover:bg-gray-50 text-gray-500'}`}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setBuilderFields([]); setBuilderSettings({name:'',description:'',category_slug:'onboarding',template_type:'onboarding',require_signature:false,require_witness:false,languages:['en'],compliance_tags:[],specialty:'',intake_flow_eligible:true,role_visibility:['admin','provider','staff','patient']}); setEditingTemplate(null); setActiveTab('builder'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Templates', value: templates.length, icon: FileText, color: 'text-blue-600' },
            { label: 'Submissions', value: submissions.length, icon: ClipboardList, color: 'text-emerald-600' },
            { label: 'Pending Review', value: submissions.filter(s => s.status === 'submitted').length, icon: Clock, color: 'text-amber-600' },
            { label: 'Signed Forms', value: submissions.filter(s => s.is_signed).length, icon: PenLine, color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 flex items-center gap-3 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${dark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs — the app shell's secondary pane replaces these when present */}
        {!tabsInShell && (
        <div className="flex gap-1">
          {[
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'submissions', label: 'Submissions', icon: ClipboardList },
            { id: 'audit', label: 'Audit Logs', icon: History },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabBtn(activeTab === tab.id)}>
              <span className="flex items-center gap-1.5">
                <tab.icon className="w-4 h-4" /> {tab.label}
              </span>
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Toolbar */}
      <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b ${dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute left-3 top-2.5 w-4 h-4 ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
          <input type="text" placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search submissions...'} value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} w-full pl-9`} />
        </div>
        {activeTab === 'templates' && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={inputCls}>
            <option value="all">All Categories</option>
            {FORM_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        )}
        {activeTab === 'submissions' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
            <option value="all">All Statuses</option>
            {['draft','submitted','reviewed','approved','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {activeTab === 'templates' && (
          <div className={`flex rounded-lg border overflow-hidden ${dark ? 'border-slate-600' : 'border-gray-200'}`}>
            {[{m:'grid',I:LayoutGrid},{m:'list',I:List}].map(({m,I}) => (
              <button key={m} onClick={() => setViewMode(m)} className={`p-2 ${viewMode===m ? 'bg-blue-600 text-white' : dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                <I className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className={`w-8 h-8 animate-spin ${dark ? 'text-slate-500' : 'text-gray-400'}`} />
          </div>
        ) : (
          <>
            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <FormTemplateLibrary
                templates={filteredTemplates}
                onSelect={openTemplateForSubmission}
                onCreateNew={() => { setBuilderFields([]); setBuilderSettings({name:'',description:'',category_slug:'onboarding',template_type:'onboarding',require_signature:false,require_witness:false,languages:['en'],compliance_tags:[],specialty:'',intake_flow_eligible:true,role_visibility:['admin','provider','staff','patient']}); setEditingTemplate(null); setActiveTab('builder'); }}
                onPreview={openTemplatePreview}
                onEdit={openTemplateEdit}
                onSendToPatient={patients && patients.length > 0 ? (t) => { setSendModal(t); setSendPatientId(''); } : null}
                theme={theme}
                showStats
                onSelectionChange={null}
              />
            )}

            {/* Override FormTemplateLibrary's click handler - show action menu instead */}
            {/* Note: FormTemplateLibrary's onSelect fires when card is clicked, which opens submit view.
                Additional action buttons are shown via hover/context. */}

            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <div className="space-y-3">
                {filteredSubmissions.length === 0 && (
                  <div className={`text-center py-16 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                    <ClipboardList className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-base font-medium">No submissions yet</p>
                    <p className="text-sm">Fill out a template from the Templates tab</p>
                  </div>
                )}
                {filteredSubmissions.map(sub => (
                  <div key={sub.id} className={`${card} p-4 flex items-center gap-4`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${dark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                      <FileText className={`w-5 h-5 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-medium text-sm ${dark ? 'text-slate-100' : 'text-gray-900'}`}>{sub.template_name}</p>
                        <StatusBadge status={sub.status} />
                        {sub.is_signed && <StatusBadge status="signed" />}
                      </div>
                      <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
                        {sub.patient_name && `Patient: ${sub.patient_name} · `}
                        {sub.submitted_at ? `Submitted: ${new Date(sub.submitted_at).toLocaleDateString()}` : `Created: ${new Date(sub.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={async () => {
                          const template = templates.find(t => t.id === sub.template_id || t.slug === sub.template_id) || { name: sub.template_name, fields: [] };
                          await handleExportPDF(template, sub);
                        }}
                        className={`p-2 rounded-lg border transition-colors ${dark ? 'border-slate-600 hover:bg-slate-700 text-slate-400' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                        title="Export PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {sub.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => api.updateFormSubmission(sub.id, { status: 'approved' }).then(loadData)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white"
                          >Approve</button>
                          <button
                            onClick={() => api.updateFormSubmission(sub.id, { status: 'rejected' }).then(loadData)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white"
                          >Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Audit Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-2">
                <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{auditLogs.length} audit entries</p>
                {auditLogs.length === 0 && (
                  <div className={`text-center py-16 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                    <History className="w-12 h-12 mx-auto mb-3" />
                    <p className="text-base font-medium">No audit logs yet</p>
                  </div>
                )}
                {auditLogs.map(log => (
                  <div key={log.id} className={`${card} p-3 flex items-start gap-3`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${dark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                      <Activity className={`w-4 h-4 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{log.action}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>{log.resource_type}</span>
                        {log.actor_name && <span className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>by {log.actor_name}</span>}
                      </div>
                      {log.notes && <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{log.notes}</p>}
                    </div>
                    <span className={`text-xs flex-shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ isOpen: false })}
          theme={theme}
        />
      )}

      {/* Send Form to Patient Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-xl shadow-2xl border ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`font-semibold text-lg ${dark ? 'text-slate-100' : 'text-gray-900'}`}>Send Form to Patient</h3>
                <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{sendModal.name}</p>
              </div>
              <button onClick={() => setSendModal(null)} className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>Select Patient <span className="text-red-400">*</span></label>
                <select
                  value={sendPatientId}
                  onChange={e => setSendPatientId(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">-- Select a patient --</option>
                  {(patients || []).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim()} {p.mrn ? `(${p.mrn})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`p-3 rounded-lg text-sm ${dark ? 'bg-blue-900/20 border border-blue-700/40 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                <Send className="w-4 h-4 inline mr-1.5" />
                The patient will see this form under "Forms Requested" in their portal and can fill it out online.
              </div>
            </div>
            <div className={`flex gap-3 p-5 border-t ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                onClick={handleSendToPatient}
                disabled={!sendPatientId || sendingForm}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
              >
                {sendingForm ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingForm ? 'Sending...' : 'Send Form'}
              </button>
              <button
                onClick={() => setSendModal(null)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Sidebar */}
      {showVersionHistory && (
        <div className={`fixed inset-y-0 right-0 w-80 shadow-2xl border-l flex flex-col z-50 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className={`flex items-center justify-between p-4 border-b ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
            <h3 className={`font-semibold ${dark ? 'text-slate-100' : 'text-gray-900'}`}>Version History</h3>
            <button onClick={() => setShowVersionHistory(false)} className={`p-1.5 rounded-lg ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {versions.map(v => (
              <div key={v.id} className={`rounded-lg border p-3 ${dark ? 'border-slate-700 bg-slate-800' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium text-sm ${dark ? 'text-slate-200' : 'text-gray-800'}`}>v{v.version}</span>
                  {v.is_published && <span className="text-xs text-green-600">Published</span>}
                </div>
                {v.change_summary && <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{v.change_summary}</p>}
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{new Date(v.created_at).toLocaleString()}</p>
                {v.changed_by_name && <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>by {v.changed_by_name}</p>}
                <button
                  onClick={async () => {
                    if (!selectedTemplate || selectedTemplate._seed) return;
                    await api.restoreFormTemplateVersion(selectedTemplate.id, v.id);
                    await loadData();
                    setShowVersionHistory(false);
                    addNotification && addNotification({ type: 'success', message: `Restored to version ${v.version}` });
                  }}
                  className={`mt-2 text-xs px-2 py-1 rounded border transition-colors ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  Restore this version
                </button>
              </div>
            ))}
            {versions.length === 0 && <p className={`text-sm text-center ${dark ? 'text-slate-500' : 'text-gray-400'}`}>No version history</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormManagementView;
