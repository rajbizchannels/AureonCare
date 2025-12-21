import React, { useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Calendar, FileText, Download, Filter, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ReportsView = ({
  theme,
  patients,
  appointments,
  claims,
  payments,
  addNotification,
  setCurrentModule
}) => {
  const [dateRange, setDateRange] = useState('30'); // Days
  const [selectedReport, setSelectedReport] = useState('overview');
  const [exportFormat, setExportFormat] = useState('pdf'); // pdf or xlsx

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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toISOString().split('T')[0];

    // Header
    doc.setFontSize(20);
    doc.text('MedFlow - ' + reportTypes.find(r => r.id === selectedReport)?.name, 14, 22);
    doc.setFontSize(10);
    doc.text('Generated: ' + new Date().toLocaleString(), 14, 30);
    doc.text('Date Range: ' + (dateRange === 'all' ? 'All Time' : `Last ${dateRange} Days`), 14, 36);

    // Summary Statistics
    doc.setFontSize(14);
    doc.text('Summary Statistics', 14, 50);
    doc.setFontSize(10);

    const summaryData = [
      ['Period Revenue', formatCurrency(periodRevenue)],
      ['Total Payments', formatCurrency(periodPayments)],
      ['Total Patients', totalPatients.toString()],
      ['Total Appointments', filteredAppointments.length.toString()],
      ['Claims Approval Rate', approvalRate + '%']
    ];

    doc.autoTable({
      startY: 55,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Report-specific tables
    let finalY = doc.lastAutoTable.finalY + 10;

    if (selectedReport === 'revenue' || selectedReport === 'overview') {
      doc.setFontSize(14);
      doc.text('Recent Claims', 14, finalY);

      const claimsData = filteredClaims.slice(0, 20).map(c => [
        c.claim_number || '',
        c.patient_name || '',
        formatDate(c.service_date),
        c.status || '',
        formatCurrency(c.amount || 0)
      ]);

      doc.autoTable({
        startY: finalY + 5,
        head: [['Claim #', 'Patient', 'Date', 'Status', 'Amount']],
        body: claimsData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      finalY = doc.lastAutoTable.finalY + 10;
    }

    if (selectedReport === 'appointments' || selectedReport === 'overview') {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(14);
      doc.text('Recent Appointments', 14, finalY);

      const appointmentsData = filteredAppointments.slice(0, 20).map(a => [
        a.patient_name || '',
        a.provider_name || '',
        formatDate(a.date || a.start_time),
        a.status || ''
      ]);

      doc.autoTable({
        startY: finalY + 5,
        head: [['Patient', 'Provider', 'Date', 'Status']],
        body: appointmentsData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });
    }

    // Save PDF
    doc.save(`medflow-report-${selectedReport}-${dateStr}.pdf`);
    addNotification('success', 'Report exported to PDF successfully');
  };

  const exportToXLSX = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['MedFlow Report', reportTypes.find(r => r.id === selectedReport)?.name],
      ['Generated', new Date().toLocaleString()],
      ['Date Range', dateRange === 'all' ? 'All Time' : `Last ${dateRange} Days`],
      [],
      ['Metric', 'Value'],
      ['Period Revenue', formatCurrency(periodRevenue)],
      ['Total Payments', formatCurrency(periodPayments)],
      ['Total Patients', totalPatients],
      ['Total Appointments', filteredAppointments.length],
      ['Claims Approval Rate', approvalRate + '%'],
      ['Claims Approved', claimsApproved],
      ['Claims Submitted', claimsSubmitted],
      ['Claims Pending', claimsPending]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Claims Sheet
    if (filteredClaims.length > 0) {
      const claimsData = filteredClaims.map(c => ({
        'Claim Number': c.claim_number || '',
        'Patient': c.patient_name || '',
        'Service Date': formatDate(c.service_date),
        'Status': c.status || '',
        'Amount': c.amount || 0,
        'Payer': c.payer || '',
        'Diagnosis': c.diagnosis || ''
      }));

      const claimsSheet = XLSX.utils.json_to_sheet(claimsData);
      XLSX.utils.book_append_sheet(workbook, claimsSheet, 'Claims');
    }

    // Payments Sheet
    if (filteredPayments.length > 0) {
      const paymentsData = filteredPayments.map(p => ({
        'Payment ID': p.id || '',
        'Patient': p.patient_name || '',
        'Payment Date': formatDate(p.payment_date),
        'Amount': p.amount || 0,
        'Payment Method': p.payment_method || '',
        'Status': p.status || ''
      }));

      const paymentsSheet = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'Payments');
    }

    // Appointments Sheet
    if (filteredAppointments.length > 0) {
      const appointmentsData = filteredAppointments.map(a => ({
        'Patient': a.patient_name || '',
        'Provider': a.provider_name || '',
        'Date': formatDate(a.date || a.start_time),
        'Time': a.time || '',
        'Type': a.type || '',
        'Status': a.status || '',
        'Reason': a.reason || ''
      }));

      const appointmentsSheet = XLSX.utils.json_to_sheet(appointmentsData);
      XLSX.utils.book_append_sheet(workbook, appointmentsSheet, 'Appointments');
    }

    // Save XLSX
    XLSX.writeFile(workbook, `medflow-report-${selectedReport}-${dateStr}.xlsx`);
    addNotification('success', 'Report exported to Excel successfully');
  };

  const exportReport = () => {
    if (exportFormat === 'pdf') {
      exportToPDF();
    } else if (exportFormat === 'xlsx') {
      exportToXLSX();
    }
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
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          >
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
          <button
            onClick={exportReport}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors ${theme === 'dark' ? 'text-white' : 'text-white'}`}
          >
            <Download className="w-4 h-4" />
            Export {exportFormat.toUpperCase()}
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
