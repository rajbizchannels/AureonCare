import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Plus,
  X,
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Calendar,
  Package,
  FileArchive,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Eye,
  Table,
  Clock,
  Play,
  Power,
  Settings,
} from 'lucide-react';
import Toggle from '../Toggle';
import ConfirmationModal from '../modals/ConfirmationModal';

/**
 * ArchiveManagementTab - Comprehensive archive management for AdminPanel
 *
 * Features:
 * - Create archives with module selection
 * - View existing archives
 * - Restore archives with deduplication
 * - Delete archives
 * - Archive statistics
 */

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Get authentication headers from localStorage
 */
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) {
      headers['x-user-id'] = user.id;
      headers['x-user-role'] = user.role || 'admin';
    }
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
  }

  return headers;
};

const ArchiveManagementTab = ({ theme, api, addNotification }) => {
  const [archives, setArchives] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Create archive state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [archiveDescription, setArchiveDescription] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [creating, setCreating] = useState(false);

  // Archive details state
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState(null);

  // Restore state
  const [restoring, setRestoring] = useState(false);

  // Browse state
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [browseData, setBrowseData] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // Archive Rules state
  const [archiveRules, setArchiveRules] = useState([]);
  const [showRulesSection, setShowRulesSection] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    ruleName: '',
    description: '',
    enabled: true,
    selectedModules: [],
    scheduleType: 'daily',
    scheduleTime: '02:00',
    scheduleDayOfWeek: 0,
    scheduleDayOfMonth: 1,
    retentionDays: null
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    onConfirm: null
  });

  // Load archives
  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      // Don't filter by status - get ALL archives
      const response = await fetch(`${API_BASE_URL}/archive/list?status=`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load archives');
      }

      const data = await response.json();
      setArchives(data.archives || []);
    } catch (error) {
      console.error('Error loading archives:', error);
      addNotification('error', 'Failed to load archives');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  // Load available modules
  const loadModules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/archive/modules`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load modules');
      }

      const data = await response.json();
      setModules(data.modules || []);
    } catch (error) {
      console.error('Error loading modules:', error);
      addNotification('error', 'Failed to load archive modules');
    }
  }, [addNotification]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/archive/stats/summary`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load stats');
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Load archive rules
  const loadArchiveRules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/archive-rules`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load archive rules');
      }

      const data = await response.json();
      setArchiveRules(data.rules || []);
    } catch (error) {
      console.error('Error loading archive rules:', error);
      addNotification('error', 'Failed to load archive rules');
    }
  }, [addNotification]);

  // Initial load
  useEffect(() => {
    loadArchives();
    loadModules();
    loadStats();
    loadArchiveRules();
  }, [loadArchives, loadModules, loadStats, loadArchiveRules]);

  // Handle module toggle
  const toggleModule = (moduleKey) => {
    setSelectedModules(prev => {
      if (prev.includes(moduleKey)) {
        return prev.filter(m => m !== moduleKey);
      } else {
        return [...prev, moduleKey];
      }
    });
  };

  // Handle select all modules
  const handleSelectAll = () => {
    if (selectedModules.length === modules.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(modules.map(m => m.key));
    }
  };

  // Handle create archive
  const handleCreateArchive = async () => {
    if (!archiveName.trim()) {
      addNotification('error', 'Please enter an archive name');
      return;
    }

    if (selectedModules.length === 0) {
      addNotification('error', 'Please select at least one module');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/archive/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          archiveName,
          description: archiveDescription,
          selectedModules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create archive');
      }

      const data = await response.json();
      addNotification('success', `Archive "${archiveName}" created successfully. Reloading...`);

      // Reset form and close
      setShowCreateModal(false);
      setArchiveName('');
      setArchiveDescription('');
      setSelectedModules([]);

      // Reload archives immediately
      loadArchives();
      loadStats();

      // Reload again after delays to ensure the archive appears
      setTimeout(() => {
        loadArchives();
        loadStats();
      }, 3000);

      setTimeout(() => {
        loadArchives();
        loadStats();
      }, 8000);

      setTimeout(() => {
        loadArchives();
        loadStats();
      }, 15000);
    } catch (error) {
      console.error('Error creating archive:', error);
      addNotification('error', error.message || 'Failed to create archive');
    } finally {
      setCreating(false);
    }
  };

  // Handle restore archive
  const handleRestoreArchive = (archiveId, archiveName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Archive',
      message: `Are you sure you want to restore archive "${archiveName}"?\n\nThis will merge the archived data with existing data. Duplicates will be skipped automatically.`,
      type: 'confirm',
      onConfirm: async () => {
        setRestoring(true);
        try {
          const response = await fetch(`${API_BASE_URL}/archive/${archiveId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to restore archive');
          }

          const data = await response.json();

          const message = `Archive restored successfully!\n\nAdded: ${data.totalAdded} records\nSkipped (duplicates): ${data.totalSkipped} records\nTables: ${data.totalTables}`;

          addNotification('success', message);
          loadArchives();
          loadStats();
        } catch (error) {
          console.error('Error restoring archive:', error);
          addNotification('error', error.message || 'Failed to restore archive');
        } finally {
          setRestoring(false);
        }
      }
    });
  };

  // Handle delete archive
  const handleDeleteArchive = (archiveId, archiveName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Archive',
      message: `Are you sure you want to delete archive "${archiveName}"?\n\nThis action cannot be undone.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/archive/${archiveId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete archive');
          }

          addNotification('success', `Archive "${archiveName}" deleted successfully`);
          loadArchives();
          loadStats();
        } catch (error) {
          console.error('Error deleting archive:', error);
          addNotification('error', error.message || 'Failed to delete archive');
        }
      }
    });
  };

  // Handle browse archive
  const handleBrowseArchive = async (archiveId, archiveName) => {
    setBrowsing(true);
    setShowBrowseModal(true);
    setSelectedArchive({ id: archiveId, name: archiveName });
    setSelectedTable(null);

    try {
      const response = await fetch(`${API_BASE_URL}/archive/${archiveId}/browse`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to browse archive');
      }

      const data = await response.json();
      setBrowseData(data);
    } catch (error) {
      console.error('Error browsing archive:', error);
      addNotification('error', error.message || 'Failed to browse archive');
      setShowBrowseModal(false);
    } finally {
      setBrowsing(false);
    }
  };

  // Handle browse specific table
  const handleBrowseTable = async (archiveId, tableName) => {
    setBrowsing(true);
    setSelectedTable(tableName);

    try {
      const response = await fetch(`${API_BASE_URL}/archive/${archiveId}/browse?table=${tableName}&limit=100`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to browse table');
      }

      const data = await response.json();
      setBrowseData(prev => ({
        ...prev,
        selectedTableData: data
      }));
    } catch (error) {
      console.error('Error browsing table:', error);
      addNotification('error', error.message || 'Failed to browse table');
    } finally {
      setBrowsing(false);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Handle create/edit rule form
  const openRuleModal = (rule = null) => {
    // If form is open and clicking without a rule, close it
    if (showRuleModal && !rule) {
      setShowRuleModal(false);
      setEditingRule(null);
      return;
    }

    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        ruleName: rule.rule_name,
        description: rule.description || '',
        enabled: rule.enabled,
        selectedModules: rule.selected_modules || [],
        scheduleType: rule.schedule_type,
        scheduleTime: rule.schedule_time?.substring(0, 5) || '02:00',
        scheduleDayOfWeek: rule.schedule_day_of_week !== null ? rule.schedule_day_of_week : 0,
        scheduleDayOfMonth: rule.schedule_day_of_month || 1,
        retentionDays: rule.retention_days || null
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        ruleName: '',
        description: '',
        enabled: true,
        selectedModules: [],
        scheduleType: 'daily',
        scheduleTime: '02:00',
        scheduleDayOfWeek: 0,
        scheduleDayOfMonth: 1,
        retentionDays: null
      });
    }
    setShowRuleModal(true);
  };

  // Handle save rule
  const handleSaveRule = async () => {
    if (!ruleForm.ruleName.trim()) {
      addNotification('error', 'Please enter a rule name');
      return;
    }

    if (ruleForm.selectedModules.length === 0) {
      addNotification('error', 'Please select at least one module');
      return;
    }

    try {
      const url = editingRule
        ? `${API_BASE_URL}/archive-rules/${editingRule.id}`
        : `${API_BASE_URL}/archive-rules`;

      const response = await fetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ruleForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save rule');
      }

      addNotification('success', `Archive rule ${editingRule ? 'updated' : 'created'} successfully`);

      // Close the form and reset
      setShowRuleModal(false);
      setEditingRule(null);

      loadArchiveRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      addNotification('error', error.message || 'Failed to save rule');
    }
  };

  // Handle delete rule
  const handleDeleteRule = (ruleId, ruleName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Archive Rule',
      message: `Are you sure you want to delete rule "${ruleName}"?\n\nThis will stop automatic archiving for this rule.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/archive-rules/${ruleId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete rule');
          }

          addNotification('success', 'Archive rule deleted successfully');
          loadArchiveRules();
        } catch (error) {
          console.error('Error deleting rule:', error);
          addNotification('error', error.message || 'Failed to delete rule');
        }
      }
    });
  };

  // Handle toggle rule enabled/disabled
  const handleToggleRule = async (ruleId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/archive-rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle rule');
      }

      addNotification('success', 'Rule status updated');
      loadArchiveRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      addNotification('error', error.message || 'Failed to toggle rule');
    }
  };

  // Handle trigger rule manually
  const handleTriggerRule = (ruleId, ruleName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Trigger Archive Rule',
      message: `Trigger archive rule "${ruleName}" now?\n\nThis will create a new archive based on the rule settings.`,
      type: 'info',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/archive-rules/${ruleId}/trigger`, {
            method: 'POST',
            headers: getAuthHeaders(),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to trigger rule');
          }

          addNotification('success', 'Archive rule triggered successfully. The archive will appear in a few moments...');
          loadArchiveRules();

          // Reload archives immediately
          loadArchives();

          // Reload again after delays to catch the newly created archive
          setTimeout(() => {
            loadArchives();
            loadStats();
          }, 3000);

          setTimeout(() => {
            loadArchives();
            loadStats();
          }, 8000);

          // Final reload for large archives
          setTimeout(() => {
            loadArchives();
            loadStats();
          }, 15000);
        } catch (error) {
          console.error('Error triggering rule:', error);
          addNotification('error', error.message || 'Failed to trigger rule');
        }
      }
    });
  };

  // Toggle rule module selection
  const toggleRuleModule = (moduleKey) => {
    setRuleForm(prev => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(moduleKey)
        ? prev.selectedModules.filter(m => m !== moduleKey)
        : [...prev.selectedModules, moduleKey]
    }));
  };

  // Get schedule display text
  const getScheduleText = (rule) => {
    const time = rule.schedule_time?.substring(0, 5) || '02:00';

    switch (rule.schedule_type) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = days[rule.schedule_day_of_week] || 'Sunday';
        return `Weekly on ${day} at ${time}`;
      case 'monthly':
        return `Monthly on day ${rule.schedule_day_of_month || 1} at ${time}`;
      case 'custom':
        return `Custom: ${rule.schedule_cron || 'Not configured'}`;
      default:
        return 'Not configured';
    }
  };

  return (
    <div className={`space-y-6 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="w-6 h-6" />
            Archive Management
          </h2>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Create, manage, and restore data archives with module selection and deduplication
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadArchives();
              loadStats();
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600'
                : 'bg-gray-200 hover:bg-gray-300'
            } transition-colors`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showCreateModal ? 'Cancel' : 'Create Archive'}
          </button>
        </div>
      </div>

      {/* Inline Create Archive Form */}
      {showCreateModal && (
        <div className={`rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="p-6 space-y-6">
            {/* Form Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Create New Archive
              </h3>
            </div>

            {/* Archive Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Archive Name *
              </label>
              <input
                type="text"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="e.g., Q4-2024-Archive"
                className={`w-full px-4 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-white border-gray-300'
                } border focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Description (Optional)
              </label>
              <textarea
                value={archiveDescription}
                onChange={(e) => setArchiveDescription(e.target.value)}
                placeholder="Brief description of what this archive contains..."
                rows={2}
                className={`w-full px-4 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-white border-gray-300'
                } border focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            {/* Module Selection */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">
                  Select Modules to Archive *
                </label>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {selectedModules.length === modules.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-auto p-2">
                {modules.map((module) => (
                  <div
                    key={module.key}
                    onClick={() => toggleModule(module.key)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedModules.includes(module.key)
                        ? 'border-blue-600 bg-blue-600/10'
                        : theme === 'dark'
                        ? 'border-gray-700 bg-gray-750 hover:border-gray-600'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {selectedModules.includes(module.key) ? (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs mb-0.5 truncate">{module.name}</h4>
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                          {module.description}
                        </p>
                        <p className="text-xs mt-0.5 opacity-70">
                          {module.tableCount} table{module.tableCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Summary */}
              {selectedModules.length > 0 && (
                <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-750' : 'bg-gray-100'}`}>
                  <p className="text-sm font-medium mb-2">
                    Selected: {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedModules.map((key) => {
                      const module = modules.find(m => m.key === key);
                      return (
                        <span
                          key={key}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                        >
                          {module?.name || key}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className={`px-6 py-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300'
                } transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateArchive}
                disabled={creating || !archiveName.trim() || selectedModules.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                {creating ? 'Creating Archive...' : 'Create Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Archives</p>
                <p className="text-2xl font-bold">{stats.total_archives || 0}</p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex items-center gap-3">
              <FileArchive className="w-8 h-8 text-green-600" />
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Records</p>
                <p className="text-2xl font-bold">{Number(stats.total_records || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-purple-600" />
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Size</p>
                <p className="text-2xl font-bold">{formatBytes(stats.total_size_bytes)}</p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-orange-600" />
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Active / Restored</p>
                <p className="text-2xl font-bold">{stats.active_archives || 0} / {stats.restored_archives || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">How Archive Restoration Works:</p>
            <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
              <li>Archives are <strong>merged</strong> with existing data (not replaced)</li>
              <li>Duplicate records are automatically detected and <strong>skipped</strong></li>
              <li>Only new records are added to your database</li>
              <li>You can safely restore archives without losing current data</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Archive Rules Section */}
      <div className={`rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Automatic Archive Rules
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRulesSection(!showRulesSection)}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title={showRulesSection ? 'Collapse' : 'Expand'}
            >
              {showRulesSection ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            <button
              onClick={() => openRuleModal()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showRuleModal ? 'Cancel' : 'Create Rule'}
            </button>
          </div>
        </div>

        {/* Inline Create/Edit Rule Form */}
        {showRuleModal && (
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="space-y-6">
              {/* Form Header */}
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  {editingRule ? 'Edit Archive Rule' : 'Create New Archive Rule'}
                </h4>
              </div>

              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={ruleForm.ruleName}
                  onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                  placeholder="e.g., Monthly Patient Data Archive"
                  className={`w-full px-4 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-white border-gray-300'
                  } border focus:ring-2 focus:ring-purple-500`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                  rows={2}
                  className={`w-full px-4 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-white border-gray-300'
                  } border focus:ring-2 focus:ring-purple-500`}
                />
              </div>

              {/* Module Selection */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium">
                    Select Modules to Archive *
                  </label>
                  <button
                    onClick={() => {
                      if (ruleForm.selectedModules.length === modules.length) {
                        setRuleForm({ ...ruleForm, selectedModules: [] });
                      } else {
                        setRuleForm({ ...ruleForm, selectedModules: modules.map(m => m.key) });
                      }
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    {ruleForm.selectedModules.length === modules.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-auto p-2">
                  {modules.map((module) => (
                    <div
                      key={module.key}
                      onClick={() => toggleRuleModule(module.key)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        ruleForm.selectedModules.includes(module.key)
                          ? 'border-purple-600 bg-purple-600/10'
                          : theme === 'dark'
                          ? 'border-gray-700 bg-gray-750 hover:border-gray-600'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {ruleForm.selectedModules.includes(module.key) ? (
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-xs mb-0.5 truncate">{module.name}</h4>
                          <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {module.tableCount} table{module.tableCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Summary */}
                {ruleForm.selectedModules.length > 0 && (
                  <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-750' : 'bg-gray-100'}`}>
                    <p className="text-sm">
                      Selected: {ruleForm.selectedModules.length} module{ruleForm.selectedModules.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Schedule Configuration */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Schedule Configuration</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Schedule Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Schedule Type *
                    </label>
                    <select
                      value={ruleForm.scheduleType}
                      onChange={(e) => setRuleForm({ ...ruleForm, scheduleType: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-white border-gray-300'
                      } border focus:ring-2 focus:ring-purple-500`}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom (Cron)</option>
                    </select>
                  </div>

                  {/* Schedule Time */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={ruleForm.scheduleTime}
                      onChange={(e) => setRuleForm({ ...ruleForm, scheduleTime: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-white border-gray-300'
                      } border focus:ring-2 focus:ring-purple-500`}
                    />
                  </div>
                </div>

                {/* Conditional Schedule Fields */}
                {ruleForm.scheduleType === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Day of Week *
                    </label>
                    <select
                      value={ruleForm.scheduleDayOfWeek}
                      onChange={(e) => setRuleForm({ ...ruleForm, scheduleDayOfWeek: parseInt(e.target.value) })}
                      className={`w-full px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-white border-gray-300'
                      } border focus:ring-2 focus:ring-purple-500`}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                )}

                {ruleForm.scheduleType === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Day of Month * (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={ruleForm.scheduleDayOfMonth}
                      onChange={(e) => setRuleForm({ ...ruleForm, scheduleDayOfMonth: parseInt(e.target.value) || 1 })}
                      className={`w-full px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-white border-gray-300'
                      } border focus:ring-2 focus:ring-purple-500`}
                    />
                  </div>
                )}

                {ruleForm.scheduleType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Cron Expression
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 0 2 * * *"
                      className={`w-full px-4 py-2 rounded-lg ${
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-white border-gray-300'
                      } border focus:ring-2 focus:ring-purple-500`}
                    />
                    <p className="text-xs mt-1 text-gray-400">
                      Standard cron format: minute hour day month weekday
                    </p>
                  </div>
                )}
              </div>

              {/* Retention Configuration */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Retention Days (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={ruleForm.retentionDays || ''}
                  onChange={(e) => setRuleForm({ ...ruleForm, retentionDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 365 (archive data older than 365 days)"
                  className={`w-full px-4 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-white border-gray-300'
                  } border focus:ring-2 focus:ring-purple-500`}
                />
                <p className="text-xs mt-1 text-gray-400">
                  If set, only data older than this many days will be archived. Leave empty to archive all data.
                </p>
              </div>

              {/* Enable/Disable */}
              <div>
                <Toggle
                  checked={ruleForm.enabled}
                  onChange={(checked) => setRuleForm({ ...ruleForm, enabled: checked })}
                  label="Enable this rule immediately"
                  theme={theme}
                  size="md"
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowRuleModal(false)}
                  className={`px-6 py-2 rounded-lg ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-200 hover:bg-gray-300'
                  } transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  disabled={!ruleForm.ruleName.trim() || ruleForm.selectedModules.length === 0}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRulesSection && (
          <div className="p-4">
            {archiveRules.length === 0 && !showRuleModal ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No automatic archive rules configured</p>
                <button
                  onClick={() => openRuleModal()}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Create Your First Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {archiveRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`border rounded-lg p-4 ${
                      theme === 'dark' ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-purple-600" />
                          <h4 className="font-semibold text-lg">{rule.rule_name}</h4>
                          <span className={`px-2 py-1 rounded text-xs ${
                            rule.enabled
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-white'
                          }`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {rule.last_run_status && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              rule.last_run_status === 'success'
                                ? 'bg-blue-600 text-white'
                                : rule.last_run_status === 'failed'
                                ? 'bg-red-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}>
                              {rule.last_run_status}
                            </span>
                          )}
                        </div>

                        {rule.description && (
                          <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {rule.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Schedule:</span>
                            <p className="font-medium">{getScheduleText(rule)}</p>
                          </div>
                          <div>
                            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Modules:</span>
                            <p className="font-medium">{rule.selected_modules?.length || 0}</p>
                          </div>
                          <div>
                            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Last Run:</span>
                            <p className="font-medium">
                              {rule.last_run_at ? formatDate(rule.last_run_at) : 'Never'}
                            </p>
                          </div>
                          <div>
                            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Next Run:</span>
                            <p className="font-medium">
                              {rule.next_run_at ? formatDate(rule.next_run_at) : 'Not scheduled'}
                            </p>
                          </div>
                        </div>

                        {rule.retention_days && (
                          <p className="text-sm text-gray-400 mb-2">
                            📅 Retention: Archive data older than {rule.retention_days} days
                          </p>
                        )}

                        {/* Module Tags */}
                        <div className="flex flex-wrap gap-2">
                          {rule.selected_modules?.map((moduleKey) => {
                            const module = modules.find(m => m.key === moduleKey);
                            return (
                              <span
                                key={moduleKey}
                                className={`px-2 py-1 rounded text-xs ${
                                  theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                                }`}
                              >
                                {module?.name || moduleKey}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            rule.enabled
                              ? 'bg-gray-600 hover:bg-gray-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTriggerRule(rule.id, rule.rule_name)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          title="Trigger Now"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openRuleModal(rule)}
                          className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                          title="Edit Rule"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id, rule.rule_name)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archives List */}
      <div className={`rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Archives</h3>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p>Loading archives...</p>
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>No archives created yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Create Your First Archive
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {archives.map((archive) => (
                <div
                  key={archive.id}
                  className={`border rounded-lg p-4 ${
                    theme === 'dark' ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileArchive className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold text-lg">{archive.archive_name}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          archive.status === 'active'
                            ? 'bg-green-600 text-white'
                            : archive.status === 'restored'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-600 text-white'
                        }`}>
                          {archive.status}
                        </span>
                      </div>

                      {archive.description && (
                        <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          {archive.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Created:</span>
                          <p className="font-medium">{archive.archive_date ? formatDate(archive.archive_date) : 'N/A'}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Records:</span>
                          <p className="font-medium">{Number(archive.record_count || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Size:</span>
                          <p className="font-medium">{formatBytes(archive.size_bytes || 0)}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Modules:</span>
                          <p className="font-medium">{archive.modules?.length || 0}</p>
                        </div>
                      </div>

                      {/* Module Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {archive.modules?.map((moduleKey) => {
                          const module = modules.find(m => m.key === moduleKey);
                          return (
                            <span
                              key={moduleKey}
                              className={`px-2 py-1 rounded text-xs ${
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              }`}
                            >
                              {module?.name || moduleKey}
                            </span>
                          );
                        })}
                      </div>

                      {/* Expandable Record Counts */}
                      {archive.metadata?.recordCounts && (
                        <div>
                          <button
                            onClick={() => setExpandedArchive(expandedArchive === archive.id ? null : archive.id)}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {expandedArchive === archive.id ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Show Record Counts
                              </>
                            )}
                          </button>

                          {expandedArchive === archive.id && (
                            <div className={`mt-3 p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                              <p className="text-sm font-semibold mb-2">Records per Table:</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                {Object.entries(archive.metadata.recordCounts).map(([table, count]) => (
                                  <div key={table} className="flex justify-between">
                                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>{table}:</span>
                                    <span className="font-medium">{count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleBrowseArchive(archive.id, archive.archive_name)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        title="Browse Archive Data"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestoreArchive(archive.id, archive.archive_name)}
                        disabled={restoring}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        title="Restore Archive (Merge with existing data)"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArchive(archive.id, archive.archive_name)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Delete Archive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Browse Archive Modal */}
      {showBrowseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-6xl w-full rounded-lg shadow-xl max-h-[90vh] overflow-auto ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-inherit z-10">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Browse Archive: {selectedArchive?.name}
              </h3>
              <button
                onClick={() => {
                  setShowBrowseModal(false);
                  setBrowseData(null);
                  setSelectedTable(null);
                }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {browsing ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                  <p>Loading archive data...</p>
                </div>
              ) : browseData ? (
                <div className="space-y-6">
                  {/* Archive Info */}
                  {browseData.archive && (
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50'}`}>
                      <h4 className="font-semibold mb-2">Archive Information</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Name:</span>
                          <p className="font-medium">{browseData.archive.name}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Date:</span>
                          <p className="font-medium">{formatDate(browseData.archive.date)}</p>
                        </div>
                      </div>
                      {browseData.archive.description && (
                        <p className="text-sm mt-2">{browseData.archive.description}</p>
                      )}
                    </div>
                  )}

                  {/* Tables List */}
                  {browseData.tables && !selectedTable && (
                    <div>
                      <h4 className="font-semibold mb-3">Archived Tables</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {browseData.tables.map((tableInfo) => (
                          <div
                            key={tableInfo.table}
                            className={`p-4 rounded-lg border ${
                              theme === 'dark' ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Table className="w-4 h-4 text-blue-600" />
                                  <h5 className="font-semibold">{tableInfo.table}</h5>
                                </div>
                                <p className="text-sm text-gray-400 mt-1">
                                  {tableInfo.recordCount} record{tableInfo.recordCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <button
                                onClick={() => handleBrowseTable(selectedArchive.id, tableInfo.table)}
                                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                              >
                                View Data
                              </button>
                            </div>

                            {/* Preview */}
                            {tableInfo.preview && tableInfo.preview.length > 0 && (
                              <div className="mt-3 text-sm">
                                <p className="text-gray-400 mb-2">Preview (first row):</p>
                                <div className={`p-2 rounded text-xs overflow-auto ${
                                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                  <pre>{JSON.stringify(tableInfo.preview[0], null, 2)}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Table Data */}
                  {selectedTable && browseData.selectedTableData && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Table className="w-5 h-5" />
                          {selectedTable}
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedTable(null);
                            handleBrowseArchive(selectedArchive.id, selectedArchive.name);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          ← Back to Tables
                        </button>
                      </div>

                      <p className="text-sm text-gray-400 mb-3">
                        Showing {browseData.selectedTableData.data?.length || 0} of {browseData.selectedTableData.pagination?.total || 0} records
                      </p>

                      {/* Data Table */}
                      <div className="overflow-x-auto">
                        <table className={`min-w-full text-sm ${theme === 'dark' ? 'bg-gray-750' : 'bg-white'}`}>
                          <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}>
                            <tr>
                              {browseData.selectedTableData.data && browseData.selectedTableData.data[0] &&
                                Object.keys(browseData.selectedTableData.data[0]).map((column) => (
                                  <th key={column} className="px-4 py-2 text-left font-medium">
                                    {column}
                                  </th>
                                ))
                              }
                            </tr>
                          </thead>
                          <tbody>
                            {browseData.selectedTableData.data?.map((row, idx) => (
                              <tr key={idx} className={theme === 'dark' ? 'border-t border-gray-700' : 'border-t border-gray-200'}>
                                {Object.values(row).map((value, cellIdx) => (
                                  <td key={cellIdx} className="px-4 py-2">
                                    {typeof value === 'object' && value !== null
                                      ? JSON.stringify(value)
                                      : String(value || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {browseData.selectedTableData.data && browseData.selectedTableData.data.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          No data found in this table
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        theme={theme}
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
};

export default ArchiveManagementTab;
