import React, { useState, useEffect } from 'react';
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api/apiService';

const IntegrationsView = ({ theme, setCurrentModule, t }) => {
  const [vendorIntegrations, setVendorIntegrations] = useState([]);
  const [telehealthProviders, setTelehealthProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const [vendorSettings, telehealthSettings] = await Promise.all([
        api.getVendorIntegrationSettings().catch(() => []),
        api.getTelehealthSettings().catch(() => [])
      ]);
      setVendorIntegrations(vendorSettings);
      setTelehealthProviders(telehealthSettings);
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

    setToggling({ ...toggling, [vendorType]: true });
    try {
      await api.toggleVendorIntegration(vendorType, !currentEnabled);
      await fetchIntegrations();
    } catch (err) {
      console.error('Error toggling vendor integration:', err);
      alert('Failed to toggle integration: ' + err.message);
    } finally {
      setToggling({ ...toggling, [vendorType]: false });
    }
  };

  const handleToggleTelehealth = async (providerType, currentEnabled) => {
    const provider = telehealthProviders.find(p => p.provider_type === providerType);

    // Don't allow enabling if not configured
    if (!currentEnabled && !isIntegrationConfigured(provider)) {
      alert('Please configure this provider before enabling it.');
      return;
    }

    setToggling({ ...toggling, [providerType]: true });
    try {
      await api.toggleTelehealthProvider(providerType, !currentEnabled);
      await fetchIntegrations();
    } catch (err) {
      console.error('Error toggling telehealth provider:', err);
      alert('Failed to toggle provider: ' + err.message);
    } finally {
      setToggling({ ...toggling, [providerType]: false });
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

  const renderIntegrationCard = (integration, type, displayName, onToggle) => {
    const isConfigured = isIntegrationConfigured(integration);
    const isEnabled = integration?.is_enabled || false;
    const canEnable = isConfigured;
    const statusColor = isEnabled ? 'green' : isConfigured ? 'yellow' : 'red';
    const statusText = isEnabled ? 'Active' : isConfigured ? 'Configured' : 'Not Configured';

    return (
      <div key={type} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
            {displayName}
          </span>
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
        {!isConfigured && (
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            No credentials configured
          </p>
        )}
        {isConfigured && (
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            {integration.api_key ? 'API Key: •••••••••••' : ''}
            {integration.client_id ? 'Client ID: •••••••••••' : ''}
            {integration.username ? 'Username: ' + integration.username : ''}
          </p>
        )}
      </div>
    );
  };

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
                handleToggleVendor
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
                handleToggleTelehealth
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
