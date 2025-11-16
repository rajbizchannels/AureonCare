import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Save, X } from 'lucide-react';

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

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
];

const DoctorAvailabilityManager = ({ providerId, theme = 'dark', onClose }) => {
    const [availability, setAvailability] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editedSchedules, setEditedSchedules] = useState([]);

    useEffect(() => {
        if (providerId) {
            fetchAvailability();
        }
    }, [providerId]);

    const fetchAvailability = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/scheduling/availability/${providerId}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch availability');
            const data = await response.json();
            setAvailability(data);
            setEditedSchedules(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addNewSchedule = () => {
        setEditedSchedules([
            ...editedSchedules,
            {
                providerId,
                dayOfWeek: 1,
                startTime: '09:00',
                endTime: '17:00',
                timezone: 'America/New_York',
                isAvailable: true,
                isNew: true
            }
        ]);
    };

    const removeSchedule = (index) => {
        const newSchedules = [...editedSchedules];
        newSchedules.splice(index, 1);
        setEditedSchedules(newSchedules);
    };

    const updateSchedule = (index, field, value) => {
        const newSchedules = [...editedSchedules];
        newSchedules[index][field] = value;
        setEditedSchedules(newSchedules);
    };

    const saveSchedules = async () => {
        setLoading(true);
        setError(null);
        try {
            const schedulesToSave = editedSchedules.map(s => ({
                dayOfWeek: s.dayOfWeek || s.day_of_week,
                startTime: s.startTime || s.start_time,
                endTime: s.endTime || s.end_time,
                timezone: s.timezone || 'America/New_York',
                isAvailable: s.isAvailable !== false
            }));

            const response = await fetch('/api/scheduling/availability/bulk', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    providerId,
                    schedules: schedulesToSave
                })
            });

            if (!response.ok) throw new Error('Failed to save availability');

            await fetchAvailability();
            setEditMode(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const cancelEdit = () => {
        setEditedSchedules([...availability]);
        setEditMode(false);
    };

    const groupedSchedules = editedSchedules.reduce((acc, schedule) => {
        const day = schedule.dayOfWeek || schedule.day_of_week;
        if (!acc[day]) acc[day] = [];
        acc[day].push(schedule);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden ${
                theme === 'dark' ? 'bg-slate-800' : 'bg-white'
            }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${
                    theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
                }`}>
                    <div className="flex items-center gap-2">
                        <Calendar className={`w-6 h-6 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                            Manage Availability
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className={theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {error && (
                        <div className={`mb-4 p-3 border rounded ${
                            theme === 'dark'
                                ? 'bg-red-900/20 border-red-500/50 text-red-300'
                                : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                            {error}
                        </div>
                    )}

                    {loading && !editMode ? (
                        <div className="text-center py-8">
                            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${
                                theme === 'dark' ? 'border-cyan-500' : 'border-blue-600'
                            }`}></div>
                            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                                Loading availability...
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {DAYS_OF_WEEK.map(day => (
                                <div key={day.value} className={`border rounded-lg p-4 ${
                                    theme === 'dark' ? 'border-slate-700 bg-slate-700/30' : 'border-gray-200'
                                }`}>
                                    <h3 className={`font-semibold text-lg mb-3 ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>{day.label}</h3>
                                    {groupedSchedules[day.value]?.length > 0 ? (
                                        <div className="space-y-2">
                                            {groupedSchedules[day.value].map((schedule, index) => (
                                                <div key={index} className="flex items-center gap-3">
                                                    {editMode ? (
                                                        <>
                                                            <Clock className={`w-5 h-5 ${
                                                                theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                                                            }`} />
                                                            <input
                                                                type="time"
                                                                value={schedule.startTime || schedule.start_time}
                                                                onChange={(e) => {
                                                                    const globalIndex = editedSchedules.findIndex(
                                                                        s => (s.dayOfWeek || s.day_of_week) === day.value &&
                                                                        s === schedule
                                                                    );
                                                                    updateSchedule(globalIndex, 'startTime', e.target.value);
                                                                }}
                                                                className={`border rounded px-3 py-2 ${
                                                                    theme === 'dark'
                                                                        ? 'bg-slate-700 border-slate-600 text-white'
                                                                        : 'bg-white border-gray-300 text-gray-900'
                                                                }`}
                                                            />
                                                            <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>to</span>
                                                            <input
                                                                type="time"
                                                                value={schedule.endTime || schedule.end_time}
                                                                onChange={(e) => {
                                                                    const globalIndex = editedSchedules.findIndex(
                                                                        s => (s.dayOfWeek || s.day_of_week) === day.value &&
                                                                        s === schedule
                                                                    );
                                                                    updateSchedule(globalIndex, 'endTime', e.target.value);
                                                                }}
                                                                className={`border rounded px-3 py-2 ${
                                                                    theme === 'dark'
                                                                        ? 'bg-slate-700 border-slate-600 text-white'
                                                                        : 'bg-white border-gray-300 text-gray-900'
                                                                }`}
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const globalIndex = editedSchedules.findIndex(
                                                                        s => (s.dayOfWeek || s.day_of_week) === day.value &&
                                                                        s === schedule
                                                                    );
                                                                    removeSchedule(globalIndex);
                                                                }}
                                                                className="text-red-500 hover:text-red-600"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className={`w-5 h-5 ${
                                                                theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                                                            }`} />
                                                            <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>
                                                                {schedule.start_time || schedule.startTime} -{' '}
                                                                {schedule.end_time || schedule.endTime}
                                                            </span>
                                                            <span className={`px-2 py-1 rounded text-xs ${
                                                                schedule.is_available !== false
                                                                    ? 'bg-green-600/20 text-green-400 border border-green-500/50'
                                                                    : theme === 'dark'
                                                                        ? 'bg-slate-600 text-slate-300'
                                                                        : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {schedule.is_available !== false ? 'Available' : 'Blocked'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                                            No availability set
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-6 border-t ${
                    theme === 'dark'
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-gray-50 border-gray-200'
                }`}>
                    <div>
                        {editMode && (
                            <button
                                onClick={addNewSchedule}
                                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                                    theme === 'dark'
                                        ? 'text-cyan-400 hover:bg-slate-700'
                                        : 'text-blue-600 hover:bg-blue-50'
                                }`}
                            >
                                <Plus className="w-5 h-5" />
                                Add Time Slot
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {editMode ? (
                            <>
                                <button
                                    onClick={cancelEdit}
                                    className={`px-6 py-2 border rounded transition-colors ${
                                        theme === 'dark'
                                            ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveSchedules}
                                    disabled={loading}
                                    className={`flex items-center gap-2 px-6 py-2 rounded disabled:opacity-50 transition-colors ${
                                        theme === 'dark'
                                            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                >
                                    <Save className="w-5 h-5" />
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditMode(true)}
                                className={`px-6 py-2 rounded transition-colors ${
                                    theme === 'dark'
                                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                Edit Schedule
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorAvailabilityManager;
