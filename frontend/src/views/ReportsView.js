import React, { useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Calendar, FileText, Download, Filter, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

const ReportsView = ({
  theme,
  patients,
  appointments,
  claims,
  payments,
  addNotification,
  setCurrentModule,
  t
}) => {
  const [dateRange, setDateRange] = useState('30'); // Days
  const [selectedReport, setSelectedReport] = useState('overview');

  // Calculate date range
  const getFilteredData = (data, dateField = 'created_at') => {
    if (!dateRange || dateRange === 'all') return data;

    const days = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return data.filter(item => {
      const itemDate = new Date(item[dateField] || item.date || item.service_date);
      return itemDate >= cutoffDate;
    });
  };

  // Revenue Analytics
  const totalRevenue = claims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const filteredClaims = getFilteredData(claims, 'service_date');
  const periodRevenue = filteredClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const totalPayments = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const filteredPayments = getFilteredData(payments, 'payment_date');
  const periodPayments = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const claimsApproved = filteredClaims.filter(c => c.status === 'Approved' || c.status === 'Paid').length;
  const claimsSubmitted = filteredClaims.filter(c => c.status === 'Submitted').length;
  const claimsPending = filteredClaims.filter(c => c.status === 'pending').length;

  const approvalRate = filteredClaims.length > 0
    ? Math.round((claimsApproved / filteredClaims.length) * 100)
    : 0;

  // Patient Analytics
  const totalPatients = patients.length;
  const filteredAppointments = getFilteredData(appointments, 'date');
  const avgAppointmentsPerDay = filteredAppointments.length / (parseInt(dateRange) || 30);

  const appointmentsByStatus = {
    confirmed: filteredAppointments.filter(a => a.status === 'Confirmed').length,
    pending: filteredAppointments.filter(a => a.status === 'Pending').length,
    completed: filteredAppointments.filter(a => a.status === 'Completed').length,
    cancelled: filteredAppointments.filter(a => a.status === 'Cancelled').length
  };

  // Payment Methods Distribution
  const paymentMethodStats = payments.reduce((acc, p) => {
    const method = p.payment_method || 'Unknown';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  // Top Payers
  const payerStats = {};
  claims.forEach(c => {
    const payer = c.payer || 'Unknown';
    payerStats[payer] = (payerStats[payer] || 0) + (parseFloat(c.amount) || 0);
  });
  const topPayers = Object.entries(payerStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const exportReport = () => {
    const reportData = {
      reportType: selectedReport,
      dateRange: dateRange,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue,
        periodRevenue,
        totalPayments,
        periodPayments,
        totalPatients,
        totalAppointments: filteredAppointments.length,
        approvalRate
      },
      claims: filteredClaims,
      payments: filteredPayments,
      appointments: filteredAppointments
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medflow-report-${selectedReport}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addNotification('success', 'Report exported successfully');
  };

  const reportTypes = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'revenue', name: 'Revenue Analysis', icon: DollarSign },
    { id: 'patients', name: 'Patient Analytics', icon: Users },
    { id: 'appointments', name: 'Appointment Trends', icon: Calendar }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentModule && setCurrentModule('dashboard')}
            className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Reports & Analytics
          </h2>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="365">Last Year</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={exportReport}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-white'}`}
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportTypes.map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setSelectedReport(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedReport === type.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : theme === 'dark'
                  ? 'border-slate-700 hover:border-slate-600'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${selectedReport === type.id ? 'text-blue-400' : theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {type.name}
              </p>
            </button>
          );
        })}
      </div>

      {/* Overview Report */}
      {selectedReport === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Period Revenue
                </p>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(periodRevenue)}
              </p>
              <p className="text-sm text-green-400 mt-1">
                {filteredClaims.length} claims
              </p>
            </div>

            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Payments Received
                </p>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(periodPayments)}
              </p>
              <p className="text-sm text-blue-400 mt-1">
                {filteredPayments.length} payments
              </p>
            </div>

            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Approval Rate
                </p>
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {approvalRate}%
              </p>
              <p className="text-sm text-yellow-400 mt-1">
                {claimsApproved} approved
              </p>
            </div>

            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Appointments
                </p>
                <Calendar className="w-5 h-5 text-purple-400" />
              </div>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {filteredAppointments.length}
              </p>
              <p className="text-sm text-purple-400 mt-1">
                {avgAppointmentsPerDay.toFixed(1)} per day
              </p>
            </div>
          </div>

          {/* Claims Status Distribution */}
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Claims Status Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Approved
                </p>
                <p className={`text-2xl font-bold text-green-400`}>{claimsApproved}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Submitted
                </p>
                <p className={`text-2xl font-bold text-blue-400`}>{claimsSubmitted}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Pending
                </p>
                <p className={`text-2xl font-bold text-yellow-400`}>{claimsPending}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Total
                </p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {filteredClaims.length}
                </p>
              </div>
            </div>
          </div>

          {/* Appointment Status */}
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Appointment Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Confirmed
                </p>
                <p className={`text-2xl font-bold text-green-400`}>{appointmentsByStatus.confirmed}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Pending
                </p>
                <p className={`text-2xl font-bold text-yellow-400`}>{appointmentsByStatus.pending}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Completed
                </p>
                <p className={`text-2xl font-bold text-blue-400`}>{appointmentsByStatus.completed}</p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Cancelled
                </p>
                <p className={`text-2xl font-bold text-red-400`}>{appointmentsByStatus.cancelled}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Report */}
      {selectedReport === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Summary */}
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Revenue Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Total Claims:</span>
                  <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(periodRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Payments Received:</span>
                  <span className="font-semibold text-green-400">
                    {formatCurrency(periodPayments)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-700">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>Outstanding:</span>
                  <span className="font-semibold text-yellow-400">
                    {formatCurrency(periodRevenue - periodPayments)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Payers */}
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Top Insurance Payers
              </h3>
              <div className="space-y-3">
                {topPayers.map(([payer, amount], idx) => (
                  <div key={payer} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                        idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{payer}</span>
                    </div>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Payment Methods Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(paymentMethodStats).map(([method, count]) => (
                <div key={method} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-gray-100'}`}>
                  <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} capitalize`}>
                    {method.replace('_', ' ')}
                  </p>
                  <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {count}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Analytics */}
      {selectedReport === 'patients' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Total Patients
              </p>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalPatients}
              </p>
            </div>
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Avg Appointments/Patient
              </p>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalPatients > 0 ? (appointments.length / totalPatients).toFixed(1) : 0}
              </p>
            </div>
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Avg Revenue/Patient
              </p>
              <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalPatients > 0 ? formatCurrency(totalRevenue / totalPatients) : '$0'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Trends */}
      {selectedReport === 'appointments' && (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Appointment Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Total Scheduled
                </p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {filteredAppointments.length}
                </p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Avg Per Day
                </p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {avgAppointmentsPerDay.toFixed(1)}
                </p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Completion Rate
                </p>
                <p className={`text-3xl font-bold text-green-400`}>
                  {filteredAppointments.length > 0
                    ? Math.round((appointmentsByStatus.completed / filteredAppointments.length) * 100)
                    : 0}%
                </p>
              </div>
              <div>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  No-Show Rate
                </p>
                <p className={`text-3xl font-bold text-red-400`}>
                  {filteredAppointments.length > 0
                    ? Math.round((appointmentsByStatus.cancelled / filteredAppointments.length) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
