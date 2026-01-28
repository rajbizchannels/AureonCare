/**
 * AUREONCARE TENANT BILLING
 *
 * Subscription, invoices, and payment management
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import apiService from '../../api/apiService';

const TenantBilling = () => {
    const { subscription, planName, isTrial, hasFeature, refresh } = useTenant();

    const [plans, setPlans] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [usage, setUsage] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        loadBillingData();
    }, []);

    const loadBillingData = async () => {
        try {
            setLoading(true);
            const [plansData, invoicesData, paymentMethodsData, usageData] = await Promise.all([
                apiService.get('/tenant/plans'),
                apiService.get('/tenant/invoices'),
                apiService.get('/tenant/payment-methods').catch(() => []),
                apiService.get('/tenant/usage?groupBy=month').catch(() => [])
            ]);

            setPlans(plansData);
            setInvoices(invoicesData);
            setPaymentMethods(paymentMethodsData);
            setUsage(usageData);
        } catch (err) {
            console.error('Failed to load billing data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePlan = async (planCode) => {
        if (!window.confirm(`Are you sure you want to change to the ${planCode} plan?`)) {
            return;
        }

        try {
            await apiService.post('/tenant/subscription/change-plan', { planCode });
            await refresh();
            setShowUpgradeModal(false);
            alert('Plan changed successfully!');
        } catch (err) {
            alert('Failed to change plan: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                    <p className="text-gray-500 mt-1">Manage your plan, invoices, and payment methods</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {['overview', 'invoices', 'payment', 'usage'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                                activeTab === tab
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <OverviewTab
                    subscription={subscription}
                    plans={plans}
                    isTrial={isTrial}
                    onUpgrade={() => setShowUpgradeModal(true)}
                />
            )}

            {activeTab === 'invoices' && (
                <InvoicesTab invoices={invoices} />
            )}

            {activeTab === 'payment' && (
                <PaymentMethodsTab
                    methods={paymentMethods}
                    onRefresh={loadBillingData}
                />
            )}

            {activeTab === 'usage' && (
                <UsageTab usage={usage} subscription={subscription} />
            )}

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <UpgradeModal
                    plans={plans}
                    currentPlan={subscription?.plan_code}
                    onSelect={handleChangePlan}
                    onClose={() => setShowUpgradeModal(false)}
                />
            )}
        </div>
    );
};

// Overview Tab
const OverviewTab = ({ subscription, plans, isTrial, onUpgrade }) => {
    const currentPlan = plans.find(p => p.code === subscription?.plan_code);

    return (
        <div className="space-y-6">
            {/* Trial Banner */}
            {isTrial && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-blue-800 font-medium">You're on a free trial</h3>
                            <p className="text-blue-600 text-sm mt-1">
                                {subscription?.trial_end_date
                                    ? `Trial ends ${new Date(subscription.trial_end_date).toLocaleDateString()}`
                                    : 'Upgrade to continue using premium features'}
                            </p>
                        </div>
                        <button
                            onClick={onUpgrade}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Upgrade Now
                        </button>
                    </div>
                </div>
            )}

            {/* Current Plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-3xl font-bold text-blue-600">
                                {subscription?.plan_display_name || 'Free'}
                            </p>
                            <p className="text-gray-500 mt-1">{currentPlan?.description}</p>
                            <div className="mt-4 space-y-2">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Billing cycle:</span>{' '}
                                    {subscription?.billing_cycle === 'yearly' ? 'Annual' : 'Monthly'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Status:</span>{' '}
                                    <span className={`${
                                        subscription?.status === 'active' ? 'text-green-600' :
                                        subscription?.status === 'trial' ? 'text-blue-600' :
                                        'text-yellow-600'
                                    }`}>
                                        {subscription?.status?.charAt(0).toUpperCase() + subscription?.status?.slice(1)}
                                    </span>
                                </p>
                                {subscription?.next_billing_date && (
                                    <p className="text-sm text-gray-600">
                                        <span className="font-medium">Next billing:</span>{' '}
                                        {new Date(subscription.next_billing_date).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-gray-900">
                                ${subscription?.base_price || 0}
                            </p>
                            <p className="text-gray-500">
                                /{subscription?.billing_cycle === 'yearly' ? 'year' : 'month'}
                            </p>
                            <button
                                onClick={onUpgrade}
                                className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                            >
                                Change Plan
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Limits</h2>
                    <div className="space-y-4">
                        <LimitBar
                            label="Users"
                            current={subscription?.current_users || 0}
                            max={subscription?.plan_max_users}
                        />
                        <LimitBar
                            label="Patients"
                            current={subscription?.current_patients || 0}
                            max={subscription?.plan_max_patients}
                        />
                        <LimitBar
                            label="Providers"
                            current={subscription?.current_providers || 0}
                            max={subscription?.plan_max_providers}
                        />
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Features</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {currentPlan?.features && Object.entries(currentPlan.features).map(([key, value]) => (
                        <div key={key} className={`flex items-center ${value ? 'text-green-600' : 'text-gray-400'}`}>
                            {value ? (
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            )}
                            <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Limit Bar Component
const LimitBar = ({ label, current, max }) => {
    const percentage = max === -1 ? 0 : Math.min((current / max) * 100, 100);
    const isUnlimited = max === -1;

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="text-gray-900 font-medium">
                    {current} / {isUnlimited ? '∞' : max}
                </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${
                        percentage > 90 ? 'bg-red-500' :
                        percentage > 70 ? 'bg-yellow-500' :
                        'bg-blue-500'
                    }`}
                    style={{ width: `${isUnlimited ? 0 : percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

// Invoices Tab
const InvoicesTab = ({ invoices }) => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
        {invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                <p>No invoices yet</p>
            </div>
        ) : (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {invoice.invoice_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(invoice.invoice_date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${parseFloat(invoice.total_amount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {invoice.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <button className="text-blue-600 hover:text-blue-800">View</button>
                                {invoice.status !== 'paid' && (
                                    <button className="ml-3 text-green-600 hover:text-green-800">Pay</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </div>
);

// Payment Methods Tab
const PaymentMethodsTab = ({ methods, onRefresh }) => {
    const handleDelete = async (methodId) => {
        if (!window.confirm('Remove this payment method?')) return;

        try {
            await apiService.delete(`/tenant/payment-methods/${methodId}`);
            onRefresh();
        } catch (err) {
            alert('Failed to remove payment method');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Add Payment Method
                </button>
            </div>

            {methods.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <p>No payment methods added</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {methods.map((method) => (
                        <div key={method.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center mr-4">
                                    {method.card_brand ? method.card_brand.toUpperCase() : 'CARD'}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        •••• •••• •••• {method.card_last_four}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Expires {method.card_exp_month}/{method.card_exp_year}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                {method.is_default && (
                                    <span className="mr-4 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Default</span>
                                )}
                                <button
                                    onClick={() => handleDelete(method.id)}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Usage Tab
const UsageTab = ({ usage, subscription }) => (
    <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h2>
            <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                    <p className="text-4xl font-bold text-blue-600">{subscription?.current_users || 0}</p>
                    <p className="text-gray-500">Active Users</p>
                </div>
                <div className="text-center">
                    <p className="text-4xl font-bold text-green-600">{subscription?.current_patients || 0}</p>
                    <p className="text-gray-500">Patients</p>
                </div>
                <div className="text-center">
                    <p className="text-4xl font-bold text-purple-600">{subscription?.current_providers || 0}</p>
                    <p className="text-gray-500">Providers</p>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Usage History</h2>
            {usage.length === 0 ? (
                <p className="text-gray-500">No usage data available</p>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patients</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">API Calls</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {usage.slice(0, 6).map((row, index) => (
                            <tr key={index}>
                                <td className="px-4 py-2 text-sm text-gray-900">{row.usage_month}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{row.max_users || 0}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{row.max_patients || 0}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{row.total_api_calls || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    </div>
);

// Upgrade Modal
const UpgradeModal = ({ plans, currentPlan, onSelect, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.filter(p => p.is_active).map((plan) => (
                        <div
                            key={plan.id}
                            className={`border rounded-lg p-4 ${
                                plan.code === currentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                            }`}
                        >
                            <h3 className="text-lg font-bold text-gray-900">{plan.display_name}</h3>
                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                ${plan.price_monthly}
                                <span className="text-sm font-normal text-gray-500">/mo</span>
                            </p>
                            <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

                            <ul className="mt-4 space-y-2 text-sm">
                                <li className="flex items-center">
                                    <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Up to {plan.max_users === -1 ? 'unlimited' : plan.max_users} users
                                </li>
                                <li className="flex items-center">
                                    <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {plan.max_patients === -1 ? 'Unlimited' : plan.max_patients} patients
                                </li>
                            </ul>

                            <button
                                onClick={() => onSelect(plan.code)}
                                disabled={plan.code === currentPlan}
                                className={`mt-4 w-full py-2 rounded-lg font-medium ${
                                    plan.code === currentPlan
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {plan.code === currentPlan ? 'Current Plan' : 'Select Plan'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

export default TenantBilling;
