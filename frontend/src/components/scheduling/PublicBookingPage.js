import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, User, Mail, Phone, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, LogIn } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';

import api from '../../api/apiService';
import { formatCurrency } from '../../utils/formatters';

/**
 * The page behind a provider's public booking link (/book/<slug>).
 *
 * Open to anyone with the link. A patient who signs in gets their details
 * filled in and the appointment tied to their existing record; everyone else
 * books as a guest.
 */
const PublicBookingPage = ({ providerSlug, patient = null, onSignIn }) => {
    const [step, setStep] = useState(1); // 1: Select Type, 2: Select Date/Time, 3: Enter Info, 4: Confirmation
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Provider and booking config
    const [provider, setProvider] = useState(null);
    const [appointmentTypes, setAppointmentTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);

    // Date and time selection
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Patient information
    const [patientInfo, setPatientInfo] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: '',
        reason: ''
    });

    const [bookedAppointment, setBookedAppointment] = useState(null);

    // A signed-in patient does not retype what the practice already holds.
    useEffect(() => {
        if (!patient) return;
        setPatientInfo(prev => ({
            ...prev,
            firstName: patient.first_name || patient.firstName || prev.firstName,
            lastName: patient.last_name || patient.lastName || prev.lastName,
            email: patient.email || prev.email,
            phone: patient.phone || prev.phone,
            dob: patient.date_of_birth || patient.dob || prev.dob,
        }));
    }, [patient]);

    const fetchProviderInfo = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getPublicBookingConfig(providerSlug);
            setProvider(data);
            setAppointmentTypes(await api.getPublicAppointmentTypes(data.provider_id));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [providerSlug]);

    const fetchAvailableDates = useCallback(async () => {
        try {
            const startDate = format(currentWeek, 'yyyy-MM-dd');
            const endDate = format(addWeeks(currentWeek, 2), 'yyyy-MM-dd');

            const dates = await api.getPublicAvailableDates(provider.provider_id, {
                startDate, endDate, appointmentTypeId: selectedType.id
            });
            setAvailableDates(dates.map(d => parseISO(d)));
        } catch (err) {
            console.error('Error fetching available dates:', err);
        }
    }, [currentWeek, provider, selectedType]);

    const fetchAvailableSlots = useCallback(async () => {
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const slots = await api.getPublicAvailableSlots(provider.provider_id, {
                date: dateStr, appointmentTypeId: selectedType.id
            });
            setAvailableSlots(slots);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedDate, provider, selectedType]);

    useEffect(() => {
        fetchProviderInfo();
    }, [fetchProviderInfo]);

    useEffect(() => {
        if (selectedType && provider) {
            fetchAvailableDates();
        }
    }, [selectedType, currentWeek, provider, fetchAvailableDates]);

    useEffect(() => {
        if (selectedDate && selectedType) {
            fetchAvailableSlots();
        }
    }, [selectedDate, selectedType, fetchAvailableSlots]);

    const handleBookAppointment = async () => {
        setLoading(true);
        setError(null);
        try {
            // Deliberately no patient id: /api/scheduling/book is public, so it
            // matches an existing record on email rather than trusting an id an
            // anonymous caller could supply.
            const data = await api.bookPublicAppointment({
                providerId: provider.provider_id,
                patientInfo: {
                    firstName: patientInfo.firstName,
                    lastName: patientInfo.lastName,
                    email: patientInfo.email,
                    phone: patientInfo.phone,
                    dob: patientInfo.dob || null
                },
                startTime: selectedSlot.startTime,
                appointmentTypeId: selectedType.id,
                customFormData: {
                    reason: patientInfo.reason
                }
            });

            setBookedAppointment(data.appointment);
            setSuccess(true);
            setStep(4);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderWeekDays = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = addDays(currentWeek, i);
            const isAvailable = availableDates.some(d => isSameDay(d, day));
            const isSelected = selectedDate && isSameDay(selectedDate, day);
            const isPast = day < new Date();

            days.push(
                <button
                    key={i}
                    onClick={() => isAvailable && !isPast && setSelectedDate(day)}
                    disabled={!isAvailable || isPast}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                        isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : isAvailable && !isPast
                            ? 'border-gray-200 hover:border-blue-300 bg-white'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                >
                    <div className="text-xs text-gray-500 mb-1">
                        {format(day, 'EEE')}
                    </div>
                    <div className={`text-2xl font-bold ${
                        isSelected
                            ? 'text-blue-600'
                            : isAvailable && !isPast
                            ? 'text-gray-900'
                            : 'text-gray-400'
                    }`}>
                        {format(day, 'd')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {format(day, 'MMM')}
                    </div>
                </button>
            );
        }
        return days;
    };

    if (loading && !provider) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Loading booking page...</p>
                </div>
            </div>
        );
    }

    if (error && !provider) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-center mb-2">Booking Unavailable</h2>
                    <p className="text-gray-600 text-center">{error}</p>
                </div>
            </div>
        );
    }

    if (success && step === 4) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold text-center mb-4">Appointment Confirmed!</h2>
                    <p className="text-gray-600 text-center mb-8">
                        Your appointment has been successfully booked. You will receive a confirmation email shortly.
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <h3 className="font-semibold text-lg mb-4">Appointment Details</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-gray-400 mt-1" />
                                <div>
                                    <div className="text-sm text-gray-600">Provider</div>
                                    <div className="font-medium">Dr. {provider.first_name} {provider.last_name}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                                <div>
                                    <div className="text-sm text-gray-600">Date & Time</div>
                                    <div className="font-medium">
                                        {format(parseISO(bookedAppointment.start_time), 'EEEE, MMMM d, yyyy')}
                                        {' at '}
                                        {format(parseISO(bookedAppointment.start_time), 'h:mm a')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 text-gray-400 mt-1" />
                                <div>
                                    <div className="text-sm text-gray-600">Duration</div>
                                    <div className="font-medium">{bookedAppointment.duration_minutes} minutes</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Book Another Appointment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            {provider.first_name[0]}{provider.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold text-gray-900">
                                Dr. {provider.first_name} {provider.last_name}
                            </h1>
                            <p className="text-gray-600">Book an appointment</p>
                        </div>

                        {patient ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex-shrink-0">
                                <CheckCircle className="w-4 h-4" />
                                Booking as {patient.first_name || patient.firstName}
                            </div>
                        ) : onSignIn ? (
                            <button
                                onClick={onSignIn}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium flex-shrink-0"
                            >
                                <LogIn className="w-4 h-4" />
                                Existing patient? Sign in
                            </button>
                        ) : null}
                    </div>

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center mt-6 gap-4">
                        {[
                            { num: 1, label: 'Select Type' },
                            { num: 2, label: 'Choose Time' },
                            { num: 3, label: 'Your Info' }
                        ].map((s, i) => (
                            <React.Fragment key={s.num}>
                                <div className={`flex items-center gap-2 ${
                                    step >= s.num ? 'text-blue-600' : 'text-gray-400'
                                }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                        step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200'
                                    }`}>
                                        {s.num}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                                </div>
                                {i < 2 && (
                                    <div className={`w-12 h-0.5 ${
                                        step > s.num ? 'bg-blue-600' : 'bg-gray-200'
                                    }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Step 1: Select Appointment Type */}
                {step === 1 && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold mb-4">Select Appointment Type</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {appointmentTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        setSelectedType(type);
                                        setStep(2);
                                    }}
                                    className="text-left p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-all"
                                >
                                    <h3 className="font-semibold text-lg mb-2">{type.name}</h3>
                                    {type.description && (
                                        <p className="text-gray-600 text-sm mb-3">{type.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {type.duration_minutes} min
                                        </span>
                                        {type.price > 0 && (
                                            <span>{formatCurrency(type.price, provider?.currency)}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Date and Time */}
                {step === 2 && selectedType && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => setStep(1)}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Back
                            </button>
                            <h2 className="text-xl font-bold">Select Date & Time</h2>
                            <div className="w-20"></div>
                        </div>

                        {/* Week Navigation */}
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                                className="p-2 hover:bg-gray-100 rounded"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div className="text-lg font-semibold">
                                {format(currentWeek, 'MMMM yyyy')}
                            </div>
                            <button
                                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                                className="p-2 hover:bg-gray-100 rounded"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Week Days */}
                        <div className="grid grid-cols-7 gap-2 mb-6">
                            {renderWeekDays()}
                        </div>

                        {/* Time Slots */}
                        {selectedDate && (
                            <div>
                                <h3 className="font-semibold mb-4">
                                    Available times for {format(selectedDate, 'EEEE, MMMM d')}
                                </h3>
                                {loading ? (
                                    <div className="text-center py-8">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : availableSlots.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">
                                        No available time slots for this date
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {availableSlots.map((slot, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    setSelectedSlot(slot);
                                                    setStep(3);
                                                }}
                                                className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center font-medium"
                                            >
                                                {format(parseISO(slot.startTime), 'h:mm a')}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Enter Patient Information */}
                {step === 3 && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => setStep(2)}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Back
                            </button>
                            <h2 className="text-xl font-bold">Your Information</h2>
                            <div className="w-20"></div>
                        </div>

                        <div className="max-w-2xl mx-auto">
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={patientInfo.firstName}
                                        onChange={(e) => setPatientInfo({ ...patientInfo, firstName: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={patientInfo.lastName}
                                        onChange={(e) => setPatientInfo({ ...patientInfo, lastName: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={patientInfo.email}
                                        onChange={(e) => setPatientInfo({ ...patientInfo, email: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone *
                                    </label>
                                    <input
                                        type="tel"
                                        value={patientInfo.phone}
                                        onChange={(e) => setPatientInfo({ ...patientInfo, phone: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Date of Birth (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={patientInfo.dob}
                                    onChange={(e) => setPatientInfo({ ...patientInfo, dob: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason for Visit (Optional)
                                </label>
                                <textarea
                                    value={patientInfo.reason}
                                    onChange={(e) => setPatientInfo({ ...patientInfo, reason: e.target.value })}
                                    rows="4"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Please describe the reason for your appointment..."
                                />
                            </div>

                            <button
                                onClick={handleBookAppointment}
                                disabled={loading || !patientInfo.firstName || !patientInfo.lastName || !patientInfo.email || !patientInfo.phone}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Booking...' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicBookingPage;
