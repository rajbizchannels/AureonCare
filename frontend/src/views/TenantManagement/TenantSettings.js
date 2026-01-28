/**
 * AUREONCARE TENANT SETTINGS
 *
 * Organization-wide settings management
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import apiService from '../../api/apiService';

const TenantSettings = () => {
    const { tenant, settings, updateSettings, updateBranding, refresh } = useTenant();

    const [activeTab, setActiveTab] = useState('general');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Local state for form editing
    const [generalSettings, setGeneralSettings] = useState({});
    const [schedulingSettings, setSchedulingSettings] = useState({});
    const [billingSettings, setBillingSettings] = useState({});
    const [notificationSettings, setNotificationSettings] = useState({});
    const [brandingSettings, setBrandingSettings] = useState({});
    const [securitySettings, setSecuritySettings] = useState({});

    useEffect(() => {
        // Initialize local state from context
        setGeneralSettings(settings.general || {});
        setSchedulingSettings(settings.scheduling || {});
        setBillingSettings(settings.billing || {});
        setNotificationSettings(settings.notifications || {});
        setBrandingSettings(tenant?.branding || {});
    }, [settings, tenant]);

    useEffect(() => {
        if (activeTab === 'security') {
            loadSecuritySettings();
        }
    }, [activeTab]);

    const loadSecuritySettings = async () => {
        try {
            const data = await apiService.get('/tenant/settings/security');
            setSecuritySettings(data);
        } catch (err) {
            console.error('Failed to load security settings:', err);
        }
    };

    const handleSave = async (category, data) => {
        setSaving(true);
        setMessage(null);

        try {
            if (category === 'branding') {
                await updateBranding(data);
            } else if (category === 'security') {
                await apiService.put('/tenant/settings/security', data);
            } else {
                await updateSettings({ [category]: data });
            }
            setMessage({ type: 'success', text: 'Settings saved successfully' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'general', name: 'General', icon: '⚙️' },
        { id: 'branding', name: 'Branding', icon: '🎨' },
        { id: 'scheduling', name: 'Scheduling', icon: '📅' },
        { id: 'notifications', name: 'Notifications', icon: '🔔' },
        { id: 'security', name: 'Security', icon: '🔒' }
    ];

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
                <p className="text-gray-500 mt-1">Configure your organization's preferences</p>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-4 rounded-lg ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                    <nav className="bg-white rounded-lg shadow p-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full text-left px-4 py-2 rounded-lg mb-1 flex items-center ${
                                    activeTab === tab.id
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg shadow">
                    {activeTab === 'general' && (
                        <GeneralSettings
                            settings={generalSettings}
                            onChange={setGeneralSettings}
                            onSave={() => handleSave('general', generalSettings)}
                            saving={saving}
                        />
                    )}

                    {activeTab === 'branding' && (
                        <BrandingSettings
                            settings={brandingSettings}
                            onChange={setBrandingSettings}
                            onSave={() => handleSave('branding', brandingSettings)}
                            saving={saving}
                        />
                    )}

                    {activeTab === 'scheduling' && (
                        <SchedulingSettings
                            settings={schedulingSettings}
                            onChange={setSchedulingSettings}
                            onSave={() => handleSave('scheduling', schedulingSettings)}
                            saving={saving}
                        />
                    )}

                    {activeTab === 'notifications' && (
                        <NotificationSettings
                            settings={notificationSettings}
                            onChange={setNotificationSettings}
                            onSave={() => handleSave('notifications', notificationSettings)}
                            saving={saving}
                        />
                    )}

                    {activeTab === 'security' && (
                        <SecuritySettings
                            settings={securitySettings}
                            onChange={setSecuritySettings}
                            onSave={() => handleSave('security', securitySettings)}
                            saving={saving}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// General Settings
const GeneralSettings = ({ settings, onChange, onSave, saving }) => (
    <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">General Settings</h2>

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name</label>
                <input
                    type="text"
                    value={settings.clinic_name || ''}
                    onChange={(e) => onChange({ ...settings, clinic_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                        type="tel"
                        value={settings.clinic_phone || ''}
                        onChange={(e) => onChange({ ...settings, clinic_phone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={settings.clinic_email || ''}
                        onChange={(e) => onChange({ ...settings, clinic_email: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                    rows={3}
                    value={settings.clinic_address?.full || ''}
                    onChange={(e) => onChange({ ...settings, clinic_address: { ...settings.clinic_address, full: e.target.value } })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                    <select
                        value={settings.timezone || 'America/New_York'}
                        onChange={(e) => onChange({ ...settings, timezone: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                    <select
                        value={settings.date_format || 'MM/DD/YYYY'}
                        onChange={(e) => onChange({ ...settings, date_format: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                </div>
            </div>

            <div className="pt-4 border-t">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
);

// Branding Settings
const BrandingSettings = ({ settings, onChange, onSave, saving }) => (
    <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Branding</h2>

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                    type="url"
                    value={settings.logo_url || ''}
                    onChange={(e) => onChange({ ...settings, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="color"
                            value={settings.primary_color || '#3B82F6'}
                            onChange={(e) => onChange({ ...settings, primary_color: e.target.value })}
                            className="h-10 w-16 rounded cursor-pointer"
                        />
                        <input
                            type="text"
                            value={settings.primary_color || '#3B82F6'}
                            onChange={(e) => onChange({ ...settings, primary_color: e.target.value })}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="color"
                            value={settings.secondary_color || '#1E40AF'}
                            onChange={(e) => onChange({ ...settings, secondary_color: e.target.value })}
                            className="h-10 w-16 rounded cursor-pointer"
                        />
                        <input
                            type="text"
                            value={settings.secondary_color || '#1E40AF'}
                            onChange={(e) => onChange({ ...settings, secondary_color: e.target.value })}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="color"
                            value={settings.accent_color || '#10B981'}
                            onChange={(e) => onChange({ ...settings, accent_color: e.target.value })}
                            className="h-10 w-16 rounded cursor-pointer"
                        />
                        <input
                            type="text"
                            value={settings.accent_color || '#10B981'}
                            onChange={(e) => onChange({ ...settings, accent_color: e.target.value })}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                    value={settings.font_family || 'Inter'}
                    onChange={(e) => onChange({ ...settings, font_family: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                </select>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Preview</p>
                <div className="flex items-center space-x-4">
                    <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: settings.primary_color || '#3B82F6' }}
                    >
                        AC
                    </div>
                    <div>
                        <p className="font-semibold" style={{ fontFamily: settings.font_family || 'Inter' }}>
                            Your Organization
                        </p>
                        <p className="text-sm" style={{ color: settings.secondary_color || '#1E40AF' }}>
                            Sample text in secondary color
                        </p>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
);

// Scheduling Settings
const SchedulingSettings = ({ settings, onChange, onSave, saving }) => (
    <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Scheduling</h2>

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Appointment Duration (minutes)</label>
                <input
                    type="number"
                    value={settings.default_appointment_duration || 30}
                    onChange={(e) => onChange({ ...settings, default_appointment_duration: parseInt(e.target.value) })}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                        type="time"
                        value={settings.working_hours?.start || '09:00'}
                        onChange={(e) => onChange({ ...settings, working_hours: { ...settings.working_hours, start: e.target.value } })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                        type="time"
                        value={settings.working_hours?.end || '17:00'}
                        onChange={(e) => onChange({ ...settings, working_hours: { ...settings.working_hours, end: e.target.value } })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <label key={day} className="inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={(settings.working_days || [1, 2, 3, 4, 5]).includes(index)}
                                onChange={(e) => {
                                    const days = settings.working_days || [1, 2, 3, 4, 5];
                                    if (e.target.checked) {
                                        onChange({ ...settings, working_days: [...days, index].sort() });
                                    } else {
                                        onChange({ ...settings, working_days: days.filter(d => d !== index) });
                                    }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{day}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
);

// Notification Settings
const NotificationSettings = ({ settings, onChange, onSave, saving }) => (
    <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Notifications</h2>

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Reminder (hours before)</label>
                <input
                    type="number"
                    value={settings.appointment_reminder_hours || 24}
                    onChange={(e) => onChange({ ...settings, appointment_reminder_hours: parseInt(e.target.value) })}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-900">Email Notifications</p>
                        <p className="text-sm text-gray-500">Send notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.email_enabled !== false}
                            onChange={(e) => onChange({ ...settings, email_enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-900">SMS Notifications</p>
                        <p className="text-sm text-gray-500">Send notifications via SMS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.sms_enabled === true}
                            onChange={(e) => onChange({ ...settings, sms_enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            <div className="pt-4 border-t">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
);

// Security Settings
const SecuritySettings = ({ settings, onChange, onSave, saving }) => (
    <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Security</h2>

        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium text-gray-900">Require Multi-Factor Authentication</p>
                    <p className="text-sm text-gray-500">All users must enable MFA</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.mfa_required === true}
                        onChange={(e) => onChange({ ...settings, mfa_required: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                <input
                    type="number"
                    value={settings.session_timeout_minutes || 60}
                    onChange={(e) => onChange({ ...settings, session_timeout_minutes: parseInt(e.target.value) })}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Failed Login Attempts</label>
                <input
                    type="number"
                    value={settings.max_failed_attempts || 5}
                    onChange={(e) => onChange({ ...settings, max_failed_attempts: parseInt(e.target.value) })}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Password Policy</h3>
                <div className="space-y-2">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.password_policy?.require_uppercase !== false}
                            onChange={(e) => onChange({
                                ...settings,
                                password_policy: { ...settings.password_policy, require_uppercase: e.target.checked }
                            })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Require uppercase letters</span>
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.password_policy?.require_numbers !== false}
                            onChange={(e) => onChange({
                                ...settings,
                                password_policy: { ...settings.password_policy, require_numbers: e.target.checked }
                            })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Require numbers</span>
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={settings.password_policy?.require_special !== false}
                            onChange={(e) => onChange({
                                ...settings,
                                password_policy: { ...settings.password_policy, require_special: e.target.checked }
                            })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Require special characters</span>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
);

export default TenantSettings;
