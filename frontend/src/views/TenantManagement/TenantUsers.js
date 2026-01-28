/**
 * AUREONCARE TENANT USERS MANAGEMENT
 *
 * Manage users within the tenant organization
 */

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import apiService from '../../api/apiService';

const TenantUsers = () => {
    const { tenant, roles, checkLimit, getUsagePercentage, subscription } = useTenant();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [filters, setFilters] = useState({ role: '', status: '' });

    useEffect(() => {
        loadUsers();
    }, [filters]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.role) params.append('role', filters.role);
            if (filters.status) params.append('status', filters.status);

            const data = await apiService.get(`/tenant/users?${params.toString()}`);
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveUser = async (userId) => {
        if (!window.confirm('Are you sure you want to remove this user from the organization?')) {
            return;
        }

        try {
            await apiService.delete(`/tenant/users/${userId}`);
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            alert('Failed to remove user: ' + err.message);
        }
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setShowEditModal(true);
    };

    const canAddUsers = checkLimit('users');
    const usagePercent = getUsagePercentage('users');

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500 mt-1">Manage users in your organization</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    disabled={!canAddUsers}
                    className={`px-4 py-2 rounded-lg font-medium ${
                        canAddUsers
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Add User
                </button>
            </div>

            {/* Usage Warning */}
            {usagePercent >= 80 && (
                <div className={`p-4 rounded-lg ${usagePercent >= 100 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                    <div className="flex items-center">
                        <svg className={`h-5 w-5 mr-2 ${usagePercent >= 100 ? 'text-red-500' : 'text-yellow-500'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className={usagePercent >= 100 ? 'text-red-700' : 'text-yellow-700'}>
                            {usagePercent >= 100
                                ? 'You have reached your user limit. Upgrade your plan to add more users.'
                                : `You're using ${usagePercent}% of your user limit.`}
                        </span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-wrap gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={filters.role}
                            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Roles</option>
                            {roles.map(role => (
                                <option key={role.code} value={role.code}>{role.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="blocked">Blocked</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 text-red-600">{error}</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <p>No users found</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Access</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <span className="text-blue-600 font-medium">
                                                        {user.first_name?.[0]}{user.last_name?.[0]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {user.first_name} {user.last_name}
                                                    {user.is_tenant_admin && (
                                                        <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                            {user.role}
                                        </span>
                                        {user.tenant_roles && user.tenant_roles.length > 0 && (
                                            <span className="ml-1 text-xs text-gray-500">
                                                +{user.tenant_roles.length}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            user.status === 'active' ? 'bg-green-100 text-green-800' :
                                            user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.last_access_at
                                            ? new Date(user.last_access_at).toLocaleDateString()
                                            : 'Never'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <button
                                            onClick={() => handleEditUser(user)}
                                            className="text-blue-600 hover:text-blue-800 mr-3"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleRemoveUser(user.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <AddUserModal
                    roles={roles}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        loadUsers();
                    }}
                />
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <EditUserModal
                    user={selectedUser}
                    roles={roles}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                        loadUsers();
                    }}
                />
            )}
        </div>
    );
};

// Add User Modal Component
const AddUserModal = ({ roles, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: 'staff',
        isTenantAdmin: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // First create the user
            const userResponse = await apiService.post('/users', {
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
                status: 'pending'
            });

            // Then add to tenant
            await apiService.post('/tenant/users', {
                userId: userResponse.id,
                isTenantAdmin: formData.isTenantAdmin,
                tenantRoles: [formData.role]
            });

            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to add user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Add New User</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {roles.map(role => (
                                    <option key={role.code} value={role.code}>{role.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isTenantAdmin"
                                checked={formData.isTenantAdmin}
                                onChange={(e) => setFormData({ ...formData, isTenantAdmin: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="isTenantAdmin" className="ml-2 text-sm text-gray-700">
                                Make this user an organization admin
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add User'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Edit User Modal Component
const EditUserModal = ({ user, roles, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        isTenantAdmin: user.is_tenant_admin || false,
        accessLevel: user.access_level || 'standard',
        status: user.status || 'active',
        tenantRoles: user.tenant_roles || []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await apiService.put(`/tenant/users/${user.id}`, formData);
            onSuccess();
        } catch (err) {
            setError(err.message || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Edit User Access</h2>
                    <p className="text-gray-600 mb-4">{user.first_name} {user.last_name} ({user.email})</p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
                            <select
                                value={formData.accessLevel}
                                onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="standard">Standard</option>
                                <option value="restricted">Restricted</option>
                                <option value="elevated">Elevated</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="active">Active</option>
                                <option value="blocked">Blocked</option>
                            </select>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="editTenantAdmin"
                                checked={formData.isTenantAdmin}
                                onChange={(e) => setFormData({ ...formData, isTenantAdmin: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="editTenantAdmin" className="ml-2 text-sm text-gray-700">
                                Organization Admin
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TenantUsers;
