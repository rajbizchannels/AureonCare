import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Save } from 'lucide-react';
import api from '../api/apiService';
import { useAudit } from '../hooks/useAudit';

const IntegrationsView = ({ theme, setCurrentModule, t }) => {
  const [vendorIntegrations, setVendorIntegrations] = useState([]);
  const [telehealthProviders, setTelehealthProviders] = useState([]);
  const [stripeSettings, setStripeSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState({});
  const [expandedIntegrations, setExpandedIntegrations] = useState({});
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [saving, setSaving] = useState({});
  const [testingStripe, setTestingStripe] = useState(false);

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
      const [vendorSettings, telehealthSettings, stripeData] = await Promise.all([
        api.getVendorIntegrationSettings().catch(() => []),
        api.getTelehealthSettings().catch(() => []),
        api.getStripeSettings().catch(() => ({}))
      ]);
      setVendorIntegrations(vendorSettings);
      setTelehealthProviders(telehealthSettings);
      setStripeSettings(stripeData);

      // Initialize form data and original data
      const allIntegrations = {};
      const allOriginal = {};

      // Initialize all vendor types (even if not in database)
      ['surescripts', 'labcorp', 'optum'].forEach(vendorType => {
        const vendor = vendorSettings.find(v => v.vendor_type === vendorType);
        const key = `vendor_${vendorType}`;
        allIntegrations[key] = {
          api_key: vendor?.api_key || '',
          api_secret: vendor?.api_secret || '',
          client_id: vendor?.client_id || '',
          client_secret: vendor?.client_secret || '',
          username: vendor?.username || '',
          password: vendor?.password || '',
          base_url: vendor?.base_url || '',
          sandbox_mode: vendor?.sandbox_mode || false
        };
        allOriginal[key] = { ...allIntegrations[key] };
      });

      // Initialize all telehealth provider types (even if not in database)
      ['zoom', 'google-meet', 'webex'].forEach(providerType => {
        const provider = telehealthSettings.find(p => p.provider_type === providerType);
        const key = `telehealth_${providerType}`;
        allIntegrations[key] = {
          api_key: provider?.api_key || '',
          api_secret: provider?.api_secret || '',
          client_id: provider?.client_id || '',
          client_secret: provider?.client_secret || '',
          webhook_secret: provider?.webhook_secret || ''
        };
        allOriginal[key] = { ...allIntegrations[key] };
      });

      // Initialize Stripe form data
      allIntegrations['stripe'] = {
        publishable_key: stripeData?.publishable_key || '',
        secret_key: '',
        webhook_secret: '',
        sandbox_mode: stripeData?.sandbox_mode !== undefined ? stripeData.sandbox_mode : true,
        use_platform_integration: stripeData?.use_platform_integration || false
      };
      allOriginal['stripe'] = { ...allIntegrations['stripe'] };

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

  const handleToggleTelehealth = async (providerType, currentEnabled) => {
    const provider = telehealthProviders.find(p => p.provider_type === providerType);

    // Don't allow enabling if not configured
    if (!currentEnabled && !isIntegrationConfigured(provider)) {
      alert('Please configure this provider before enabling it.');
      return;
    }

    setToggling(prev => ({ ...prev, [providerType]: true }));
    try {
      await api.toggleTelehealthProvider(providerType, !currentEnabled);
      await fetchIntegrations();
    } catch (err) {
      console.error('Error toggling telehealth provider:', err);
      alert('Failed to toggle provider: ' + err.message);
    } finally {
      setToggling(prev => ({ ...prev, [providerType]: false }));
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

  const getProviderDisplayName = (providerType) => {
    const names = {
      'zoom': 'Zoom',
      'google-meet': 'Google Meet',
      'webex': 'Webex'
    };
    return names[providerType] || providerType;
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

  const handleSaveTelehealth = async (providerType) => {
    const key = `telehealth_${providerType}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    try {
      await api.saveTelehealthSettings(providerType, formData[key]);
      await fetchIntegrations();
      alert('Telehealth provider settings saved successfully');
    } catch (err) {
      console.error('Error saving telehealth settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleToggleStripe = async (currentEnabled) => {
    const isConfigured = stripeSettings?.use_platform_integration ||
      stripeSettings?.publishable_key ||
      stripeSettings?.has_secret_key;

    if (!currentEnabled && !isConfigured) {
      alert('Please configure Stripe before enabling it.');
      return;
    }

    setToggling(prev => ({ ...prev, stripe: true }));
    try {
      const updated = await api.toggleStripeIntegration(!currentEnabled);
      setStripeSettings(prev => ({ ...prev, is_enabled: updated.is_enabled }));
    } catch (err) {
      console.error('Error toggling Stripe:', err);
      alert('Failed to toggle Stripe: ' + err.message);
    } finally {
      setToggling(prev => ({ ...prev, stripe: false }));
    }
  };

  const handleSaveStripe = async () => {
    setSaving(prev => ({ ...prev, stripe: true }));
    try {
      const payload = { ...formData['stripe'] };
      // Don't send empty secret fields (keeps existing values on server)
      if (!payload.secret_key) delete payload.secret_key;
      if (!payload.webhook_secret) delete payload.webhook_secret;

      const updated = await api.saveStripeSettings(payload);
      setStripeSettings(prev => ({ ...prev, ...updated }));
      // Reset secret fields in form (they're never returned from server)
      setFormData(prev => ({
        ...prev,
        stripe: {
          ...prev.stripe,
          secret_key: '',
          webhook_secret: ''
        }
      }));
      setOriginalData(prev => ({
        ...prev,
        stripe: { ...formData['stripe'], secret_key: '', webhook_secret: '' }
      }));
      alert('Stripe settings saved successfully');
    } catch (err) {
      console.error('Error saving Stripe settings:', err);
      alert('Failed to save Stripe settings: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, stripe: false }));
    }
  };

  const handleTestStripe = async () => {
    setTestingStripe(true);
    try {
      const result = await api.testStripeConnection();
      alert('Stripe connection successful: ' + result.message);
      await fetchIntegrations();
    } catch (err) {
      alert('Stripe test failed: ' + err.message);
    } finally {
      setTestingStripe(false);
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

    // Ensure formData[key] and originalData[key] exist
    const currentFormData = formData[key] || {};
    const currentOriginalData = originalData[key] || {};

    // Check if form has changes and values
    const hasChanges = hasFormChanges(key);
    const hasValues = hasAnyFormValue(key);

    // Debug logging
    console.log(`[${key}] hasChanges:`, hasChanges, 'hasValues:', hasValues);
    console.log(`[${key}] formData:`, currentFormData);
    console.log(`[${key}] originalData:`, currentOriginalData);

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
              {category === 'vendor' ? (
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
                          placeholder="Enter client secret"
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
                          placeholder="Enter password"
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
              ) : (
                <>
                  {/* Telehealth providers: show only fields that have values,
                      plus always show Client ID/Secret for OAuth-based providers (Zoom, Google Meet) */}
                  {(() => {
                    const data = formData[key] || {};
                    const hasApiKey = data.api_key && data.api_key.trim() !== '';
                    const hasApiSecret = data.api_secret && data.api_secret.trim() !== '';
                    const hasClientId = data.client_id && data.client_id.trim() !== '';
                    const hasClientSecret = data.client_secret && data.client_secret.trim() !== '';
                    const hasWebhookSecret = data.webhook_secret && data.webhook_secret.trim() !== '';
                    // For OAuth providers (Zoom, Google Meet), always show Client ID/Secret
                    const isOAuthProvider = type !== 'webex';
                    // Show legacy fields only if they have values
                    const showApiKey = hasApiKey;
                    const showApiSecret = hasApiSecret;
                    // Show OAuth fields if provider supports OAuth or if values exist
                    const showClientId = isOAuthProvider || hasClientId;
                    const showClientSecret = isOAuthProvider || hasClientSecret;
                    const showWebhookSecret = hasWebhookSecret;

                    return (
                      <>
                        {showApiKey && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              API Key <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>(Legacy)</span>
                            </label>
                            <input
                              type="text"
                              value={data.api_key || ''}
                              onChange={(e) => handleFieldChange(key, 'api_key', e.target.value)}
                              className={`w-full px-3 py-2 rounded text-sm ${
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white border-slate-700'
                                  : 'bg-white text-gray-900 border-gray-300'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="Enter API key"
                            />
                          </div>
                        )}
                        {showApiSecret && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              API Secret <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>(Legacy)</span>
                            </label>
                            <input
                              type="password"
                              value={data.api_secret || ''}
                              onChange={(e) => handleFieldChange(key, 'api_secret', e.target.value)}
                              className={`w-full px-3 py-2 rounded text-sm ${
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white border-slate-700'
                                  : 'bg-white text-gray-900 border-gray-300'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="Enter API secret"
                            />
                          </div>
                        )}
                        {showClientId && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              Client ID
                            </label>
                            <input
                              type="text"
                              value={data.client_id || ''}
                              onChange={(e) => handleFieldChange(key, 'client_id', e.target.value)}
                              className={`w-full px-3 py-2 rounded text-sm ${
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white border-slate-700'
                                  : 'bg-white text-gray-900 border-gray-300'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="Enter client ID"
                            />
                          </div>
                        )}
                        {showClientSecret && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              Client Secret
                            </label>
                            <input
                              type="password"
                              value={data.client_secret || ''}
                              onChange={(e) => handleFieldChange(key, 'client_secret', e.target.value)}
                              className={`w-full px-3 py-2 rounded text-sm ${
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white border-slate-700'
                                  : 'bg-white text-gray-900 border-gray-300'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="Enter client secret"
                            />
                          </div>
                        )}
                        {showWebhookSecret && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                              Webhook Secret
                            </label>
                            <input
                              type="password"
                              value={data.webhook_secret || ''}
                              onChange={(e) => handleFieldChange(key, 'webhook_secret', e.target.value)}
                              className={`w-full px-3 py-2 rounded text-sm ${
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white border-slate-700'
                                  : 'bg-white text-gray-900 border-gray-300'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                              placeholder="Enter webhook secret"
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
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

  // Pre-compute Stripe card values so the render section stays simple JSX
  const stripeFormData = formData['stripe'] || {};
  const stripeIsEnabled = stripeSettings?.is_enabled || false;
  const stripeIsUsingPlatform = stripeFormData.use_platform_integration || false;
  const stripeIsConfigured = stripeIsUsingPlatform ||
    !!(stripeSettings?.publishable_key) ||
    !!(stripeSettings?.has_secret_key);
  const stripeStatusColor = stripeIsEnabled ? 'green' : stripeIsConfigured ? 'yellow' : 'red';
  const stripeStatusText = stripeIsEnabled ? 'Active' : stripeIsConfigured ? 'Configured' : 'Not Configured';
  const stripeIsExpanded = expandedIntegrations['stripe'];

  // Save is allowed when any field has a value or when platform toggle was changed
  const stripeHasStringValue = Object.entries(stripeFormData).some(([k, v]) =>
    typeof v === 'string' && v.trim() !== ''
  );
  const stripeHasBooleanChange = stripeFormData.use_platform_integration !== (originalData['stripe']?.use_platform_integration || false) ||
    stripeFormData.sandbox_mode !== (originalData['stripe']?.sandbox_mode !== undefined ? originalData['stripe']?.sandbox_mode : true);
  const stripeIsSaveDisabled = (!stripeHasStringValue && !stripeHasBooleanChange) || saving['stripe'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t?.backToDashboard || 'Back to Dashboard'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
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
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t?.backToDashboard || 'Back to Dashboard'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentModule && setCurrentModule('dashboard')}
          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          title={t?.backToDashboard || 'Back to Dashboard'}
        >
          <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
        </button>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t?.apiAndIntegrations || 'API & Integrations'}
        </h2>
      </div>

      {/* Stripe Integration - full width */}
      <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Payment Processing
        </h3>
        <div className={`rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Stripe
                </span>
                <button
                  onClick={() => toggleExpanded('stripe')}
                  className={`p-1 rounded hover:bg-opacity-20 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                  title={stripeIsExpanded ? 'Collapse' : 'Expand to configure'}
                >
                  {stripeIsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  stripeStatusColor === 'green' ? 'bg-green-500/20 text-green-400' :
                  stripeStatusColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {stripeStatusText}
                </span>
                <button
                  onClick={() => handleToggleStripe(stripeIsEnabled)}
                  disabled={toggling['stripe'] || (!stripeIsEnabled && !stripeIsConfigured)}
                  className={`transition-colors ${
                    toggling['stripe'] || (!stripeIsEnabled && !stripeIsConfigured)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-80 cursor-pointer'
                  }`}
                  title={!stripeIsEnabled && !stripeIsConfigured ? 'Configure Stripe first' : stripeIsEnabled ? 'Disable' : 'Enable'}
                >
                  {stripeIsEnabled ? (
                    <ToggleRight className="w-6 h-6 text-green-400" />
                  ) : (
                    <ToggleLeft className={`w-6 h-6 ${stripeIsConfigured ? 'text-gray-400' : 'text-gray-600'}`} />
                  )}
                </button>
              </div>
            </div>
            {!stripeIsExpanded && !stripeIsConfigured && (
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                No credentials configured — Click to expand
              </p>
            )}
            {!stripeIsExpanded && stripeIsConfigured && (
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                {stripeIsUsingPlatform ? 'Using platform Stripe account' : 'Custom Stripe keys configured'}
                {stripeSettings?.test_status === 'success' ? ' · Last test: OK' : ''}
                {stripeSettings?.test_status === 'failed' ? ' · Last test: Failed' : ''}
              </p>
            )}
          </div>

          {stripeIsExpanded && (
            <div className={`px-4 pb-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <div className="mt-4 space-y-3">
                {/* Platform integration toggle */}
                <div className={`flex items-start gap-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
                  <input
                    type="checkbox"
                    id="stripe-platform"
                    checked={stripeFormData.use_platform_integration || false}
                    onChange={(e) => handleFieldChange('stripe', 'use_platform_integration', e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <label htmlFor="stripe-platform" className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      Use platform Stripe account
                    </label>
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                      Payments are processed through the platform's Stripe account. No custom keys required.
                    </p>
                  </div>
                </div>

                {!stripeIsUsingPlatform && (
                  <>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Publishable Key
                      </label>
                      <input
                        type="text"
                        value={stripeFormData.publishable_key || ''}
                        onChange={(e) => handleFieldChange('stripe', 'publishable_key', e.target.value)}
                        className={`w-full px-3 py-2 rounded text-sm font-mono ${
                          theme === 'dark'
                            ? 'bg-slate-900 text-white border-slate-700'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="pk_live_... or pk_test_..."
                      />
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                        Safe to expose in client-side code
                      </p>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Secret Key {stripeSettings?.has_secret_key ? <span className="text-green-500">(saved)</span> : null}
                      </label>
                      <input
                        type="password"
                        value={stripeFormData.secret_key || ''}
                        onChange={(e) => handleFieldChange('stripe', 'secret_key', e.target.value)}
                        className={`w-full px-3 py-2 rounded text-sm font-mono ${
                          theme === 'dark'
                            ? 'bg-slate-900 text-white border-slate-700'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder={stripeSettings?.has_secret_key ? '•••••••••••••• (leave blank to keep existing)' : 'sk_live_... or sk_test_...'}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Webhook Secret {stripeSettings?.has_webhook_secret ? <span className="text-green-500">(saved)</span> : null}
                      </label>
                      <input
                        type="password"
                        value={stripeFormData.webhook_secret || ''}
                        onChange={(e) => handleFieldChange('stripe', 'webhook_secret', e.target.value)}
                        className={`w-full px-3 py-2 rounded text-sm font-mono ${
                          theme === 'dark'
                            ? 'bg-slate-900 text-white border-slate-700'
                            : 'bg-white text-gray-900 border-gray-300'
                        } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder={stripeSettings?.has_webhook_secret ? '•••••••••••••• (leave blank to keep existing)' : 'whsec_...'}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stripe-sandbox"
                    checked={stripeFormData.sandbox_mode !== undefined ? stripeFormData.sandbox_mode : true}
                    onChange={(e) => handleFieldChange('stripe', 'sandbox_mode', e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="stripe-sandbox" className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Test / Sandbox Mode
                  </label>
                </div>

                {stripeSettings?.last_tested_at && (
                  <p className={`text-xs ${stripeSettings.test_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    Last test: {stripeSettings.test_status === 'success' ? 'Passed' : 'Failed'}
                    {stripeSettings.test_message ? ` — ${stripeSettings.test_message}` : ''}
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveStripe}
                    disabled={stripeIsSaveDisabled}
                    className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      stripeIsSaveDisabled
                        ? 'bg-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'
                    } text-white`}
                  >
                    <Save className="w-4 h-4" />
                    {saving['stripe'] ? 'Saving...' : 'Save Configuration'}
                  </button>
                  <button
                    onClick={handleTestStripe}
                    disabled={testingStripe || !stripeIsConfigured}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm ${
                      testingStripe || !stripeIsConfigured
                        ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                        : theme === 'dark'
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    title="Test Stripe connection"
                  >
                    {testingStripe ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Telehealth Providers */}
        <div className={`bg-gradient-to-br rounded-xl p-6 border ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t?.telehealthProviders || 'Telehealth Providers'}
          </h3>

          <div className="space-y-3">
            {['zoom', 'google-meet', 'webex'].map(providerType => {
              const provider = telehealthProviders.find(p => p.provider_type === providerType);
              return renderIntegrationCard(
                provider || { provider_type: providerType },
                providerType,
                getProviderDisplayName(providerType),
                handleToggleTelehealth,
                'telehealth',
                handleSaveTelehealth
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
