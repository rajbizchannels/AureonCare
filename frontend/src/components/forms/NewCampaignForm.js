import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Users, Calendar } from 'lucide-react';

const NewCampaignForm = ({ theme, api, onClose, onSuccess, addNotification, t, editingCampaign = null }) => {
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    message: '',
    offeringId: '',
    targetAudience: 'all',
    scheduledDate: '',
    status: 'draft'
  });

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const data = await api.getOfferings({ active: true });
        setOfferings(data || []);
      } catch (error) {
        console.error('Error loading offerings:', error);
        addNotification('alert', 'Failed to load healthcare offerings');
      } finally {
        setLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, [api, addNotification]);

  // Populate form when editing
  useEffect(() => {
    if (editingCampaign) {
      setFormData({
        name: editingCampaign.name || '',
        subject: editingCampaign.subject || '',
        message: editingCampaign.message || '',
        offeringId: editingCampaign.offeringId || '',
        targetAudience: editingCampaign.targetAudience || 'all',
        scheduledDate: editingCampaign.scheduledDate || '',
        status: editingCampaign.status || 'draft'
      });
    }
  }, [editingCampaign]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addNotification('alert', 'Please enter campaign name');
      return;
    }

    if (!formData.subject.trim()) {
      addNotification('alert', 'Please enter email subject');
      return;
    }

    setLoading(true);
    try {
      const campaignData = {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim() || null,
        offeringId: formData.offeringId || null,
        targetAudience: formData.targetAudience,
        scheduledDate: formData.scheduledDate || null,
        status: formData.status
      };

      let result;
      if (editingCampaign) {
        result = await api.updateCampaign(editingCampaign.id, campaignData);
        addNotification('success', t.campaignUpdatedSuccessfully || 'Campaign updated successfully');
      } else {
        result = await api.createCampaign(campaignData);
        addNotification('success', t.campaignCreatedSuccessfully || 'Campaign created successfully');
      }
      onSuccess(result);
    } catch (error) {
      console.error(`Error ${editingCampaign ? 'updating' : 'creating'} campaign:`, error);
      addNotification('alert', error.message || `Failed to ${editingCampaign ? 'update' : 'create'} campaign`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-red-400" />
            <h3 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {editingCampaign ? (t.editCampaign || 'Edit Campaign') : (t.createCampaign || 'Create Campaign')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Campaign Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.campaignName || 'Campaign Name'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                placeholder={t.enterCampaignName || 'Enter campaign name'}
                required
              />
            </div>

            {/* Email Subject */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.emailSubject || 'Email Subject'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                placeholder={t.enterEmailSubject || 'Enter email subject'}
                required
              />
            </div>

            {/* Healthcare Offering */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.healthcareOffering || 'Healthcare Offering'} ({t.optional || 'optional'})
              </label>
              <select
                value={formData.offeringId}
                onChange={(e) => setFormData({...formData, offeringId: e.target.value})}
                className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                disabled={loadingOfferings}
              >
                <option value="">{loadingOfferings ? (t.loading || 'Loading...') : (t.noOffering || 'No specific offering')}</option>
                {offerings.map(offering => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </select>
              <p className={`mt-1 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {t.offeringHelp || 'Select an offering to promote in this campaign'}
              </p>
            </div>

            {/* Message */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.message || 'Message'}
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                placeholder={t.enterMessage || 'Enter campaign message'}
                rows={6}
              />
            </div>

            {/* Target Audience & Scheduled Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <Users className="w-4 h-4 inline mr-1" />
                  {t.targetAudience || 'Target Audience'}
                </label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}
                  className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="all">{t.allPatients || 'All Patients'}</option>
                  <option value="active">{t.activePatients || 'Active Patients'}</option>
                  <option value="new">{t.newPatients || 'New Patients (Last 30 days)'}</option>
                  <option value="inactive">{t.inactivePatients || 'Inactive Patients (6+ months)'}</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {t.scheduledDate || 'Scheduled Date'} ({t.optional || 'optional'})
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                  className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                {t.status || 'Status'}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className={`w-full px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="draft">{t.draft || 'Draft'}</option>
                <option value="scheduled">{t.scheduled || 'Scheduled'}</option>
                <option value="sent">{t.sent || 'Sent'}</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-end gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              disabled={loading}
            >
              {t.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {editingCampaign ? (t.updating || 'Updating...') : (t.creating || 'Creating...')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {editingCampaign ? (t.updateCampaign || 'Update Campaign') : (t.createCampaign || 'Create Campaign')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCampaignForm;
