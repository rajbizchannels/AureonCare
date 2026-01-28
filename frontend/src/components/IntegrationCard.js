/**
 * IntegrationCard Component
 * Reusable component for displaying and configuring integration providers
 * (Telehealth providers, vendor integrations, etc.)
 *
 * Security Note: This component does NOT handle credential storage in state.
 * Credentials should be managed server-side and only configuration status
 * should be displayed here.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Save, Check, AlertCircle } from 'lucide-react';

const IntegrationCard = ({
  name,
  displayName,
  description,
  icon: Icon,
  iconColor,
  isEnabled,
  isConfigured,
  configFields,
  theme,
  onToggle,
  onConfigure,
  onTest,
  testLabel = 'Test Connection',
  t = {},
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleToggle = useCallback(async () => {
    if (onToggle) {
      await onToggle(name, !isEnabled);
    }
  }, [name, isEnabled, onToggle]);

  const handleTest = useCallback(async () => {
    if (!onTest) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTest(name);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  }, [name, onTest]);

  const handleConfigureClick = useCallback(() => {
    if (onConfigure) {
      onConfigure(name);
    } else {
      setShowConfig(!showConfig);
    }
  }, [name, showConfig, onConfigure]);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className={`p-3 rounded-lg ${iconColor || 'bg-blue-500/10'}`}>
                <Icon className={`w-6 h-6 ${iconColor ? 'text-current' : 'text-blue-500'}`} />
              </div>
            )}
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {displayName || name}
              </h3>
              {description && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {description}
                </p>
              )}
              {isConfigured && (
                <div className="flex items-center gap-2 mt-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Configured
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={!isConfigured}
            role="switch"
            aria-checked={isEnabled}
            aria-label={`Toggle ${displayName || name} integration`}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              !isConfigured
                ? theme === 'dark'
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gray-200 cursor-not-allowed'
                : isEnabled
                ? 'bg-green-500'
                : theme === 'dark'
                ? 'bg-slate-600'
                : 'bg-gray-300'
            }`}
            title={!isConfigured ? 'Please configure before enabling' : ''}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Warning if not configured */}
        {!isConfigured && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
              theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
            }`}
          >
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                Configuration Required
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-yellow-400/80' : 'text-yellow-600'}`}>
                Please configure this integration before enabling it.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex gap-3">
        <button
          onClick={handleConfigureClick}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
          }`}
        >
          <Save className="w-4 h-4 inline mr-2" />
          {isConfigured ? 'Reconfigure' : 'Configure'}
        </button>

        {onTest && isConfigured && (
          <button
            onClick={handleTest}
            disabled={isTesting}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-700'
                : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
            }`}
          >
            {isTesting ? 'Testing...' : testLabel}
          </button>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`mx-4 mb-4 p-3 rounded-lg ${
            testResult.success
              ? theme === 'dark'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-green-50 border border-green-200'
              : theme === 'dark'
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              testResult.success
                ? theme === 'dark'
                  ? 'text-green-400'
                  : 'text-green-700'
                : theme === 'dark'
                ? 'text-red-400'
                : 'text-red-700'
            }`}
          >
            {testResult.message}
          </p>
        </div>
      )}
    </div>
  );
};

IntegrationCard.propTypes = {
  /** Unique identifier for the integration */
  name: PropTypes.string.isRequired,
  /** Display name shown to users */
  displayName: PropTypes.string,
  /** Description of the integration */
  description: PropTypes.string,
  /** Icon component to display */
  icon: PropTypes.elementType,
  /** Tailwind classes for icon color */
  iconColor: PropTypes.string,
  /** Whether the integration is currently enabled */
  isEnabled: PropTypes.bool.isRequired,
  /** Whether the integration has been configured */
  isConfigured: PropTypes.bool.isRequired,
  /** Configuration fields for the integration */
  configFields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['text', 'password', 'select', 'checkbox']).isRequired,
      required: PropTypes.bool,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.string,
        })
      ),
    })
  ),
  /** Current theme (light/dark) */
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  /** Callback when toggle is clicked */
  onToggle: PropTypes.func,
  /** Callback when configure button is clicked */
  onConfigure: PropTypes.func,
  /** Callback when test button is clicked */
  onTest: PropTypes.func,
  /** Label for test button */
  testLabel: PropTypes.string,
  /** Translation object */
  t: PropTypes.object,
};

export default React.memo(IntegrationCard);
