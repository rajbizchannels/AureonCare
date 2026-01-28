/**
 * AUREONCARE TENANT MANAGEMENT VIEWS
 *
 * Export all tenant management components
 */

export { default as TenantDashboard } from './TenantDashboard';
export { default as TenantUsers } from './TenantUsers';
export { default as TenantSettings } from './TenantSettings';
export { default as TenantBilling } from './TenantBilling';

// Route configuration for tenant management
export const tenantRoutes = [
    {
        path: '/tenant',
        exact: true,
        component: 'TenantDashboard',
        title: 'Organization Dashboard',
        requiresTenantAdmin: false
    },
    {
        path: '/tenant/users',
        component: 'TenantUsers',
        title: 'User Management',
        requiresTenantAdmin: true
    },
    {
        path: '/tenant/settings',
        component: 'TenantSettings',
        title: 'Organization Settings',
        requiresTenantAdmin: true
    },
    {
        path: '/tenant/billing',
        component: 'TenantBilling',
        title: 'Billing & Subscription',
        requiresTenantAdmin: true
    },
    {
        path: '/tenant/audit-logs',
        component: 'TenantAuditLogs',
        title: 'Audit Logs',
        requiresTenantAdmin: true
    },
    {
        path: '/tenant/security',
        component: 'TenantSecurity',
        title: 'Security & Compliance',
        requiresTenantAdmin: true
    }
];
