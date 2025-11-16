import React, { useState, useEffect } from 'react';
import {
  User, Calendar, Clock, Settings, Link2, Mail, Phone,
  Plus, Edit2, Trash2, Eye, EyeOff, Copy, Check, AlertCircle
} from 'lucide-react';
import { DoctorAvailabilityManager } from '../components/scheduling';

// Helper function to get authentication headers
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) {
      headers['x-user-id'] = user.id;
      headers['x-user-role'] = user.role || 'patient';
    }
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
  }

  return headers;
};

const ProviderManagementView = ({ theme = 'dark' }) => {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule'); // schedule, appointments, booking
  const [bookingConfig, setBookingConfig] = useState(null);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [availability, setAvailability] = useState([]);

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
      const response = await fetch('/api/providers', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch providers');
        }
        throw new Error(`Failed to fetch providers (${response.status})`);
      }
      const data = await response.json();
      setProviders(data);
      if (data.length > 0 && !selectedProvider) {
        setSelectedProvider(data[0]);
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if provider's schedule matches clinic hours (Mon-Fri 9-5)
  const scheduleMatchesClinicHours = () => {
    if (availability.length === 0) {
      return false;
    }

    // Define clinic schedule
    const clinicSchedule = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' }
    ];

    // Check if availability has exactly 5 entries (Mon-Fri)
    if (availability.length !== 5) {
      return false;
    }

    // Check if each day matches clinic hours
    for (const clinicDay of clinicSchedule) {
      const providerDay = availability.find(
        a => a.day_of_week === clinicDay.dayOfWeek && a.is_available === true
      );

      if (!providerDay) {
        return false;
      }

      // Normalize times (handle both 'HH:MM' and 'HH:MM:SS' formats)
      const normalizeTime = (time) => time ? time.substring(0, 5) : '';
      const providerStart = normalizeTime(providerDay.start_time);
      const providerEnd = normalizeTime(providerDay.end_time);

      // Check if times match
      if (providerStart !== clinicDay.startTime ||
          providerEnd !== clinicDay.endTime) {
        return false;
      }
    }

    return true;
  };

  const fetchProviderDetails = async (providerId) => {
    try {
      // Fetch booking config
      const configResponse = await fetch(`/api/scheduling/booking-config/${providerId}`, {
        headers: getAuthHeaders()
      });
      if (configResponse.ok) {
        const contentType = configResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const configData = await configResponse.json();
          setBookingConfig(configData);
        } else {
          console.warn('Booking config response is not JSON');
          setBookingConfig(null);
        }
      } else {
        console.log(`No booking config found for provider ${providerId} (${configResponse.status})`);
        setBookingConfig(null);
      }

      // Fetch appointment types
      const typesResponse = await fetch(`/api/scheduling/appointment-types/${providerId}`, {
        headers: getAuthHeaders()
      });
      if (typesResponse.ok) {
        const contentType = typesResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const typesData = await typesResponse.json();
          setAppointmentTypes(typesData);
        } else {
          console.warn('Appointment types response is not JSON');
          setAppointmentTypes([]);
        }
      } else {
        console.log(`No appointment types found for provider ${providerId} (${typesResponse.status})`);
        setAppointmentTypes([]);
      }

      // Fetch availability schedule
      const availabilityResponse = await fetch(`/api/scheduling/availability/${providerId}`, {
        headers: getAuthHeaders()
      });
      if (availabilityResponse.ok) {
        const contentType = availabilityResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const availabilityData = await availabilityResponse.json();
          setAvailability(availabilityData);
        } else {
          console.warn('Availability response is not JSON');
          setAvailability([]);
        }
      } else {
        console.log(`No availability found for provider ${providerId} (${availabilityResponse.status})`);
        setAvailability([]);
      }
    } catch (err) {
      console.error('Error fetching provider details:', err);
      // Don't throw - just log and set empty states
      setBookingConfig(null);
      setAppointmentTypes([]);
      setAvailability([]);
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          providerId,
          schedules: clinicSchedule
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to initialize schedule');
        }
        throw new Error(`Failed to initialize schedule (${response.status})`);
      }

      // Create default appointment type only if none exist
      if (appointmentTypes.length === 0) {
        const appointmentTypeResponse = await fetch('/api/scheduling/appointment-types', {
          method: 'POST',
          headers: getAuthHeaders(),
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

        if (!appointmentTypeResponse.ok) {
          const contentType = appointmentTypeResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await appointmentTypeResponse.json();
            throw new Error(errorData.error || 'Failed to create appointment type');
          }
          throw new Error(`Failed to create appointment type (${appointmentTypeResponse.status})`);
        }
      }

      // Create booking configuration only if it doesn't exist
      if (!bookingConfig) {
        const provider = providers.find(p => p.id === providerId);
        const slug = `${provider.firstName}-${provider.lastName}-${providerId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const bookingConfigResponse = await fetch('/api/scheduling/booking-config', {
          method: 'POST',
          headers: getAuthHeaders(),
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

        if (!bookingConfigResponse.ok) {
          const contentType = bookingConfigResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await bookingConfigResponse.json();
            throw new Error(errorData.error || 'Failed to create booking configuration');
          }
          throw new Error(`Failed to create booking configuration (${bookingConfigResponse.status})`);
        }
      }

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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          allowPublicBooking: !bookingConfig.allow_public_booking
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update booking config');
        }
        throw new Error(`Failed to update booking config (${response.status})`);
      }
      await fetchProviderDetails(selectedProvider.id);
    } catch (err) {
      console.error('Error updating booking config:', err);
      alert('Error updating booking config: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          <p className={`mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Loading providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className={`border px-4 py-3 rounded ${
          theme === 'dark'
            ? 'bg-red-900/20 border-red-500/50 text-red-300'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <AlertCircle className="inline w-5 h-5 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Sidebar - Provider List */}
      <div className={`w-80 border-r overflow-y-auto ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Providers</h2>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{providers.length} total</p>
        </div>
        <div className="p-2">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider)}
              className={`w-full text-left p-4 rounded-lg mb-2 transition-all ${
                selectedProvider?.id === provider.id
                  ? theme === 'dark'
                    ? 'bg-cyan-900/30 border-2 border-cyan-500'
                    : 'bg-blue-50 border-2 border-blue-500'
                  : theme === 'dark'
                    ? 'bg-slate-700/50 border border-slate-600 hover:border-cyan-400'
                    : 'bg-white border border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  theme === 'dark' ? 'bg-cyan-600' : 'bg-blue-600'
                }`}>
                  {provider.firstName?.[0]}{provider.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Dr. {provider.firstName} {provider.lastName}
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    {provider.specialization || 'General Practice'}
                  </p>
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
            <div className={`rounded-lg shadow-sm p-6 mb-6 ${
              theme === 'dark' ? 'bg-slate-800' : 'bg-white'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold ${
                    theme === 'dark' ? 'bg-cyan-600' : 'bg-blue-600'
                  }`}>
                    {selectedProvider.firstName?.[0]}{selectedProvider.lastName?.[0]}
                  </div>
                  <div>
                    <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Dr. {selectedProvider.firstName} {selectedProvider.lastName}
                    </h1>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                      {selectedProvider.specialization || 'General Practice'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      {selectedProvider.email && (
                        <div className={`flex items-center gap-1 text-sm ${
                          theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                        }`}>
                          <Mail className="w-4 h-4" />
                          {selectedProvider.email}
                        </div>
                      )}
                      {selectedProvider.phone && (
                        <div className={`flex items-center gap-1 text-sm ${
                          theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                        }`}>
                          <Phone className="w-4 h-4" />
                          {selectedProvider.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className={`rounded-lg shadow-sm mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
              <div className={`border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="flex gap-4 px-6">
                  {[
                    { id: 'schedule', label: 'Schedule', icon: Calendar },
                    { id: 'booking', label: 'Public Booking', icon: Link2 },
                    { id: 'appointments', label: 'Appointment Types', icon: Clock }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? theme === 'dark'
                            ? 'border-cyan-500 text-cyan-400'
                            : 'border-blue-600 text-blue-600'
                          : theme === 'dark'
                            ? 'border-transparent text-slate-400 hover:text-slate-200'
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
                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Weekly Schedule
                      </h2>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowScheduleModal(true)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title="Manage Schedule"
                        >
                          <Settings className="w-5 h-5" />
                          <span>Manage Schedule</span>
                        </button>
                        {!scheduleMatchesClinicHours() && (
                          <button
                            onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            <Clock className="w-5 h-5" />
                            Set Clinic Hours
                          </button>
                        )}
                      </div>
                    </div>
                    {!scheduleMatchesClinicHours() && (
                      <div className={`border rounded-lg p-4 mb-6 ${
                        theme === 'dark'
                          ? 'bg-cyan-900/20 border-cyan-500/50'
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className={`text-sm ${theme === 'dark' ? 'text-cyan-300' : 'text-blue-800'}`}>
                          <strong>Clinic Working Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM
                        </p>
                        <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}`}>
                          Click "Set Clinic Hours" to automatically configure this provider's schedule to match clinic hours.
                        </p>
                      </div>
                    )}
                    <div className="text-center py-8">
                      <Calendar className={`w-16 h-16 mx-auto mb-4 ${
                        theme === 'dark' ? 'text-slate-600' : 'text-gray-400'
                      }`} />
                      <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                        Click "Manage Schedule" above to view and edit the detailed weekly schedule
                      </p>
                    </div>
                  </div>
                )}

                {/* Public Booking Tab */}
                {activeTab === 'booking' && (
                  <div>
                    <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Public Booking Configuration
                    </h2>
                    {bookingConfig ? (
                      <div className="space-y-6">
                        {/* Booking URL */}
                        <div className={`border rounded-lg p-6 ${
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-cyan-500/50'
                            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                        }`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-semibold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Public Booking Link</h3>
                            <button
                              onClick={togglePublicBooking}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                                bookingConfig.allow_public_booking
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : theme === 'dark'
                                    ? 'bg-slate-600 text-white hover:bg-slate-700'
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
                          <div className={`rounded-lg p-4 border ${
                            theme === 'dark'
                              ? 'bg-slate-800 border-slate-700'
                              : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <code className={`text-sm ${theme === 'dark' ? 'text-cyan-300' : 'text-gray-700'}`}>
                                {window.location.origin}/book/{bookingConfig.booking_url_slug}
                              </code>
                              <button
                                onClick={copyBookingUrl}
                                className={`flex items-center gap-2 px-3 py-1 text-sm rounded transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
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
                          <p className={`text-sm mt-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            Share this link with patients to allow them to book appointments online.
                          </p>
                        </div>

                        {/* Configuration Details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`border rounded-lg p-4 ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600'
                              : 'bg-white border-gray-200'
                          }`}>
                            <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              Booking Settings
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Slot Interval:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {bookingConfig.slot_interval_minutes} min
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Timezone:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {bookingConfig.timezone}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Max Concurrent:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {bookingConfig.max_concurrent_bookings}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={`border rounded-lg p-4 ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600'
                              : 'bg-white border-gray-200'
                          }`}>
                            <h4 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              Policies
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Cancellation:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {bookingConfig.allow_cancellation
                                    ? `${bookingConfig.cancellation_hours_before}h before`
                                    : 'Not allowed'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Rescheduling:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {bookingConfig.allow_rescheduling
                                    ? `${bookingConfig.reschedule_hours_before}h before`
                                    : 'Not allowed'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Reminders:</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
                        <Link2 className={`w-16 h-16 mx-auto mb-4 ${
                          theme === 'dark' ? 'text-slate-600' : 'text-gray-400'
                        }`} />
                        <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          No booking configuration found
                        </p>
                        <button
                          onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                          className={`px-6 py-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
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
                      <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Appointment Types
                      </h2>
                    </div>
                    {appointmentTypes.length > 0 ? (
                      <div className="grid gap-4">
                        {appointmentTypes.map(type => (
                          <div key={type.id} className={`border rounded-lg p-4 transition-shadow ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                              : 'bg-white border-gray-200 hover:shadow-md'
                          }`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div
                                  className="w-4 h-4 rounded-full mt-1"
                                  style={{ backgroundColor: type.color }}
                                ></div>
                                <div>
                                  <h3 className={`font-semibold text-lg ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>{type.name}</h3>
                                  {type.description && (
                                    <p className={`text-sm mt-1 ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                                    }`}>{type.description}</p>
                                  )}
                                  <div className="flex items-center gap-6 mt-3 text-sm">
                                    <div className={`flex items-center gap-1 ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                                    }`}>
                                      <Clock className="w-4 h-4" />
                                      <span>{type.duration_minutes} min</span>
                                    </div>
                                    {type.buffer_minutes > 0 && (
                                      <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
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
                                  ? 'bg-green-600/20 text-green-400 border border-green-500/50'
                                  : theme === 'dark'
                                    ? 'bg-slate-600 text-slate-300'
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
                        <Clock className={`w-16 h-16 mx-auto mb-4 ${
                          theme === 'dark' ? 'text-slate-600' : 'text-gray-400'
                        }`} />
                        <p className={`mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          No appointment types configured
                        </p>
                        <button
                          onClick={() => initializeScheduleWithClinicHours(selectedProvider.id)}
                          className={`px-6 py-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
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
          theme={theme}
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
