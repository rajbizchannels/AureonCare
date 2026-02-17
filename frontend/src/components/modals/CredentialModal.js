import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Key, User, Zap, Check } from 'lucide-react';
import { useAudit } from '../../hooks/useAudit';

/**
 * CredentialModal - Themed modal for collecting OAuth credentials
 * Replaces browser prompts with a professional UI
 * Supports both create and edit modes
 */
const CredentialModal = ({
  isOpen,
  onClose,
  onSubmit,
  providerName,
  theme,
  credentialType = 'oauth',
  existingCredentials = null // For edit mode
}) => {
  const { logModalOpen, logModalClose, logError, startAction } = useAudit();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(existingCredentials);

  // Log modal open
  useEffect(() => {
    if (isOpen) {
      startAction();
      logModalOpen('CredentialModal', {
        module: 'Admin',
        metadata: {
          provider: providerName,
          credentialType: credentialType,
          mode: isEditMode ? 'edit' : 'create',
        },
      });
    }
  }, [isOpen, logModalOpen, startAction, providerName, credentialType, isEditMode]);

  // Pre-populate form when editing
  useEffect(() => {
    if (existingCredentials) {
      if (credentialType === 'oauth') {
        setClientId(existingCredentials.client_id || '');
        setClientSecret(existingCredentials.client_secret || '');
      } else if (credentialType === 'api_key') {
        setApiKey(existingCredentials.client_secret || existingCredentials.api_key || '');
        setClientId(existingCredentials.client_id || '');
      }
    }
  }, [existingCredentials, credentialType]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (credentialType === 'oauth') {
      if (!clientId.trim()) {
        newErrors.clientId = 'Client ID is required';
      }
      if (!clientSecret.trim()) {
        newErrors.clientSecret = 'Client Secret is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      onSubmit({ client_id: clientId, client_secret: clientSecret });
    } else if (credentialType === 'api_key') {
      if (!apiKey.trim()) {
        newErrors.apiKey = 'API Key is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      onSubmit({
        client_id: clientId || 'api_key_auth',
        client_secret: apiKey
      });
    }

    // Reset form
    setClientId('');
    setClientSecret('');
    setApiKey('');
    setErrors({});
  };

  const handleClose = () => {
    logModalClose('CredentialModal', {
      module: 'Admin',
      metadata: {
        provider: providerName,
        credentialType: credentialType,
      },
    });
    setClientId('');
    setClientSecret('');
    setApiKey('');
    setErrors({});
    onClose();
  };

  const getProviderInstructions = () => {
    const instructions = {
      zoom: {
        title: 'Zoom OAuth Credentials',
        clientIdLabel: 'Client ID',
        clientSecretLabel: 'Client Secret',
        instructions: 'Get these credentials from the Zoom App Marketplace: marketplace.zoom.us',
      },
      google_meet: {
        title: 'Google Meet OAuth Credentials',
        clientIdLabel: 'Client ID',
        clientSecretLabel: 'Client Secret',
        instructions: 'Create credentials at Google Cloud Console: console.cloud.google.com/apis/credentials',
      },
      webex: {
        title: 'Cisco Webex OAuth Credentials',
        clientIdLabel: 'Client ID',
        clientSecretLabel: 'Client Secret',
        instructions: 'Register your app at: developer.webex.com',
      },
      google_drive: {
        title: 'Google Drive OAuth Credentials',
        clientIdLabel: 'Client ID',
        clientSecretLabel: 'Client Secret',
        instructions: 'Create credentials at Google Cloud Console and enable Google Drive API',
      },
      onedrive: {
        title: 'OneDrive OAuth Credentials',
        clientIdLabel: 'Application (client) ID',
        clientSecretLabel: 'Client Secret Value',
        instructions: 'Register your app at Azure Portal: portal.azure.com → App registrations',
      },
      surescripts: {
        title: 'Surescripts API Credentials',
        apiKeyLabel: 'API Key',
        clientIdLabel: 'Client ID (optional)',
        instructions: 'Get your API credentials from Surescripts account settings',
      },
      labcorp: {
        title: 'Labcorp API Credentials',
        apiKeyLabel: 'API Key',
        clientIdLabel: 'Client ID (optional)',
        instructions: 'Obtain API credentials from your Labcorp developer account',
      },
      optum: {
        title: 'Optum API Credentials',
        apiKeyLabel: 'API Key',
        clientIdLabel: 'Client ID (optional)',
        instructions: 'Get API credentials from Optum developer portal',
      },
    };

    return instructions[providerName?.toLowerCase()] || {
      title: `${providerName} Credentials`,
      clientIdLabel: 'Client ID',
      clientSecretLabel: 'Client Secret',
      instructions: `Enter your ${providerName} credentials`,
    };
  };

  const config = getProviderInstructions();

  return (
    <div
      className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-black/50' : 'bg-black/30'
      }`}
      onClick={handleClose}
    >
      <div
        className={`rounded-xl border max-w-md w-full ${
          theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {isEditMode ? `Edit ${config.title}` : config.title}
          </h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Instructions */}
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
          }`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
              {config.instructions}
            </p>
          </div>

          {/* One-Click Integration callout for OAuth providers */}
          {credentialType === 'oauth' && (
            <div className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                <Zap className={`w-5 h-5 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                <div>
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                    One-Click Integration
                  </p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-green-400/70' : 'text-green-600'}`}>
                    {isEditMode
                      ? 'Update your credentials below and click "Update & Connect" to re-authorize via OAuth.'
                      : 'Enter your credentials below and click "Save & Connect" to authorize via OAuth in one step.'
                    }
                  </p>
                  {isEditMode && existingCredentials?.client_id && (
                    <div className={`flex items-center gap-1.5 mt-2 ${theme === 'dark' ? 'text-green-400/60' : 'text-green-600/80'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-xs">Credentials saved</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {credentialType === 'oauth' ? (
            <>
              {/* Client ID */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  {config.clientIdLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      setErrors({ ...errors, clientId: null });
                    }}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } ${errors.clientId ? 'border-red-500' : ''}`}
                    placeholder="Enter client ID"
                  />
                </div>
                {errors.clientId && (
                  <p className="mt-1 text-sm text-red-500">{errors.clientId}</p>
                )}
              </div>

              {/* Client Secret */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  {config.clientSecretLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => {
                      setClientSecret(e.target.value);
                      setErrors({ ...errors, clientSecret: null });
                    }}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } ${errors.clientSecret ? 'border-red-500' : ''}`}
                    placeholder="Enter client secret"
                  />
                </div>
                {errors.clientSecret && (
                  <p className="mt-1 text-sm text-red-500">{errors.clientSecret}</p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* API Key */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  {config.apiKeyLabel || 'API Key'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setErrors({ ...errors, apiKey: null });
                    }}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } ${errors.apiKey ? 'border-red-500' : ''}`}
                    placeholder="Enter API key"
                  />
                </div>
                {errors.apiKey && (
                  <p className="mt-1 text-sm text-red-500">{errors.apiKey}</p>
                )}
              </div>

              {/* Optional Client ID */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  {config.clientIdLabel || 'Client ID'} <span className={`text-sm font-normal ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                  }`}>(optional)</span>
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="Enter client ID (if applicable)"
                  />
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={`flex-1 px-4 py-2 border rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                credentialType === 'oauth'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {credentialType === 'oauth' && <Zap className="w-4 h-4" />}
              {credentialType === 'oauth'
                ? (isEditMode ? 'Update & Connect' : 'Save & Connect')
                : (isEditMode ? 'Update & Continue' : 'Save & Continue')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

CredentialModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  providerName: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  credentialType: PropTypes.oneOf(['oauth', 'api_key']),
  existingCredentials: PropTypes.object,
};

export default CredentialModal;
