/**
 * AUREONCARE TENANT DASHBOARD
 *
 * Main dashboard for tenant administrators
 * Shows subscription status, usage, and quick actions
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import apiService from '../../api/apiService';

const TenantDashboard = () => {
    const {
        tenant, subscription, loading, error, refresh,
        hasFeature, getUsagePercentage, planName, isTrial
    } = useTenant();

    const [statistics, setStatistics] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoadingStats(true);
            const data = await apiService.get('/tenant/dashboard');
            setStatistics(data.statistics);
            setRecentActivity(data.recentActivity || []);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        } finally {
            setLoadingStats(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Error loading tenant data</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                    onClick={refresh}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    const usageItems = [
        { name: 'Users', key: 'users', current: subscription?.currentUsers, max: subscription?.planMaxUsers },
        { name: 'Patients', key: 'patients', current: subscription?.currentPatients, max: subscription?.planMaxPatients },
        { name: 'Providers', key: 'providers', current: subscription?.currentProviders, max: subscription?.planMaxProviders }
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{tenant?.name}</h1>
                    <p className="text-gray-500 mt-1">Organization Dashboard</p>
                </div>
                <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        tenant?.status === 'active' ? 'bg-green-100 text-green-800' :
                        tenant?.status === 'suspended' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                        {tenant?.status?.charAt(0).toUpperCase() + tenant?.status?.slice(1)}
                    </span>
                </div>
            </div>

            {/* Trial Banner */}
            {isTrial && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <svg className="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-blue-800 font-medium">
                                You're on a free trial of {planName}
                            </span>
                        </div>
                        <Link
                            to="/tenant/billing"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            Upgrade Now
                        </Link>
                    </div>
                </div>
            )}

            {/* Subscription & Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Plan Info */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Current Plan</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{planName || 'Free'}</p>
                            <p className="text-sm text-gray-500">
                                {subscription?.billingCycle === 'yearly' ? 'Annual billing' : 'Monthly billing'}
                            </p>
                        </div>
                        {subscription?.nextBillingDate && (
                            <p className="text-sm text-gray-600">
                                Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                            </p>
                        )}
                        <Link
                            to="/tenant/billing"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                            Manage Subscription
                            <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </div>

                {/* Usage Stats */}
                <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {usageItems.map((item) => (
                            <div key={item.key} className="text-center">
                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                        <div>
                                            <span className="text-xs font-semibold inline-block text-gray-600">
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-semibold inline-block text-gray-600">
                                                {item.current || 0} / {item.max === -1 ? '∞' : item.max}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                                        <div
                                            style={{ width: `${item.max === -1 ? 0 : Math.min((item.current / item.max) * 100, 100)}%` }}
                                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                                                getUsagePercentage(item.key) > 80 ? 'bg-red-500' :
                                                getUsagePercentage(item.key) > 60 ? 'bg-yellow-500' :
                                                'bg-blue-500'
                                            }`}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Patients"
                    value={statistics?.total_patients || 0}
                    icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    }
                    color="blue"
                    link="/patients"
                />
                <StatCard
                    title="Upcoming Appointments"
                    value={statistics?.upcoming_appointments || 0}
                    icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    }
                    color="green"
                    link="/appointments"
                />
                <StatCard
                    title="Pending Claims"
                    value={statistics?.pending_claims || 0}
                    icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    }
                    color="yellow"
                    link="/claims"
                />
                <StatCard
                    title="Active Users"
                    value={statistics?.active_users || 0}
                    icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    }
                    color="purple"
                    link="/tenant/users"
                />
            </div>

            {/* Features & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Enabled Features */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Enabled Features</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'telehealth', name: 'Telehealth', icon: '📹' },
                            { key: 'erx', name: 'E-Prescriptions', icon: '💊' },
                            { key: 'fhir', name: 'FHIR Integration', icon: '🔗' },
                            { key: 'patient_portal', name: 'Patient Portal', icon: '🚪' },
                            { key: 'crm', name: 'CRM', icon: '📊' },
                            { key: 'edi_835', name: 'EDI 835', icon: '📄' },
                            { key: 'api_access', name: 'API Access', icon: '⚡' },
                            { key: 'advanced_analytics', name: 'Analytics', icon: '📈' }
                        ].map((feature) => (
                            <div
                                key={feature.key}
                                className={`flex items-center p-2 rounded ${
                                    hasFeature(feature.key) ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                                }`}
                            >
                                <span className="mr-2">{feature.icon}</span>
                                <span className="text-sm">{feature.name}</span>
                                {hasFeature(feature.key) && (
                                    <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                        <Link
                            to="/tenant/billing"
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Upgrade for more features →
                        </Link>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                    {recentActivity.length === 0 ? (
                        <p className="text-gray-500 text-sm">No recent activity</p>
                    ) : (
                        <div className="space-y-3">
                            {recentActivity.slice(0, 5).map((activity, index) => (
                                <div key={index} className="flex items-start space-x-3 text-sm">
                                    <div className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                                        activity.action === 'create' ? 'bg-green-500' :
                                        activity.action === 'update' ? 'bg-blue-500' :
                                        activity.action === 'delete' ? 'bg-red-500' :
                                        'bg-gray-500'
                                    }`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-900 truncate">{activity.description}</p>
                                        <p className="text-gray-500 text-xs">
                                            {activity.user_email} • {new Date(activity.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t">
                        <Link
                            to="/tenant/audit-logs"
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            View all activity →
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickAction
                        title="Manage Users"
                        description="Add or remove users"
                        link="/tenant/users"
                        icon={
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        }
                    />
                    <QuickAction
                        title="Settings"
                        description="Configure organization"
                        link="/tenant/settings"
                        icon={
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        }
                    />
                    <QuickAction
                        title="Billing"
                        description="View invoices & plans"
                        link="/tenant/billing"
                        icon={
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        }
                    />
                    <QuickAction
                        title="Security"
                        description="Audit logs & compliance"
                        link="/tenant/security"
                        icon={
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        }
                    />
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard = ({ title, value, icon, color, link }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
        red: 'bg-red-100 text-red-600'
    };

    const Card = link ? Link : 'div';
    const cardProps = link ? { to: link } : {};

    return (
        <Card
            {...cardProps}
            className={`bg-white rounded-lg shadow p-6 ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
        >
            <div className="flex items-center">
                <div className={`p-3 rounded-full ${colorClasses[color] || colorClasses.blue}`}>
                    {icon}
                </div>
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
                </div>
            </div>
        </Card>
    );
};

// Quick Action Component
const QuickAction = ({ title, description, link, icon }) => {
    return (
        <Link
            to={link}
            className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
            <div className="text-blue-600 mb-2">{icon}</div>
            <h4 className="font-medium text-gray-900">{title}</h4>
            <p className="text-sm text-gray-500">{description}</p>
        </Link>
    );
};

export default TenantDashboard;
