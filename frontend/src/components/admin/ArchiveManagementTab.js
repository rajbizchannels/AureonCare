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

  // Load archives
  const loadArchives = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/archive/list`, {
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

  // Initial load
  useEffect(() => {
    loadArchives();
    loadModules();
    loadStats();
  }, [loadArchives, loadModules, loadStats]);

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
      addNotification('success', `Archive "${archiveName}" created successfully`);

      // Reset form and reload
      setShowCreateModal(false);
      setArchiveName('');
      setArchiveDescription('');
      setSelectedModules([]);
      loadArchives();
      loadStats();
    } catch (error) {
      console.error('Error creating archive:', error);
      addNotification('error', error.message || 'Failed to create archive');
    } finally {
      setCreating(false);
    }
  };

  // Handle restore archive
  const handleRestoreArchive = async (archiveId, archiveName) => {
    if (!confirm(`Are you sure you want to restore archive "${archiveName}"?\n\nThis will merge the archived data with existing data. Duplicates will be skipped automatically.`)) {
      return;
    }

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
  };

  // Handle delete archive
  const handleDeleteArchive = async (archiveId, archiveName) => {
    if (!confirm(`Are you sure you want to delete archive "${archiveName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

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
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Archive
          </button>
        </div>
      </div>

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
                          <p className="font-medium">{formatDate(archive.created_at)}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Records:</span>
                          <p className="font-medium">{Number(archive.record_count || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Size:</span>
                          <p className="font-medium">{formatBytes(archive.size_bytes)}</p>
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

      {/* Create Archive Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-4xl w-full rounded-lg shadow-xl max-h-[90vh] overflow-auto ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-inherit z-10">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Archive
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
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
                  rows={3}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-auto p-2">
                  {modules.map((module) => (
                    <div
                      key={module.key}
                      onClick={() => toggleModule(module.key)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedModules.includes(module.key)
                          ? 'border-blue-600 bg-blue-600/10'
                          : theme === 'dark'
                          ? 'border-gray-700 bg-gray-750 hover:border-gray-600'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {selectedModules.includes(module.key) ? (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{module.name}</h4>
                          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {module.description}
                          </p>
                          <p className="text-xs mt-1 opacity-70">
                            {module.tableCount} table{module.tableCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Summary */}
              {selectedModules.length > 0 && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-750' : 'bg-gray-100'}`}>
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

            {/* Modal Actions */}
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-inherit">
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
    </div>
  );
};

export default ArchiveManagementTab;
