import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ArrowLeft, Mail, Send, Calendar } from 'lucide-react';

const CampaignsManagementView = ({
  theme,
  api,
  setShowForm,
  setEditingCampaign,
  setCurrentModule,
  addNotification,
  t
}) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaigns();
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      addNotification('alert', 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await api.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      addNotification('success', 'Campaign deleted successfully');
    } catch (error) {
      console.error('Error deleting campaign:', error);
      addNotification('alert', 'Failed to delete campaign');
    }
  };

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    setShowForm('campaign');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('crm')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title={t.backToCRM || 'Back to CRM'}
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <Mail className="w-6 h-6 text-red-400" />
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {t.emailCampaigns || 'Email Campaigns'}
          </h2>
        </div>
        <button
          onClick={() => {
            setEditingCampaign(null);
            setShowForm('campaign');
          }}
          className={`flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
          {t.createCampaign || 'Create Campaign'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-red-400' : 'border-red-600'}`}></div>
        </div>
      ) : (
        <div className={`bg-gradient-to-br rounded-xl border overflow-hidden ${theme === 'dark' ? 'from-slate-800/50 to-slate-900/50 border-slate-700/50' : 'from-gray-100/50 to-gray-200/50 border-gray-300/50'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-100/50 border-gray-300'}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.campaign || 'Campaign'}
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.subject || 'Subject'}
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.targetAudience || 'Audience'}
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.status || 'Status'}
                  </th>
                  <th className={`px-6 py-4 text-left text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    {t.actions || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={`px-6 py-8 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                      {t.noCampaigns || 'No campaigns found. Create your first campaign to get started.'}
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign, idx) => (
                    <tr key={campaign.id} className={`border-b transition-colors ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-800/30' : 'border-gray-300/50 hover:bg-gray-200/30'} ${idx % 2 === 0 ? (theme === 'dark' ? 'bg-slate-800/10' : 'bg-gray-100/10') : ''}`}>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        <div className="font-medium">{campaign.name}</div>
                      </td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {campaign.subject}
                      </td>
                      <td className={`px-6 py-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {campaign.targetAudience || 'All'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          campaign.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                          campaign.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {campaign.status || 'draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(campaign)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.edit || 'Edit'}
                          >
                            <Edit className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
                          </button>
                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'}`}
                            title={t.delete || 'Delete'}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsManagementView;
