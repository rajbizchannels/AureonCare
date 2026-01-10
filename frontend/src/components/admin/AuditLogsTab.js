import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  User,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * AuditLogsTab - Comprehensive audit log viewer for AdminPanel
 *
 * Features:
 * - Search and filter audit logs
 * - View detailed audit log entries
 * - Export logs to CSV
 * - Statistics dashboard
 * - Real-time refresh
 */
const AuditLogsTab = ({ theme, api, addNotification }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    currentPage: 1,
    pages: 1,
  });

  // Filters
  const [filters, setFilters] = useState({
    user_email: '',
    action_type: '',
    resource_type: '',
    resource_name: '',
    module: '',
    status: '',
    start_date: '',
    end_date: '',
  });

  // Statistics
  const [stats, setStats] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setMigrationNeeded(false);
    try {
      const queryFilters = {
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset,
      };

      // Remove empty filters
      Object.keys(queryFilters).forEach(key => {
        if (!queryFilters[key]) delete queryFilters[key];
      });

      const response = await api.getAuditLogs(queryFilters);
      setAuditLogs(response.data || []);
      setPagination(response.pagination || pagination);
    } catch (error) {
      console.error('Error loading audit logs:', error);

      // Check if migration is needed
      if (error.message && (error.message.includes('503') || error.message.includes('table not found'))) {
        setMigrationNeeded(true);
        addNotification('warning', 'Audit logs table not found. Please run the database migration.');
      } else {
        addNotification('error', 'Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  }, [api, filters, pagination.limit, pagination.offset, addNotification]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const statsFilters = {};
      if (filters.start_date) statsFilters.start_date = filters.start_date;
      if (filters.end_date) statsFilters.end_date = filters.end_date;

      const statsData = await api.getAuditStats(statsFilters);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);

      // Check if migration is needed
      if (error.message && (error.message.includes('503') || error.message.includes('table not found'))) {
        setMigrationNeeded(true);
      }
      // Silently fail for stats - main error is shown by loadAuditLogs
    }
  }, [api, filters.start_date, filters.end_date]);

  // Initial load
  useEffect(() => {
    loadAuditLogs();
    loadStats();
  }, [loadAuditLogs, loadStats]);

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0, currentPage: 1 }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    const newOffset = (newPage - 1) * pagination.limit;
    setPagination(prev => ({ ...prev, offset: newOffset, currentPage: newPage }));
  };

  // Export to CSV
  const handleExport = async () => {
    try {
      const exportFilters = { ...filters };
      Object.keys(exportFilters).forEach(key => {
        if (!exportFilters[key]) delete exportFilters[key];
      });

      const blob = await api.exportAuditLogsCSV(exportFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addNotification('success', 'Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      addNotification('error', 'Failed to export audit logs');
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      success: { icon: CheckCircle, color: 'green' },
      error: { icon: XCircle, color: 'red' },
      warning: { icon: AlertCircle, color: 'yellow' },
    };

    const config = statusConfig[status] || statusConfig.success;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          config.color === 'green'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : config.color === 'red'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        }`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  // Get action icon
  const getActionIcon = (actionType) => {
    const icons = {
      view: Eye,
      create: Plus,
      update: Edit,
      delete: Trash2,
      submit: CheckCircle,
      open: Eye,
      close: X,
    };

    const Icon = icons[actionType] || Activity;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className={`p-6 ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Audit Logs
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Track all user activities and system events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <button
            onClick={handleExport}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={() => {
              loadAuditLogs();
              loadStats();
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div
            className={`p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Actions
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.total_actions || 0}
                </p>
              </div>
              <Activity className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Unique Users
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.unique_users || 0}
                </p>
              </div>
              <User className={`w-8 h-8 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Forms Submitted
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.form_actions || 0}
                </p>
              </div>
              <FileText className={`w-8 h-8 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Errors
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {stats.errors || 0}
                </p>
              </div>
              <XCircle className={`w-8 h-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div
          className={`p-4 rounded-lg border mb-6 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-300'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                User Email
              </label>
              <input
                type="text"
                value={filters.user_email}
                onChange={(e) => handleFilterChange('user_email', e.target.value)}
                placeholder="Search by email..."
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Action Type
              </label>
              <select
                value={filters.action_type}
                onChange={(e) => handleFilterChange('action_type', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">All Actions</option>
                <option value="view">View</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="submit">Submit</option>
                <option value="open">Open</option>
                <option value="close">Close</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Resource Type
              </label>
              <select
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">All Types</option>
                <option value="form">Form</option>
                <option value="modal">Modal</option>
                <option value="view">View</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Resource Name
              </label>
              <input
                type="text"
                value={filters.resource_name}
                onChange={(e) => handleFilterChange('resource_name', e.target.value)}
                placeholder="e.g., DiagnosisForm"
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    user_email: '',
                    action_type: '',
                    resource_type: '',
                    resource_name: '',
                    module: '',
                    status: '',
                    start_date: '',
                    end_date: '',
                  });
                }}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration Needed Message */}
      {migrationNeeded && (
        <div
          className={`p-6 rounded-lg border-2 mb-6 ${
            theme === 'dark'
              ? 'bg-yellow-900/20 border-yellow-700'
              : 'bg-yellow-50 border-yellow-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <AlertCircle
              className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`}
            />
            <div className="flex-1">
              <h3
                className={`text-lg font-semibold mb-2 ${
                  theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'
                }`}
              >
                Database Migration Required
              </h3>
              <p
                className={`mb-3 ${
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                }`}
              >
                The audit logs table has not been created yet. Please run the database migration to enable audit logging.
              </p>
              <div
                className={`p-3 rounded-lg font-mono text-sm mb-3 ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-gray-300'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                psql -U medflow_app -d medflow -f backend/migrations/040_create_audit_logs_table.sql
              </div>
              <p
                className={`text-sm ${
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                }`}
              >
                After running the migration, click the <strong>Refresh</strong> button above to load audit logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      {!migrationNeeded && (
        <div
          className={`rounded-lg border overflow-hidden ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-300'
          }`}
        >
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Timestamp
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  User
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Action
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Resource
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Description
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Status
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-gray-200'}`}>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Loading audit logs...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center">
                    <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      No audit logs found
                    </p>
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={`${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div>
                        <div className="font-medium">{log.user_name || 'Unknown'}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                          {log.user_email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_type)}
                        <span className="capitalize">{log.action_type}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                      <div>
                        <div className="font-medium">{log.resource_name}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} capitalize`}>
                          {log.resource_type}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                      {log.action_description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setShowDetailModal(true);
                        }}
                        className={`text-blue-500 hover:text-blue-600 font-medium`}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div
            className={`px-4 py-3 border-t flex items-center justify-between ${
              theme === 'dark'
                ? 'border-slate-700 bg-slate-900'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} results
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  pagination.currentPage === 1
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className={`px-3 py-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                Page {pagination.currentPage} of {pagination.pages}
              </span>

              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.pages}
                className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                  pagination.currentPage === pagination.pages
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDetailModal(false)}>
          <div
            className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4 rounded-lg ${
              theme === 'dark' ? 'bg-slate-800' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Audit Log Details
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Timestamp
                  </label>
                  <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    User
                  </label>
                  <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {selectedLog.user_name || 'Unknown'} ({selectedLog.user_email || 'N/A'})
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Action
                  </label>
                  <div className={`capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedLog.action_type}
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Resource
                  </label>
                  <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {selectedLog.resource_name} ({selectedLog.resource_type})
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Status
                  </label>
                  {getStatusBadge(selectedLog.status)}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Module
                  </label>
                  <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {selectedLog.module || 'N/A'}
                  </div>
                </div>
              </div>

              {selectedLog.action_description && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Description
                  </label>
                  <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {selectedLog.action_description}
                  </div>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                    Error Message
                  </label>
                  <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-900'}`}>
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Changed Fields
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.changed_fields.map((field, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          theme === 'dark'
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    New Values
                  </label>
                  <pre className={`p-3 rounded-lg overflow-auto text-xs ${
                    theme === 'dark'
                      ? 'bg-slate-900 text-gray-300'
                      : 'bg-gray-50 text-gray-900'
                  }`}>
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.ip_address && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      IP Address
                    </label>
                    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {selectedLog.ip_address}
                    </div>
                  </div>

                  {selectedLog.duration_ms && (
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Duration
                      </label>
                      <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {selectedLog.duration_ms}ms
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsTab;
