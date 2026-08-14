import React, { useState, useCallback } from 'react';
import { ChevronDown, Info, AlertCircle } from 'lucide-react';
import SignatureCapture from './SignatureCapture';
import ThemedSelect from './ThemedSelect';

// ============================================================================
// DYNAMIC FORM RENDERER
// Renders a form from a JSON field schema definition
// Supports: conditional fields, multi-language, role-based visibility, eSignature
// ============================================================================

const DynamicFormRenderer = ({
  fields = [],
  formData = {},
  onChange,
  theme = 'light',
  language = 'en',
  userRole = 'patient',
  readOnly = false,
  errors = {},
  onSignatureSave,
  signerName = '',
  showSections = true
}) => {
  const [openSections, setOpenSections] = useState({});
  const dark = theme === 'dark';

  const getLabel = useCallback((field) => {
    if (language !== 'en' && field.translations && field.translations[language]) {
      return field.translations[language];
    }
    return field.label;
  }, [language]);

  const isVisible = useCallback((field) => {
    // Role-based visibility
    if (field.visibility_roles && field.visibility_roles.length > 0) {
      if (!field.visibility_roles.includes(userRole) && !field.visibility_roles.includes('all')) {
        return false;
      }
    }
    // Conditional visibility
    if (field.conditional) {
      const { field: condField, operator, value } = field.conditional;
      const currentVal = formData[condField];
      switch (operator) {
        case 'equals': return String(currentVal) === String(value);
        case 'not_equals': return String(currentVal) !== String(value);
        case 'contains': return String(currentVal || '').toLowerCase().includes(String(value).toLowerCase());
        case 'not_empty': return currentVal !== undefined && currentVal !== '' && currentVal !== null;
        case 'is_empty': return !currentVal;
        case 'gt': return parseFloat(currentVal) > parseFloat(value);
        case 'lt': return parseFloat(currentVal) < parseFloat(value);
        default: return true;
      }
    }
    return true;
  }, [formData, userRole]);

  const handleChange = useCallback((fieldId, value) => {
    if (readOnly) return;
    onChange && onChange({ ...formData, [fieldId]: value });
  }, [formData, onChange, readOnly]);

  const baseInput = `w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:ring-2 focus:ring-blue-500 ${
    dark
      ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  const renderField = (field) => {
    if (!isVisible(field)) return null;

    const value = formData[field.id] !== undefined ? formData[field.id] : '';
    const error = errors[field.id];
    const label = getLabel(field);

    if (field.type === 'heading') {
      return (
        <div key={field.id} className={`col-span-2 pt-4 pb-1 border-b ${dark ? 'border-slate-600' : 'border-gray-200'}`}>
          <h3 className={`font-semibold text-base ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{label}</h3>
          {field.helpText && <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{field.helpText}</p>}
        </div>
      );
    }

    if (field.type === 'paragraph') {
      return (
        <div key={field.id} className={`col-span-2 text-sm p-3 rounded-lg ${dark ? 'bg-slate-700/50 text-slate-300' : 'bg-blue-50 text-gray-700'}`}>
          {label}
        </div>
      );
    }

    const colSpan = field.fullWidth || ['textarea', 'signature', 'checkboxes', 'paragraph', 'heading'].includes(field.type)
      ? 'col-span-2'
      : '';

    return (
      <div key={field.id} className={colSpan}>
        {field.type !== 'checkbox' && (
          <label className={`block text-xs font-medium mb-1 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
            {label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
            {field.helpText && (
              <span className="ml-1 inline-flex">
                <Info className="w-3 h-3 text-gray-400 cursor-help" title={field.helpText} />
              </span>
            )}
          </label>
        )}

        {field.type === 'text' && (
          <input
            type="text"
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={readOnly}
            className={`${baseInput} ${error ? 'border-red-500' : ''} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        )}

        {field.type === 'email' && (
          <input
            type="email"
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder || 'email@example.com'}
            disabled={readOnly}
            className={`${baseInput} ${error ? 'border-red-500' : ''}`}
          />
        )}

        {field.type === 'phone' && (
          <input
            type="tel"
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder || '(555) 555-5555'}
            disabled={readOnly}
            className={`${baseInput} ${error ? 'border-red-500' : ''}`}
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={readOnly}
            className={`${baseInput} ${error ? 'border-red-500' : ''}`}
          />
        )}

        {field.type === 'date' && (
          <input
            type="date"
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            disabled={readOnly}
            className={`${baseInput} ${error ? 'border-red-500' : ''}`}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            rows={field.rows || 3}
            disabled={readOnly}
            className={`${baseInput} resize-y ${error ? 'border-red-500' : ''}`}
          />
        )}

        {field.type === 'select' && (
          /* ThemedSelect draws its own chevron. */
          <ThemedSelect
            theme={theme}
            className={`${error ? 'border-red-500' : ''}`}
            value={value}
            onChange={e => handleChange(field.id, e.target.value)}
            disabled={readOnly}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map(opt => (
              <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                {typeof opt === 'string' ? opt : opt.label}
              </option>
            ))}
          </ThemedSelect>
        )}

        {field.type === 'radio' && (
          <div className="space-y-2">
            {(field.options || []).map(opt => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <label key={optVal} className={`flex items-center gap-2 cursor-pointer ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name={field.id}
                    value={optVal}
                    checked={value === optVal}
                    onChange={() => handleChange(field.id, optVal)}
                    disabled={readOnly}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{optLabel}</span>
                </label>
              );
            })}
          </div>
        )}

        {field.type === 'checkbox' && (
          <label className={`flex items-start gap-2 cursor-pointer ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => handleChange(field.id, e.target.checked)}
              disabled={readOnly}
              className="w-4 h-4 mt-0.5 text-blue-600 rounded"
            />
            <span className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
              {label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
        )}

        {field.type === 'checkboxes' && (
          <div className="space-y-2">
            {(field.options || []).map(opt => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              const checked = Array.isArray(value) ? value.includes(optVal) : false;
              return (
                <label key={optVal} className={`flex items-center gap-2 cursor-pointer ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => {
                      const arr = Array.isArray(value) ? [...value] : [];
                      if (e.target.checked) handleChange(field.id, [...arr, optVal]);
                      else handleChange(field.id, arr.filter(v => v !== optVal));
                    }}
                    disabled={readOnly}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className={`text-sm ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{optLabel}</span>
                </label>
              );
            })}
          </div>
        )}

        {field.type === 'signature' && !readOnly && (
          <SignatureCapture
            onSave={(sigData) => {
              handleChange(field.id, sigData.signature_data);
              onSignatureSave && onSignatureSave(sigData);
            }}
            signerName={signerName}
            theme={theme}
            label=""
          />
        )}

        {field.type === 'signature' && readOnly && value && (
          <div className={`rounded-lg border p-2 ${dark ? 'border-slate-600 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
            <img src={value} alt="Signature" className="max-h-16 object-contain" />
          </div>
        )}

        {field.type === 'scale' && (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: (field.max || 10) - (field.min || 0) + 1 }, (_, i) => (field.min || 0) + i).map(n => (
              <button
                key={n}
                onClick={() => handleChange(field.id, n)}
                disabled={readOnly}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                  Number(value) === n
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-500">{error}</span>
          </div>
        )}
      </div>
    );
  };

  // Group fields by section
  const sections = {};
  const sectionOrder = [];
  fields.forEach(field => {
    const s = field.section || '_default';
    if (!sections[s]) {
      sections[s] = [];
      sectionOrder.push(s);
    }
    sections[s].push(field);
  });

  if (!showSections || sectionOrder.length <= 1) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {fields.map(f => renderField(f))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sectionOrder.map(section => {
        const sectionFields = sections[section];
        const isOpen = openSections[section] !== false;
        const sectionName = section === '_default' ? null : section;
        return (
          <div key={section} className={`rounded-xl border ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
            {sectionName && (
              <button
                onClick={() => setOpenSections(p => ({ ...p, [section]: !isOpen }))}
                className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-t-xl font-medium text-sm ${
                  dark ? 'bg-slate-800 text-slate-200 hover:bg-slate-750' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                }`}
              >
                {sectionName}
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
            {isOpen && (
              <div className={`grid grid-cols-2 gap-4 p-4 ${sectionName ? '' : ''}`}>
                {sectionFields.map(f => renderField(f))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DynamicFormRenderer;
