import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Plus, CheckCircle, FileText, Shield, CreditCard,
  Calendar, Stethoscope, MessageSquare, Scale, Star, Users, Activity,
  ClipboardList, Heart, Pill, Eye, ChevronRight, Tag, Send, Edit2
} from 'lucide-react';

const CATEGORY_ICONS = {
  onboarding: Users,
  medical: Stethoscope,
  consent: Shield,
  privacy: Eye,
  billing: CreditCard,
  scheduling: Calendar,
  clinical: ClipboardList,
  communication: MessageSquare,
  legal: Scale,
  feedback: Star,
  behavioral_health: Heart,
  dentistry: Activity,
  pediatrics: Users,
  operational: FileText,
};

const CATEGORY_COLORS = {
  onboarding: 'from-blue-500 to-cyan-500',
  medical: 'from-emerald-500 to-teal-500',
  consent: 'from-amber-500 to-orange-500',
  privacy: 'from-purple-500 to-violet-500',
  billing: 'from-green-500 to-emerald-500',
  scheduling: 'from-sky-500 to-blue-500',
  clinical: 'from-red-500 to-rose-500',
  communication: 'from-indigo-500 to-blue-500',
  legal: 'from-gray-500 to-slate-500',
  feedback: 'from-yellow-500 to-amber-500',
  behavioral_health: 'from-pink-500 to-rose-500',
  dentistry: 'from-cyan-500 to-sky-500',
  pediatrics: 'from-violet-500 to-purple-500',
  operational: 'from-slate-500 to-gray-500',
};

const CATEGORY_LABELS = {
  onboarding: 'Patient Onboarding',
  medical: 'Medical Information',
  consent: 'Consent Forms',
  privacy: 'Privacy & Compliance',
  billing: 'Insurance & Billing',
  scheduling: 'Scheduling',
  clinical: 'Clinical Workflow',
  communication: 'Communication',
  legal: 'Legal & Administrative',
  feedback: 'Feedback & Quality',
  behavioral_health: 'Behavioral Health',
  dentistry: 'Dentistry',
  pediatrics: 'Pediatrics',
  operational: 'Operational (Staff)',
};

const COMPLIANCE_COLORS = {
  HIPAA: 'bg-blue-100 text-blue-700',
  GDPR: 'bg-purple-100 text-purple-700',
  CMS: 'bg-green-100 text-green-700',
  JCAHO: 'bg-amber-100 text-amber-700',
};

const FormTemplateLibrary = ({
  templates = [],
  onSelect,
  onCreateNew,
  onPreview,
  onEdit,
  onSendToPatient,
  theme = 'light',
  multiSelect = false,
  selectedIds = [],
  onSelectionChange,
  showStats = false,
  compact = false
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const dark = theme === 'dark';

  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category_slug).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [templates]);

  const types = useMemo(() => {
    const ts = new Set(templates.map(t => t.template_type).filter(Boolean));
    return ['all', ...Array.from(ts)];
  }, [templates]);

  const specialties = useMemo(() => {
    const sp = new Set(templates.map(t => t.specialty).filter(Boolean));
    return ['all', ...Array.from(sp)];
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (selectedCategory !== 'all' && t.category_slug !== selectedCategory) return false;
      if (selectedType !== 'all' && t.template_type !== selectedType) return false;
      if (selectedSpecialty !== 'all' && t.specialty !== selectedSpecialty) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (t.name || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.subcategory || '').toLowerCase().includes(q) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [templates, search, selectedCategory, selectedType, selectedSpecialty]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      const cat = t.category_slug || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [filtered]);

  const toggleSelect = (id) => {
    if (!multiSelect) { onSelectionChange && onSelectionChange([id]); return; }
    const curr = [...selectedIds];
    const idx = curr.indexOf(id);
    if (idx >= 0) curr.splice(idx, 1); else curr.push(id);
    onSelectionChange && onSelectionChange(curr);
  };

  const inputCls = `rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
    dark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  if (compact) {
    return (
      <div className="space-y-3">
        <div className={`flex gap-2`}>
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-2.5 w-4 h-4 ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
            <input type="text" placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} w-full pl-9`} />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className={inputCls}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : CATEGORY_LABELS[c] || c}</option>)}
          </select>
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.map(template => {
            const isSelected = selectedIds.includes(template.id || template.slug);
            const Cat = CATEGORY_ICONS[template.category_slug] || FileText;
            return (
              <div
                key={template.id || template.slug}
                onClick={() => multiSelect ? toggleSelect(template.id || template.slug) : (onSelect && onSelect(template))}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors border ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : dark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {multiSelect && (
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : dark ? 'border-slate-500' : 'border-gray-400'}`}>
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                )}
                <Cat className={`w-4 h-4 flex-shrink-0 text-blue-500`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{template.name}</p>
                  <p className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{template.subcategory || template.template_type}</p>
                </div>
                {template.require_signature && <Shield className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Requires signature" />}
                {!multiSelect && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className={`text-center py-4 text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>No templates found</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className={`absolute left-3 top-2.5 w-4 h-4 ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
          <input type="text" placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} w-full pl-9`} />
        </div>
        <button onClick={() => setShowFilters(p => !p)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
          showFilters ? 'bg-blue-600 border-blue-600 text-white' : dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}>
          <Filter className="w-4 h-4" /> Filters
        </button>
        {onCreateNew && (
          <button onClick={onCreateNew} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors">
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {showFilters && (
        <div className={`grid grid-cols-3 gap-3 p-4 rounded-xl border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Category</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className={`${inputCls} w-full`}>
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : CATEGORY_LABELS[c] || c}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Type</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className={`${inputCls} w-full`}>
              {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
            <select value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)} className={`${inputCls} w-full`}>
              {specialties.map(s => <option key={s} value={s}>{s === 'all' ? 'All Specialties' : s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Category shortcuts */}
      <div className="flex gap-2 flex-wrap">
        {categories.slice(0, 8).map(cat => {
          const Icon = cat === 'all' ? FileText : (CATEGORY_ICONS[cat] || FileText);
          const isActive = selectedCategory === cat;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : dark ? 'border-slate-700 text-slate-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <Icon className="w-3 h-3" />
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      {showStats && (
        <div className={`grid grid-cols-4 gap-3`}>
          {[
            { label: 'Total Templates', value: templates.length, color: 'text-blue-600' },
            { label: 'Filtered', value: filtered.length, color: 'text-green-600' },
            { label: 'Require Signature', value: templates.filter(t => t.require_signature).length, color: 'text-amber-600' },
            { label: 'System Templates', value: templates.filter(t => t.is_system_template).length, color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
        Showing {filtered.length} of {templates.length} templates
      </p>

      {/* Grouped by category */}
      {Object.entries(grouped).map(([cat, catTemplates]) => {
        const CatIcon = CATEGORY_ICONS[cat] || FileText;
        const gradient = CATEGORY_COLORS[cat] || 'from-gray-500 to-slate-500';
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <CatIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className={`font-semibold text-sm ${dark ? 'text-slate-200' : 'text-gray-800'}`}>
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                {catTemplates.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {catTemplates.map(template => {
                const id = template.id || template.slug;
                const isSelected = selectedIds.includes(id);
                const compliance = template.compliance_tags || [];

                const hasActions = !multiSelect && (onPreview || onEdit || onSendToPatient);
                return (
                  <div
                    key={id}
                    className={`rounded-xl border transition-all hover:shadow-md group ${
                      isSelected
                        ? dark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50'
                        : dark ? 'border-slate-700 bg-slate-800 hover:border-slate-600' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Card body — click to select/open */}
                    <div
                      onClick={() => multiSelect ? toggleSelect(id) : (onSelect && onSelect(template))}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {multiSelect && (
                              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : dark ? 'border-slate-500' : 'border-gray-300'}`}>
                                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                            )}
                            <p className={`font-medium text-sm leading-tight ${dark ? 'text-slate-100' : 'text-gray-800'}`}>
                              {template.name}
                            </p>
                          </div>
                          {template.subcategory && (
                            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{template.subcategory}</p>
                          )}
                        </div>
                        {!multiSelect && !hasActions && <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 ${dark ? 'text-slate-500' : 'text-gray-400'}`} />}
                      </div>

                      {template.description && (
                        <p className={`text-xs mb-2 line-clamp-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{template.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.require_signature && (
                          <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${dark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                            <Shield className="w-2.5 h-2.5" /> Signature
                          </span>
                        )}
                        {template.require_witness && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${dark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-700'}`}>
                            Witness
                          </span>
                        )}
                        {template.fhir_questionnaire && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${dark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}`}>
                            FHIR
                          </span>
                        )}
                        {compliance.map(tag => (
                          <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${COMPLIANCE_COLORS[tag] || 'bg-gray-100 text-gray-600'}`}>
                            {tag}
                          </span>
                        ))}
                        {template.version && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ml-auto ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                            v{template.version}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons row */}
                    {hasActions && (
                      <div className={`flex items-center gap-1 px-3 pb-3`}>
                        {onPreview && (
                          <button
                            onClick={e => { e.stopPropagation(); onPreview(template); }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={e => { e.stopPropagation(); onEdit(template); }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {onSendToPatient && (
                          <button
                            onClick={e => { e.stopPropagation(); onSendToPatient(template); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white ml-auto"
                          >
                            <Send className="w-3 h-3" /> Send to Patient
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-16 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
          <FileText className="w-12 h-12 mb-3" />
          <p className="text-base font-medium">No templates found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
          {onCreateNew && (
            <button onClick={onCreateNew} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
              <Plus className="w-4 h-4" /> Create New Template
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormTemplateLibrary;
