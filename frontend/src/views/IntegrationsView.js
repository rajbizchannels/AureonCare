import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Save } from 'lucide-react';
import api from '../api/apiService';
import { useAudit } from '../hooks/useAudit';
import AIIntegrationsSection from '../components/integrations/AIIntegrationsSection';

const IntegrationsView = ({ theme, setCurrentModule, t, user }) => {
  const isAdmin = user?.role === 'admin';
  const [vendorIntegrations, setVendorIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState({});
  const [expandedIntegrations, setExpandedIntegrations] = useState({});
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [saving, setSaving] = useState({});

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('IntegrationsView', {
      module: 'Admin',
    });
  }, [logViewAccess]);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      // Telehealth is configured on Settings › System › Telehealth Setup, and Stripe at the
      // platform level (SEC-38), so this page holds vendor connections and AI only.
      const vendorSettings = await api.getVendorIntegrationSettings().catch(() => []);
      setVendorIntegrations(vendorSettings);

      // Initialize form data and original data
      const allIntegrations = {};
      const allOriginal = {};

      // Initialize all vendor types (even if not in database)
      ['surescripts', 'labcorp', 'optum'].forEach(vendorType => {
        const vendor = vendorSettings.find(v => v.vendor_type === vendorType);
        const key = `vendor_${vendorType}`;
        allIntegrations[key] = {
          api_key: vendor?.api_key || '',
          // Secrets are never sent back by the server (SEC-36); the fields start blank and
          // a blank secret on save keeps the stored one.
          api_secret: '',
          client_id: vendor?.client_id || '',
          client_secret: '',
          username: vendor?.username || '',
          password: '',
          base_url: vendor?.base_url || '',
          sandbox_mode: vendor?.sandbox_mode || false
        };
        allOriginal[key] = { ...allIntegrations[key] };
      });

      setFormData(allIntegrations);
      setOriginalData(allOriginal);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isIntegrationConfigured = (integration) => {
    if (!integration) return false;
    // Stored secrets come back only as has_<field> flags.
    if (integration.has_api_secret || integration.has_client_secret || integration.has_password) return true;
    // Check if integration has any required configuration values
    const hasApiKey = integration.api_key && integration.api_key.trim() !== '';
    const hasApiSecret = integration.api_secret && integration.api_secret.trim() !== '';
    const hasClientId = integration.client_id && integration.client_id.trim() !== '';
    const hasClientSecret = integration.client_secret && integration.client_secret.trim() !== '';
    const hasUsername = integration.username && integration.username.trim() !== '';
    const hasPassword = integration.password && integration.password.trim() !== '';

    // Integration is configured if it has at least one set of credentials
    return hasApiKey || hasApiSecret || hasClientId || hasClientSecret || hasUsername || hasPassword;
  };

  const handleToggleVendor = async (vendorType, currentEnabled) => {
    const integration = vendorIntegrations.find(v => v.vendor_type === vendorType);

    // Don't allow enabling if not configured
    if (!currentEnabled && !isIntegrationConfigured(integration)) {
      alert('Please configure this integration before enabling it.');
      return;
    }

    setToggling(prev => ({ ...prev, [vendorType]: true }));
    try {
      await api.toggleVendorIntegration(vendorType, !currentEnabled);
      await fetchIntegrations();
    } catch (err) {
      console.error('Error toggling vendor integration:', err);
      alert('Failed to toggle integration: ' + err.message);
    } finally {
      setToggling(prev => ({ ...prev, [vendorType]: false }));
    }
  };

  const getVendorDisplayName = (vendorType) => {
    const names = {
      'surescripts': 'Surescripts (ePrescribing)',
      'labcorp': 'Labcorp (Lab Orders)',
      'optum': 'Optum (Claims)'
    };
    return names[vendorType] || vendorType;
  };

  const hasFormChanges = (key) => {
    if (!formData[key] || !originalData[key]) {
      console.log(`[hasFormChanges][${key}] Missing data, returning false`);
      return false;
    }

    // Compare each field individually to detect changes
    const currentData = formData[key];
    const originalDataForKey = originalData[key];

    for (const field in currentData) {
      const currentValue = currentData[field];
      const originalValue = originalDataForKey[field];

      // For strings, compare trimmed values
      if (typeof currentValue === 'string' && typeof originalValue === 'string') {
        const currentTrimmed = currentValue.trim();
        const originalTrimmed = originalValue.trim();
        if (currentTrimmed !== originalTrimmed) {
          console.log(`[hasFormChanges][${key}] Field '${field}' changed: "${originalTrimmed}" -> "${currentTrimmed}"`);
          return true;
        }
      } else if (currentValue !== originalValue) {
        console.log(`[hasFormChanges][${key}] Field '${field}' changed: ${originalValue} -> ${currentValue}`);
        return true;
      }
    }

    console.log(`[hasFormChanges][${key}] No changes detected`);
    return false;
  };

  const hasAnyFormValue = (key) => {
    if (!formData[key]) {
      console.log(`[hasAnyFormValue][${key}] No formData, returning false`);
      return false;
    }

    const data = formData[key];

    // Check if any credential field has a non-empty value
    for (const field in data) {
      const value = data[field];

      // Skip boolean fields
      if (typeof value === 'boolean') continue;

      // Check if string field has a value
      if (typeof value === 'string' && value.trim() !== '') {
        console.log(`[hasAnyFormValue][${key}] Found non-empty field '${field}': "${value.trim()}"`);
        return true;
      }
    }

    console.log(`[hasAnyFormValue][${key}] No non-empty values found`);
    return false;
  };

  const toggleExpanded = (key) => {
    setExpandedIntegrations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleFieldChange = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleSaveVendor = async (vendorType) => {
    const key = `vendor_${vendorType}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    try {
      await api.saveVendorIntegrationSettings(vendorType, formData[key]);
      await fetchIntegrations();
      alert('Vendor integration settings saved successfully');
    } catch (err) {
      console.error('Error saving vendor settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderIntegrationCard = (integration, type, displayName, onToggle, category, onSave) => {
    const isConfigured = isIntegrationConfigured(integration);
    const isEnabled = integration?.is_enabled || false;
    const canEnable = isConfigured;
    const statusColor = isEnabled ? 'green' : isConfigured ? 'yellow' : 'red';
    const statusText = isEnabled ? 'Active' : isConfigured ? 'Configured' : 'Not Configured';
    const key = `${category}_${type}`;
    const isExpanded = expandedIntegrations[key];

    // SEC-14: the form values (which can include API keys) are no longer logged.

    // Check if form has changes and values
    const hasChanges = hasFormChanges(key);
    const hasValues = hasAnyFormValue(key);

    // Debug logging
    console.log(`[${key}] hasChanges:`, hasChanges, 'hasValues:', hasValues);

    // Save button should be DISABLED when:
    // 1. No values entered (empty form) - hasValues = false
    // 2. No changes made (form matches original) - hasChanges = false
    // Save button should be ENABLED when:
    // - User has entered values AND made changes
    const isSaveDisabled = !hasValues || !hasChanges;

    console.log(`[${key}] isSaveDisabled:`, isSaveDisabled);

    return (
      <div key={type} className={`rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {displayName}
              </span>
              <button
                onClick={() => toggleExpanded(key)}
                className={`p-1 rounded hover:bg-opacity-20 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                title={isExpanded ? 'Collapse' : 'Expand to configure'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 bg-${statusColor}-500/20 text-${statusColor}-400 rounded text-xs`}>
                {statusText}
              </span>
              <button
                onClick={() => onToggle(type, isEnabled)}
                disabled={toggling[type] || (!isEnabled && !canEnable)}
                className={`transition-colors ${
                  toggling[type] || (!isEnabled && !canEnable)
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:opacity-80 cursor-pointer'
                }`}
                title={!isEnabled && !canEnable ? 'Configure integration first' : isEnabled ? 'Disable' : 'Enable'}
              >
                {isEnabled ? (
                  <ToggleRight className="w-6 h-6 text-green-400" />
                ) : (
                  <ToggleLeft className={`w-6 h-6 ${canEnable ? 'text-gray-400' : 'text-gray-600'}`} />
                )}
              </button>
            </div>
          </div>
          {!isExpanded && !isConfigured && (
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              No credentials configured - Click to expand
            </p>
          )}
          {!isExpanded && isConfigured && (
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              {integration.api_key ? 'API Key: •••••••••••' : ''}
              {integration.client_id ? 'Client ID: •••••••••••' : ''}
              {integration.username ? 'Username: ' + integration.username : ''}
            </p>
          )}
        </div>

        {/* Expanded Configuration Form */}
        {isExpanded && formData[key] && (
          <div className={`px-4 pb-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <div className="mt-4 space-y-3">
              {category === 'vendor' && (
                <>
                  {['surescripts', 'optum'].includes(type) && (
                    <>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Client ID
                        </label>
                        <input
                          type="text"
                          value={formData[key].client_id || ''}
                          onChange={(e) => handleFieldChange(key, 'client_id', e.target.value)}
                          className={`w-full px-3 py-2 rounded text-sm ${
                            theme === 'dark'
                              ? 'bg-slate-900 text-white border-slate-700'
                              : 'bg-white text-gray-900 border-gray-300'
                          } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder="Enter client ID"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={formData[key].client_secret || ''}
                          onChange={(e) => handleFieldChange(key, 'client_secret', e.target.value)}
                          className={`w-full px-3 py-2 rounded text-sm ${
                            theme === 'dark'
                              ? 'bg-slate-900 text-white border-slate-700'
                              : 'bg-white text-gray-900 border-gray-300'
                          } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder={integration.has_client_secret ? '•••••••• saved — leave blank to keep' : 'Enter client secret'}
                        />
                      </div>
                    </>
                  )}
                  {type === 'labcorp' && (
                    <>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Username
                        </label>
                        <input
                          type="text"
                          value={formData[key].username || ''}
                          onChange={(e) => handleFieldChange(key, 'username', e.target.value)}
                          className={`w-full px-3 py-2 rounded text-sm ${
                            theme === 'dark'
                              ? 'bg-slate-900 text-white border-slate-700'
                              : 'bg-white text-gray-900 border-gray-300'
                          } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder="Enter username"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          Password
                        </label>
                        <input
                          type="password"
                          value={formData[key].password || ''}
                          onChange={(e) => handleFieldChange(key, 'password', e.target.value)}
                          className={`w-full px-3 py-2 rounded text-sm ${
                            theme === 'dark'
                              ? 'bg-slate-900 text-white border-slate-700'
                              : 'bg-white text-gray-900 border-gray-300'
                          } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                          placeholder={integration.has_password ? '•••••••• saved — leave blank to keep' : 'Enter password'}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={formData[key].base_url || ''}
                      onChange={(e) => handleFieldChange(key, 'base_url', e.target.value)}
                      className={`w-full px-3 py-2 rounded text-sm ${
                        theme === 'dark'
                          ? 'bg-slate-900 text-white border-slate-700'
                          : 'bg-white text-gray-900 border-gray-300'
                      } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      placeholder="Enter base URL"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`${key}-sandbox`}
                      checked={formData[key].sandbox_mode || false}
                      onChange={(e) => handleFieldChange(key, 'sandbox_mode', e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor={`${key}-sandbox`} className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      Sandbox Mode
                    </label>
                  </div>
                </>
              )}

              <button
                onClick={() => onSave(type)}
                disabled={isSaveDisabled || saving[key]}
                className={`w-full mt-4 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  isSaveDisabled || saving[key]
                    ? 'bg-gray-400 cursor-not-allowed opacity-50'
                    : 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'
                } text-white`}
              >
                <Save className="w-4 h-4" />
                {saving[key] ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t?.apiAndIntegrations || 'API & Integrations'}
          </h2>
        </div>
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
          Loading integrations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t?.apiAndIntegrations || 'API & Integrations'}
          </h2>
        </div>
        <div className={`text-center py-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          Error loading integrations: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Vendor Integrations */}
      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t?.vendorIntegrations || 'Vendor Integrations'}
        </h3>
        <div className="space-y-3">
          {['surescripts', 'labcorp', 'optum'].map(vendorType => {
            const integration = vendorIntegrations.find(v => v.vendor_type === vendorType);
            return renderIntegrationCard(
              integration || { vendor_type: vendorType },
              vendorType,
              getVendorDisplayName(vendorType),
              handleToggleVendor,
              'vendor',
              handleSaveVendor
            );
          })}
        </div>
      </div>

      {/* AI: bring-your-own-key providers, feature switches with cost guidance, review queue */}
      <AIIntegrationsSection theme={theme} t={t} isAdmin={isAdmin} />
    </div>
  );
};

export default IntegrationsView;
