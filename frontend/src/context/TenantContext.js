/**
 * AUREONCARE TENANT CONTEXT
 *
 * React context for managing tenant state and providing
 * tenant-specific data throughout the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../api/apiService';

// Create the context
const TenantContext = createContext(null);

// Custom hook to use the tenant context
export const useTenant = () => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};

// Provider component
export const TenantProvider = ({ children }) => {
    const [tenant, setTenant] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [settings, setSettings] = useState({});
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load tenant data
    const loadTenantData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [tenantInfo, subscriptionData, settingsData, rolesData] = await Promise.all([
                apiService.get('/tenant/info'),
                apiService.get('/tenant/subscription').catch(() => null),
                apiService.get('/tenant/settings').catch(() => ({})),
                apiService.get('/tenant/roles').catch(() => [])
            ]);

            setTenant(tenantInfo);
            setSubscription(subscriptionData);
            setSettings(settingsData);
            setRoles(rolesData);
        } catch (err) {
            console.error('Failed to load tenant data:', err);
            setError(err.message || 'Failed to load tenant data');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load tenant data on mount
    useEffect(() => {
        loadTenantData();
    }, [loadTenantData]);

    // Check if a feature is enabled
    const hasFeature = useCallback((featureName) => {
        return tenant?.features?.[featureName] === true;
    }, [tenant]);

    // Check if within a limit
    const checkLimit = useCallback((resourceType) => {
        if (!subscription) return true;

        const limitMap = {
            users: { current: subscription.currentUsers, max: subscription.planMaxUsers },
            patients: { current: subscription.currentPatients, max: subscription.planMaxPatients },
            providers: { current: subscription.currentProviders, max: subscription.planMaxProviders }
        };

        const limit = limitMap[resourceType];
        if (!limit || limit.max === -1) return true; // Unlimited

        return limit.current < limit.max;
    }, [subscription]);

    // Get current usage percentage
    const getUsagePercentage = useCallback((resourceType) => {
        if (!subscription) return 0;

        const limitMap = {
            users: { current: subscription.currentUsers, max: subscription.planMaxUsers },
            patients: { current: subscription.currentPatients, max: subscription.planMaxPatients },
            providers: { current: subscription.currentProviders, max: subscription.planMaxProviders }
        };

        const limit = limitMap[resourceType];
        if (!limit || limit.max === -1) return 0; // Unlimited

        return Math.round((limit.current / limit.max) * 100);
    }, [subscription]);

    // Update settings
    const updateSettings = useCallback(async (newSettings) => {
        try {
            const updatedSettings = await apiService.put('/tenant/settings', newSettings);
            setSettings(updatedSettings);
            return updatedSettings;
        } catch (err) {
            throw err;
        }
    }, []);

    // Update branding
    const updateBranding = useCallback(async (branding) => {
        try {
            const updatedBranding = await apiService.put('/tenant/branding', branding);
            setTenant(prev => ({
                ...prev,
                branding: updatedBranding
            }));
            return updatedBranding;
        } catch (err) {
            throw err;
        }
    }, []);

    // Get setting value
    const getSetting = useCallback((category, key, defaultValue = null) => {
        return settings?.[category]?.[key] ?? defaultValue;
    }, [settings]);

    // Get branding value
    const getBranding = useCallback((key, defaultValue = null) => {
        return tenant?.branding?.[key] ?? defaultValue;
    }, [tenant]);

    // Refresh tenant data
    const refresh = useCallback(() => {
        return loadTenantData();
    }, [loadTenantData]);

    const value = {
        // State
        tenant,
        subscription,
        settings,
        roles,
        loading,
        error,

        // Feature checks
        hasFeature,
        checkLimit,
        getUsagePercentage,

        // Settings helpers
        getSetting,
        updateSettings,

        // Branding helpers
        getBranding,
        updateBranding,

        // Actions
        refresh,

        // Computed values
        isActive: tenant?.status === 'active',
        isTrial: subscription?.status === 'trial',
        planName: subscription?.planDisplayName || subscription?.planName,
        tenantId: tenant?.id,
        tenantCode: tenant?.code,
        tenantName: tenant?.name
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
};

export default TenantContext;
