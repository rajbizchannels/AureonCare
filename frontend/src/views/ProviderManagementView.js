import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Clock, Settings, Link2, Mail, Phone,
  Plus, Edit2, Trash2, Eye, EyeOff, Copy, Check, AlertCircle
} from 'lucide-react';
import { DoctorAvailabilityManager } from '../components/scheduling';

const ProviderManagementView = () => {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, schedule, appointments, booking
  const [bookingConfig, setBookingConfig] = useState(null);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      fetchProviderDetails(selectedProvider.id);
    }
  }, [selectedProvider]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) throw new Error('Failed to fetch providers');
      const data = await response.json();
      setProviders(data);
      if (data.length > 0 && !selectedProvider) {
        setSelectedProvider(data[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderDetails = async (providerId) => {
    try {
      // Fetch booking config
      const configResponse = await fetch(`/api/scheduling/booking-config/${providerId}`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setBookingConfig(configData);
      } else {
        setBookingConfig(null);
      }

      // Fetch appointment types
      const typesResponse = await fetch(`/api/scheduling/appointment-types/${providerId}`);
      if (typesResponse.ok) {
        const typesData = await typesResponse.json();
        setAppointmentTypes(typesData);
      } else {
        setAppointmentTypes([]);
      }
    } catch (err) {
      console.error('Error fetching provider details:', err);
    }
  };

  const initializeScheduleWithClinicHours = async (providerId) => {
    try {
      // Default clinic hours: Monday-Friday 9 AM - 5 PM
      const clinicSchedule = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', timezone: 'America/New_York' }
      ];

      const response = await fetch('/api/scheduling/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          schedules: clinicSchedule
        })
      });

      if (!response.ok) throw new Error('Failed to initialize schedule');

      // Create default appointment type
      await fetch('/api/scheduling/appointment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          name: 'Office Visit',
          description: 'Standard in-person consultation',
          durationMinutes: 30,
          bufferMinutes: 15,
          color: '#3B82F6',
          price: 100.00,
          isActive: true
        })
      });

      // Create booking configuration
      const provider = providers.find(p => p.id === providerId);
      const slug = `${provider.first_name}-${provider.last_name}-${providerId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

      await fetch('/api/scheduling/booking-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          bookingUrlSlug: slug,
          timezone: 'America/New_York',
          slotIntervalMinutes: 15,
          allowPublicBooking: true,
          sendConfirmationEmail: true,
          sendReminderEmail: true,
          reminderHoursBefore: 24
        })
      });

      await fetchProviderDetails(providerId);
      alert('Schedule initialized with clinic working hours!');
    } catch (err) {
      alert('Error initializing schedule: ' + err.message);
    }
  };

  const copyBookingUrl = () => {
    if (bookingConfig?.booking_url_slug) {
      const url = `${window.location.origin}/book/${bookingConfig.booking_url_slug}`;
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const togglePublicBooking = async () => {
    try {
      const response = await fetch(`/api/scheduling/booking-config/${selectedProvider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowPublicBooking: !bookingConfig.allow_public_booking
        })
      });

      if (!response.ok) throw new Error('Failed to update booking config');
      await fetchProviderDetails(selectedProvider.id);
    } catch (err) {
      alert('Error updating booking config: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <AlertCircle className="inline w-5 h-5 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Provider List */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Providers</h2>
          <p className="text-sm text-gray-600 mt-1">{providers.length} total</p>
        </div>
        <div className="p-2">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider)}
              className={`w-full text-left p-4 rounded-lg mb-2 transition-all ${
                selectedProvider?.id === provider.id
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-white border border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {provider.first_name?.[0]}{provider.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    Dr. {provider.first_name} {provider.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">{provider.specialization || 'General Practice'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedProvider && (
          <div className="p-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {selectedProvider.first_name?.[0]}{selectedProvider.last_name?.[0]}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      Dr. {selectedProvider.first_name} {selectedProvider.last_name}
                    </h1>
                    <p className="text-gray-600 mt-1">{selectedProvider.specialization || 'General Practice'}</p>
                    <div className="flex items-center gap-4 mt-2">
                      {selectedProvider.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {selectedProvider.email}
                        </div>
                      )}
                      {selectedProvider.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {selectedProvider.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Calendar className="w-5 h-5" />
                  Manage Schedule
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <div className="flex gap-4 px-6">
                  {[
                    { id: 'details', label: 'Details', icon: User },
                    { id: 'schedule', label: 'Schedule', icon: Calendar },
                    { id: 'booking', label: 'Public Booking', icon: Link2 },
                    { id: 'appointments', label: 'Appointment Types', icon: Clock }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Provider Information</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <p className="text-gray-900">{selectedProvider.first_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <p className="text-gray-900">{selectedProvider.last_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{selectedProvider.email || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">{selectedProvider.phone || 'Not provided'}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                        <p className="text-gray-900">{selectedProvider.specialization || 'General Practice'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">Weekly Schedule</h2>
                      <button
                        onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Clock className="w-5 h-5" />
                        Set Clinic Hours
                      </button>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        <strong>Clinic Working Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM
                      </p>
                      <p className="text-sm text-blue-700 mt-2">
                        Click "Set Clinic Hours" to automatically configure this provider's schedule to match clinic hours.
                      </p>
                    </div>
                    <div className="text-center py-8">
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">
                        Click "Manage Schedule" above to view and edit the detailed weekly schedule
                      </p>
                    </div>
                  </div>
                )}

                {/* Public Booking Tab */}
                {activeTab === 'booking' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Public Booking Configuration</h2>
                    {bookingConfig ? (
                      <div className="space-y-6">
                        {/* Booking URL */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Public Booking Link</h3>
                            <button
                              onClick={togglePublicBooking}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                                bookingConfig.allow_public_booking
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-600 text-white hover:bg-gray-700'
                              }`}
                            >
                              {bookingConfig.allow_public_booking ? (
                                <>
                                  <Eye className="w-4 h-4" />
                                  Enabled
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  Disabled
                                </>
                              )}
                            </button>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <code className="text-sm text-gray-700">
                                {window.location.origin}/book/{bookingConfig.booking_url_slug}
                              </code>
                              <button
                                onClick={copyBookingUrl}
                                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                {copiedUrl ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-3">
                            Share this link with patients to allow them to book appointments online.
                          </p>
                        </div>

                        {/* Configuration Details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-2">Booking Settings</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Slot Interval:</span>
                                <span className="font-medium">{bookingConfig.slot_interval_minutes} min</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Timezone:</span>
                                <span className="font-medium">{bookingConfig.timezone}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Max Concurrent:</span>
                                <span className="font-medium">{bookingConfig.max_concurrent_bookings}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-2">Policies</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Cancellation:</span>
                                <span className="font-medium">
                                  {bookingConfig.allow_cancellation
                                    ? `${bookingConfig.cancellation_hours_before}h before`
                                    : 'Not allowed'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Rescheduling:</span>
                                <span className="font-medium">
                                  {bookingConfig.allow_rescheduling
                                    ? `${bookingConfig.reschedule_hours_before}h before`
                                    : 'Not allowed'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Reminders:</span>
                                <span className="font-medium">
                                  {bookingConfig.send_reminder_email
                                    ? `${bookingConfig.reminder_hours_before}h before`
                                    : 'Disabled'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Link2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No booking configuration found</p>
                        <button
                          onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Initialize Booking Setup
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Appointment Types Tab */}
                {activeTab === 'appointments' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">Appointment Types</h2>
                    </div>
                    {appointmentTypes.length > 0 ? (
                      <div className="grid gap-4">
                        {appointmentTypes.map(type => (
                          <div key={type.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div
                                  className="w-4 h-4 rounded-full mt-1"
                                  style={{ backgroundColor: type.color }}
                                ></div>
                                <div>
                                  <h3 className="font-semibold text-lg text-gray-900">{type.name}</h3>
                                  {type.description && (
                                    <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                                  )}
                                  <div className="flex items-center gap-6 mt-3 text-sm">
                                    <div className="flex items-center gap-1 text-gray-600">
                                      <Clock className="w-4 h-4" />
                                      <span>{type.duration_minutes} min</span>
                                    </div>
                                    {type.buffer_minutes > 0 && (
                                      <span className="text-gray-600">
                                        Buffer: {type.buffer_minutes} min
                                      </span>
                                    )}
                                    {type.price > 0 && (
                                      <span className="font-semibold text-green-600">
                                        ${type.price}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                type.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {type.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No appointment types configured</p>
                        <button
                          onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Set Up Appointment Types
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Management Modal */}
      {showScheduleModal && selectedProvider && (
        <DoctorAvailabilityManager
          providerId={selectedProvider.id}
          onClose={() => {
            setShowScheduleModal(false);
            fetchProviderDetails(selectedProvider.id);
          }}
        />
      )}
    </div>
  );
};

export default ProviderManagementView;
