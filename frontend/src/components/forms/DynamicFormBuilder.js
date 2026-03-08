import React, { useState, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Copy, Eye, EyeOff,
  Type, AlignLeft, List, CheckSquare, Calendar, Hash, Mail, Phone, PenLine, Heading, FileText
} from 'lucide-react';

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input', icon: Type },
  { type: 'textarea', label: 'Text Area', icon: AlignLeft },
  { type: 'select', label: 'Dropdown', icon: ChevronDown },
  { type: 'radio', label: 'Radio Buttons', icon: List },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'checkboxes', label: 'Multi-Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'scale', label: 'Rating Scale', icon: Hash },
  { type: 'signature', label: 'Signature', icon: PenLine },
  { type: 'heading', label: 'Section Heading', icon: Heading },
  { type: 'paragraph', label: 'Paragraph Text', icon: FileText },
];

const ROLES = ['admin', 'provider', 'staff', 'patient'];

const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const defaultField = (type) => ({
  id: generateId(),
  type,
  label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
  required: false,
  placeholder: '',
  options: type === 'select' || type === 'radio' || type === 'checkboxes' ? ['Option 1', 'Option 2'] : [],
  conditional: null,
  helpText: '',
  translations: { es: '', fr: '' },
  fhir_mapping: '',
  visibility_roles: [...ROLES],
  section: '',
  fullWidth: false,
  min: null,
  max: null,
});

const DynamicFormBuilder = ({
  fields = [],
  onChange,
  theme = 'light',
  onPreview
}) => {
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);

  const dark = theme === 'dark';

  const addField = useCallback((type) => {
    const newField = defaultField(type);
    onChange([...fields, newField]);
    setEditingFieldId(newField.id);
  }, [fields, onChange]);

  const updateField = useCallback((id, updates) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  }, [fields, onChange]);

  const deleteField = useCallback((id) => {
    onChange(fields.filter(f => f.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  }, [fields, onChange, editingFieldId]);

  const duplicateField = useCallback((field) => {
    const dup = { ...field, id: generateId(), label: field.label + ' (Copy)' };
    const idx = fields.findIndex(f => f.id === field.id);
    const newFields = [...fields];
    newFields.splice(idx + 1, 0, dup);
    onChange(newFields);
  }, [fields, onChange]);

  const moveField = useCallback((fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= fields.length) return;
    const newFields = [...fields];
    const [item] = newFields.splice(fromIdx, 1);
    newFields.splice(toIdx, 0, item);
    onChange(newFields);
  }, [fields, onChange]);

  const handleDragStart = (e, idx) => {
    setDragging(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOver(idx);
  };

  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    if (dragging !== null && dragging !== toIdx) {
      moveField(dragging, toIdx);
    }
    setDragging(null);
    setDragOver(null);
  };

  const editingField = fields.find(f => f.id === editingFieldId);

  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
    dark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const labelCls = `block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-gray-600'}`;

  return (
    <div className={`flex gap-4 h-full`}>
      {/* Field type picker */}
      <div className={`w-48 flex-shrink-0 rounded-xl border p-3 space-y-1 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
        <p className={`text-xs font-semibold mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>ADD FIELD</p>
        {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => addField(type)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-left transition-colors ${
              dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {label}
          </button>
        ))}
        {onPreview && (
          <button
            onClick={onPreview}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-left mt-4 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Eye className="w-3.5 h-3.5" /> Preview Form
          </button>
        )}
      </div>

      {/* Field list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {fields.length === 0 && (
          <div className={`flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed ${dark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>
            <Plus className="w-8 h-8 mb-2" />
            <p className="text-sm">Click a field type to add it</p>
          </div>
        )}
        {fields.map((field, idx) => {
          const FieldIcon = FIELD_TYPES.find(t => t.type === field.type)?.icon || Type;
          const isEditing = editingFieldId === field.id;
          return (
            <div
              key={field.id}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              onDragEnd={() => { setDragging(null); setDragOver(null); }}
              className={`rounded-xl border transition-all ${
                dragOver === idx ? 'border-blue-500 shadow-lg' : dark ? 'border-slate-700' : 'border-gray-200'
              } ${isEditing ? dark ? 'bg-slate-800' : 'bg-blue-50/50 border-blue-300' : dark ? 'bg-slate-800/50' : 'bg-white'}`}
            >
              {/* Field header */}
              <div
                className="flex items-center gap-2 p-3 cursor-pointer"
                onClick={() => setEditingFieldId(isEditing ? null : field.id)}
              >
                <GripVertical className={`w-4 h-4 flex-shrink-0 cursor-grab ${dark ? 'text-slate-600' : 'text-gray-300'}`} />
                <FieldIcon className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
                <span className={`flex-1 text-sm font-medium truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                  {field.type}
                </span>
                <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveField(idx, idx - 1)} disabled={idx === 0}
                    className={`p-1 rounded hover:bg-slate-200/20 disabled:opacity-30`}>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveField(idx, idx + 1)} disabled={idx === fields.length - 1}
                    className={`p-1 rounded hover:bg-slate-200/20 disabled:opacity-30`}>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => duplicateField(field)} className={`p-1 rounded hover:bg-blue-100 ${dark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500'}`}>
                    <Copy className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteField(field.id)} className={`p-1 rounded hover:bg-red-100 ${dark ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500'}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Field editor panel */}
              {isEditing && (
                <div className={`border-t px-4 pb-4 pt-3 grid grid-cols-2 gap-3 ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
                  <div className="col-span-2">
                    <label className={labelCls}>Label</label>
                    <input type="text" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>Placeholder</label>
                    <input type="text" value={field.placeholder || ''} onChange={e => updateField(field.id, { placeholder: e.target.value })} className={inputCls} />
                  </div>

                  <div>
                    <label className={labelCls}>Section</label>
                    <input type="text" value={field.section || ''} onChange={e => updateField(field.id, { section: e.target.value })} className={inputCls} placeholder="Group name" />
                  </div>

                  <div>
                    <label className={labelCls}>FHIR Mapping</label>
                    <input type="text" value={field.fhir_mapping || ''} onChange={e => updateField(field.id, { fhir_mapping: e.target.value })} className={inputCls} placeholder="e.g. Patient.name.given" />
                  </div>

                  <div>
                    <label className={labelCls}>Help Text</label>
                    <input type="text" value={field.helpText || ''} onChange={e => updateField(field.id, { helpText: e.target.value })} className={inputCls} />
                  </div>

                  <div className="col-span-2">
                    <label className={labelCls}>Translations</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['es', 'fr', 'de', 'pt'].map(lang => (
                        <input key={lang} type="text" placeholder={`${lang.toUpperCase()} label`}
                          value={(field.translations || {})[lang] || ''}
                          onChange={e => updateField(field.id, { translations: { ...(field.translations || {}), [lang]: e.target.value } })}
                          className={inputCls} />
                      ))}
                    </div>
                  </div>

                  {(field.type === 'select' || field.type === 'radio' || field.type === 'checkboxes') && (
                    <div className="col-span-2">
                      <label className={labelCls}>Options (one per line)</label>
                      <textarea
                        value={(field.options || []).join('\n')}
                        onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(o => o.trim()) })}
                        rows={4}
                        className={`${inputCls} resize-y`}
                      />
                    </div>
                  )}

                  {(field.type === 'number' || field.type === 'scale') && (
                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Min</label>
                        <input type="number" value={field.min ?? ''} onChange={e => updateField(field.id, { min: e.target.value !== '' ? Number(e.target.value) : null })} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Max</label>
                        <input type="number" value={field.max ?? ''} onChange={e => updateField(field.id, { max: e.target.value !== '' ? Number(e.target.value) : null })} className={inputCls} />
                      </div>
                    </div>
                  )}

                  {/* Conditional logic */}
                  <div className="col-span-2">
                    <label className={labelCls}>Conditional Visibility</label>
                    <select
                      value={field.conditional ? field.conditional.field : ''}
                      onChange={e => {
                        if (!e.target.value) updateField(field.id, { conditional: null });
                        else updateField(field.id, { conditional: { field: e.target.value, operator: 'equals', value: '' } });
                      }}
                      className={inputCls}
                    >
                      <option value="">Always visible</option>
                      {fields.filter(f => f.id !== field.id && !['heading', 'paragraph', 'signature'].includes(f.type)).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                    {field.conditional && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <select
                          value={field.conditional.operator}
                          onChange={e => updateField(field.id, { conditional: { ...field.conditional, operator: e.target.value } })}
                          className={inputCls}
                        >
                          {['equals', 'not_equals', 'contains', 'not_empty', 'is_empty', 'gt', 'lt'].map(op => (
                            <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={field.conditional.value}
                          onChange={e => updateField(field.id, { conditional: { ...field.conditional, value: e.target.value } })}
                          placeholder="Value to compare"
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>

                  {/* Role visibility */}
                  <div className="col-span-2">
                    <label className={labelCls}>Visible to Roles</label>
                    <div className="flex gap-3 flex-wrap">
                      {ROLES.map(role => (
                        <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(field.visibility_roles || ROLES).includes(role)}
                            onChange={e => {
                              const curr = field.visibility_roles || [...ROLES];
                              updateField(field.id, {
                                visibility_roles: e.target.checked
                                  ? [...curr, role]
                                  : curr.filter(r => r !== role)
                              });
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          <span className={`text-xs ${dark ? 'text-slate-300' : 'text-gray-600'}`}>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 flex gap-4 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                      <span className={`text-xs ${dark ? 'text-slate-300' : 'text-gray-700'}`}>Required</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={field.fullWidth || false} onChange={e => updateField(field.id, { fullWidth: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                      <span className={`text-xs ${dark ? 'text-slate-300' : 'text-gray-700'}`}>Full width</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DynamicFormBuilder;
