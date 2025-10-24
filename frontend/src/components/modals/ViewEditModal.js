import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '../../utils/formatters';

const ViewEditModal = ({
  theme,
  editingItem,
  currentView,
  onClose,
  onSave,
  patients,
  api,
  addNotification,
  setAppointments,
  setPatients,
  setClaims,
  setUsers,
  setUser,
  user
}) => {
  const [editData, setEditData] = useState(editingItem?.data || {});

  // Update editData when editingItem changes
  useEffect(() => {
    if (editingItem?.data) {
      setEditData(editingItem.data);
    }
  }, [editingItem]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!editingItem) return null;

  const isView = currentView === 'view';
  const { type, data } = editingItem;

  const handleSave = async () => {
    try {
      if (type === 'appointment') {
        const updated = await api.updateAppointment(editData.id, editData);
        setAppointments(prev => prev.map(apt =>
          apt.id === editData.id ? updated : apt
        ));
      } else if (type === 'patient') {
        const updated = await api.updatePatient(editData.id, editData);
        setPatients(prev => prev.map(patient =>
          patient.id === editData.id ? {...updated, name: updated.name || `${updated.first_name} ${updated.last_name}`} : patient
        ));
      } else if (type === 'userProfile') {
        // Update user profile
        const updated = await api.updateUser(editData.id, editData);
        setUser(updated);
        await addNotification('alert', 'User profile updated successfully');
      } else if (type === 'user') {
        // Update user
        const updated = await api.updateUser(editData.id, editData);
        setUsers(prev => prev.map(u =>
          u.id === editData.id ? updated : u
        ));
        await addNotification('alert', 'User updated successfully');
      } else {
        const updated = await api.updateClaim(editData.id, editData);
        setClaims(prev => prev.map(claim =>
          claim.id === editData.id ? updated : claim
        ));
      }
      await addNotification('alert', `${type === 'appointment' ? 'Appointment' : type === 'patient' ? 'Patient' : type === 'userProfile' ? 'User Profile' : type === 'user' ? 'User' : 'Claim'} updated successfully`);
      onClose();
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save changes. Please try again.');
    }
  };

  return (
    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/50' : 'bg-black/30'}`} onClick={onClose}>
      <div className={`rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'}`} onClick={e => e.stopPropagation()}>
        <div className={`p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {isView ? 'View' : 'Edit'} {type === 'appointment' ? 'Appointment' : type === 'patient' ? 'Patient Chart' : type === 'userProfile' ? 'User Profile' : 'Claim'}
          </h2>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {type === 'appointment' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                  ) : (
                    <select
                      value={editData.patientId}
                      onChange={(e) => {
                        const patient = patients.find(p => p.id.toString() === e.target.value);
                        setEditData({...editData, patientId: e.target.value, patient: patient?.name});
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Doctor</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.doctor}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.date)}</p>
                  ) : (
                    <input
                      type="date"
                      value={editData.date ? editData.date.split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, date: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Time</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatTime(editData.time)}</p>
                  ) : (
                    <input
                      type="time"
                      value={editData.time}
                      onChange={(e) => setEditData({...editData, time: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Type</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.type}</p>
                  ) : (
                    <select
                      value={editData.type}
                      onChange={(e) => setEditData({...editData, type: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="Check-up">Check-up</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Consultation">Consultation</option>
                      <option value="Physical">Physical Exam</option>
                      <option value="Procedure">Procedure</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Duration</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.duration} minutes</p>
                  ) : (
                    <input
                      type="number"
                      value={editData.duration}
                      onChange={(e) => setEditData({...editData, duration: parseInt(e.target.value)})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.status === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {editData.status}
                    </span>
                  ) : (
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Reason</label>
                {isView ? (
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.reason}</p>
                ) : (
                  <input
                    type="text"
                    value={editData.reason}
                    onChange={(e) => setEditData({...editData, reason: e.target.value})}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-cyan-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
            </div>
          ) : type === 'patient' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>First Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.first_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Last Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.last_name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>MRN</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.mrn || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Date of Birth</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.dob)}</p>
                  ) : (
                    <input
                      type="date"
                      value={(editData.dob || '').split('T')[0]}
                      onChange={(e) => setEditData({...editData, dob: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Gender</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.gender || 'N/A'}</p>
                  ) : (
                    <select
                      value={editData.gender || ''}
                      onChange={(e) => setEditData({...editData, gender: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Address</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.address || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.address || ''}
                      onChange={(e) => setEditData({...editData, address: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : type === 'userProfile' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {editData.avatar}
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
                  <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Full Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Practice</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.practice}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.practice || ''}
                      onChange={(e) => setEditData({...editData, practice: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email || 'sarah.chen@medflow.com'}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || 'sarah.chen@medflow.com'}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || '(555) 123-4567'}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || '(555) 123-4567'}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || 'MD-123456'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.license || 'MD-123456'}
                      onChange={(e) => setEditData({...editData, license: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || 'Internal Medicine'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.specialty || 'Internal Medicine'}
                      onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Language</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.language || 'English'}</p>
                  ) : (
                    <select
                      value={editData.language || 'English'}
                      onChange={(e) => setEditData({...editData, language: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Hindi">Hindi</option>
                    </select>
                  )}
                </div>
              </div>
              <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100/50'}`}>
                <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Preferences</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Email Notifications</span>
                    <input
                      type="checkbox"
                      checked={editData.emailNotifications !== false}
                      onChange={(e) => setEditData({...editData, emailNotifications: e.target.checked})}
                      disabled={isView}
                      className="form-checkbox h-5 w-5 text-cyan-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>SMS Alerts</span>
                    <input
                      type="checkbox"
                      checked={editData.smsAlerts !== false}
                      onChange={(e) => setEditData({...editData, smsAlerts: e.target.checked})}
                      disabled={isView}
                      className="form-checkbox h-5 w-5 text-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : type === 'user' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {editData.avatar || editData.name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</p>
                  <p className={`font-medium capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Full Name</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.name}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Email</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.email}</p>
                  ) : (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({...editData, email: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Phone</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.phone || 'N/A'}</p>
                  ) : (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Role</label>
                  {isView ? (
                    <p className={`capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.role}</p>
                  ) : (
                    <select
                      value={editData.role || 'staff'}
                      onChange={(e) => setEditData({...editData, role: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="staff">Staff</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>License</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.license || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.license || ''}
                      onChange={(e) => setEditData({...editData, license: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Specialty</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.specialty || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.specialty || ''}
                      onChange={(e) => setEditData({...editData, specialty: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Practice</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.practice || 'N/A'}</p>
                  ) : (
                    <input
                      type="text"
                      value={editData.practice || ''}
                      onChange={(e) => setEditData({...editData, practice: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Claim Number</label>
                  <p className={`font-mono ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.claimNo || editData.claim_no || 'N/A'}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Status</label>
                  {isView ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      editData.status === 'Approved' ? 'bg-green-500/20 text-green-400' :
                      editData.status === 'Submitted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {editData.status}
                    </span>
                  ) : (
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({...editData, status: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                      <option value="Denied">Denied</option>
                      <option value="Paid">Paid</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Patient</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.patient}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Amount</label>
                  {isView ? (
                    <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(editData.amount)}</p>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={editData.amount}
                      onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value)})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Payer</label>
                  <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.payer}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Service Date</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formatDate(editData.serviceDate || editData.service_date)}</p>
                  ) : (
                    <input
                      type="date"
                      value={(editData.serviceDate || editData.service_date || '').split('T')[0]}
                      onChange={(e) => setEditData({...editData, serviceDate: e.target.value, service_date: e.target.value})}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Diagnosis Codes</label>
                {isView ? (
                  <div className="flex gap-2 flex-wrap">
                    {editData.diagnosisCodes?.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editData.diagnosisCodes?.join(', ')}
                    onChange={(e) => setEditData({...editData, diagnosisCodes: e.target.value.split(',').map(c => c.trim())})}
                    placeholder="Z00.00, I10"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Procedure Codes</label>
                {isView ? (
                  <div className="flex gap-2 flex-wrap">
                    {editData.procedureCodes?.map((code, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editData.procedureCodes?.join(', ')}
                    onChange={(e) => setEditData({...editData, procedureCodes: e.target.value.split(',').map(c => c.trim())})}
                    placeholder="99213, 99214"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                )}
              </div>
              {(editData.notes || !isView) && (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Notes</label>
                  {isView ? (
                    <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{editData.notes}</p>
                  ) : (
                    <textarea
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({...editData, notes: e.target.value})}
                      rows="3"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          <div className={`flex gap-3 mt-6 pt-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}`}>
            <button
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              Close
            </button>
            {!isView && (
              <button
                onClick={handleSave}
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEditModal;
