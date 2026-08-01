import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, TrendingUp, DollarSign, Users, Calendar, FileText,
  Download, Filter, ArrowLeft, ChevronRight, ChevronDown, X,
  RefreshCw, Eye, Settings2, PlusCircle, Layers, Shield,
  Activity, Clock, AlertTriangle, CheckCircle, XCircle,
  PieChart, LineChart, BarChart2, Grid, Search, ChevronUp,
  Edit3, Trash2, Save, Play,
  BookOpen, Scale, Building2, TrendingDown,
  Package, Truck, ShoppingCart, Boxes, Tag
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAudit } from '../hooks/useAudit';

// ─────────────────────────────────────────────────────────────
// SVG CHART COMPONENTS
// ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
];

const BarChartSVG = ({ data = [], width = 500, height = 220, theme, onBarClick, valueFormatter }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  const padL = 55, padR = 10, padT = 20, padB = 45;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const barW = Math.max(6, chartW / data.length - 8);
  const fmt = valueFormatter || (v => v.toLocaleString());

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* Y axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + chartH * (1 - frac);
        const val = Math.round(max * frac);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y}
              stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10"
              fill={theme === 'dark' ? '#64748b' : '#94a3b8'}>{fmt(val)}</text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / max) * chartH);
        const x = padL + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
        const y = padT + chartH - barH;
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <g key={i} style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            onClick={() => onBarClick && onBarClick(d)}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" opacity="0.9" />
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="3" opacity="0"
              style={{ filter: 'brightness(1.2)' }} className="hover:opacity-30" />
            <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="9"
              fill={theme === 'dark' ? '#94a3b8' : '#64748b'}
              transform={data.length > 10 ? `rotate(-35 ${x + barW / 2} ${padT + chartH + 14})` : ''}>
              {String(d.label || '').length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const LineChartSVG = ({ data = [], width = 500, height = 220, theme, onPointClick, valueFormatter }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  const min = 0;
  const padL = 55, padR = 15, padT = 20, padB = 45;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const fmt = valueFormatter || (v => v.toLocaleString());

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - ((d.value - min) / (max - min)) * chartH,
    ...d
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + chartH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y}
              stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10"
              fill={theme === 'dark' ? '#64748b' : '#94a3b8'}>{fmt(Math.round(max * frac))}</text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i} style={{ cursor: onPointClick ? 'pointer' : 'default' }}
          onClick={() => onPointClick && onPointClick(data[i])}>
          <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke={theme === 'dark' ? '#1e293b' : '#fff'} strokeWidth="2" />
          {data.length <= 12 && (
            <text x={p.x} y={padT + chartH + 14} textAnchor="middle" fontSize="9"
              fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>
              {String(p.label || '').slice(0, 8)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

const PieChartSVG = ({ data = [], width = 260, height = 220, theme, onSliceClick }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const cx = 110, cy = height / 2, r = Math.min(cx, cy) - 20;
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac = (d.value || 0) / total;
    const start = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    const end = cumAngle;
    const lx = cx + r * Math.cos((start + end) / 2);
    const ly = cy + r * Math.sin((start + end) / 2);
    return { ...d, start, end, frac, lx, ly, color: d.color || CHART_COLORS[i % CHART_COLORS.length] };
  });

  const arc = (x, y, radius, startAngle, endAngle) => {
    const x1 = x + radius * Math.cos(startAngle);
    const y1 = y + radius * Math.sin(startAngle);
    const x2 = x + radius * Math.cos(endAngle);
    const y2 = y + radius * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x} ${y} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {slices.map((s, i) => (
        <g key={i} style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
          onClick={() => onSliceClick && onSliceClick(s)}>
          <path d={arc(cx, cy, r, s.start, s.end)} fill={s.color} opacity="0.9" />
        </g>
      ))}
      {/* Legend */}
      {data.slice(0, 8).map((d, i) => (
        <g key={i} transform={`translate(${cx * 2 + 5}, ${20 + i * 22})`}>
          <rect width="10" height="10" fill={CHART_COLORS[i % CHART_COLORS.length]} rx="2" />
          <text x="14" y="9" fontSize="10" fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>
            {String(d.label || '').slice(0, 14)} ({Math.round(d.frac * 100)}%)
          </text>
        </g>
      ))}
    </svg>
  );
};

const DonutChartSVG = ({ data = [], width = 260, height = 220, theme, onSliceClick }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const cx = 100, cy = height / 2, r = Math.min(cx, cy) - 15, innerR = r * 0.55;
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac = (d.value || 0) / total;
    const start = cumAngle;
    cumAngle += frac * 2 * Math.PI;
    return { ...d, start, end: cumAngle, frac, color: d.color || CHART_COLORS[i % CHART_COLORS.length] };
  });

  const donutArc = (x, y, outerR, innerR, startAngle, endAngle) => {
    const cos1 = Math.cos(startAngle), sin1 = Math.sin(startAngle);
    const cos2 = Math.cos(endAngle), sin2 = Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      `M ${x + outerR * cos1} ${y + outerR * sin1}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${x + outerR * cos2} ${y + outerR * sin2}`,
      `L ${x + innerR * cos2} ${y + innerR * sin2}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${x + innerR * cos1} ${y + innerR * sin1}`,
      'Z'
    ].join(' ');
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {slices.map((s, i) => (
        <g key={i} style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
          onClick={() => onSliceClick && onSliceClick(s)}>
          <path d={donutArc(cx, cy, r, innerR, s.start, s.end)} fill={s.color} opacity="0.9" />
        </g>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="bold"
        fill={theme === 'dark' ? '#f1f5f9' : '#1e293b'}>{total.toLocaleString()}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10"
        fill={theme === 'dark' ? '#64748b' : '#94a3b8'}>Total</text>
      {data.slice(0, 8).map((d, i) => (
        <g key={i} transform={`translate(${cx * 2 + 5}, ${20 + i * 22})`}>
          <rect width="10" height="10" fill={CHART_COLORS[i % CHART_COLORS.length]} rx="2" />
          <text x="14" y="9" fontSize="10" fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>
            {String(d.label || '').slice(0, 14)} ({d.value?.toLocaleString()})
          </text>
        </g>
      ))}
    </svg>
  );
};

const AreaChartSVG = ({ data = [], width = 500, height = 220, theme, onPointClick, valueFormatter, color = '#10b981' }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  const padL = 55, padR = 15, padT = 20, padB = 45;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const fmt = valueFormatter || (v => v.toLocaleString());

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.value / max) * chartH,
    ...d
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;
  const gradId = `ag_${color.replace('#', '')}`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = padT + chartH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y}
              stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10"
              fill={theme === 'dark' ? '#64748b' : '#94a3b8'}>{fmt(Math.round(max * frac))}</text>
          </g>
        );
      })}
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i} style={{ cursor: onPointClick ? 'pointer' : 'default' }}
          onClick={() => onPointClick && onPointClick(data[i])}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} stroke={theme === 'dark' ? '#1e293b' : '#fff'} strokeWidth="2" />
          {data.length <= 12 && (
            <text x={p.x} y={padT + chartH + 14} textAnchor="middle" fontSize="9"
              fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>
              {String(p.label || '').slice(0, 8)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

const EmptyChart = ({ height = 200, theme }) => (
  <div className="flex items-center justify-center" style={{ height }}>
    <div className="text-center">
      <BarChart2 className={`w-10 h-10 mx-auto mb-2 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-300'}`} />
      <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>No data available</p>
    </div>
  </div>
);

const HorizontalBarChartSVG = ({ data = [], width = 500, height = 220, theme, onBarClick, valueFormatter }) => {
  if (!data.length) return <EmptyChart height={height} theme={theme} />;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  const items = data.slice(0, 8);
  const padL = 120, padR = 60, padT = 10, padB = 10;
  const chartW = width - padL - padR;
  const rowH = (height - padT - padB) / items.length;
  const barH = Math.max(8, rowH - 12);
  const fmt = valueFormatter || (v => v.toLocaleString());

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {items.map((d, i) => {
        const bw = ((d.value || 0) / max) * chartW;
        const y = padT + i * rowH + (rowH - barH) / 2;
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
        return (
          <g key={i} style={{ cursor: onBarClick ? 'pointer' : 'default' }}
            onClick={() => onBarClick && onBarClick(d)}>
            <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="10"
              fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>
              {String(d.label || '').slice(0, 14)}
            </text>
            <rect x={padL} y={y} width={Math.max(2, bw)} height={barH} fill={color} rx="3" opacity="0.9" />
            <text x={padL + bw + 6} y={y + barH / 2 + 4} fontSize="10"
              fill={theme === 'dark' ? '#94a3b8' : '#64748b'}>{fmt(d.value)}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Render a chart based on type
const ReportChart = ({ type = 'bar', data = [], theme, onDataClick, valueFormatter, color, title }) => {
  const containerRef = useRef(null);
  const charts = {
    bar: <BarChartSVG data={data} theme={theme} onBarClick={onDataClick} valueFormatter={valueFormatter} />,
    line: <LineChartSVG data={data} theme={theme} onPointClick={onDataClick} valueFormatter={valueFormatter} />,
    area: <AreaChartSVG data={data} theme={theme} onPointClick={onDataClick} valueFormatter={valueFormatter} color={color} />,
    pie: <PieChartSVG data={data} theme={theme} onSliceClick={onDataClick} />,
    donut: <DonutChartSVG data={data} theme={theme} onSliceClick={onDataClick} />,
    hbar: <HorizontalBarChartSVG data={data} theme={theme} onBarClick={onDataClick} valueFormatter={valueFormatter} />,
  };
  return (
    <div ref={containerRef} className="w-full">
      {title && <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>}
      {charts[type] || charts.bar}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// REPORT CATEGORIES CONFIG
// ─────────────────────────────────────────────────────────────

export const REPORT_CATEGORIES = [
  {
    id: 'operational',
    name: 'Operational',
    icon: Activity,
    color: 'blue',
    bgDark: 'bg-blue-500/10',
    borderActive: 'border-blue-500',
    textActive: 'text-blue-400',
    reports: [
      { id: 'daily-appointments', name: 'Daily Appointment Report', apiMethod: 'getReportDailyAppointments', icon: Calendar, defaultChart: 'bar', description: 'Daily appointment volumes and statuses' },
      { id: 'provider-utilization', name: 'Provider Utilization', apiMethod: 'getReportProviderUtilization', icon: Users, defaultChart: 'hbar', description: 'Appointment load and completion rates by provider' },
      { id: 'patient-visits', name: 'Patient Visit Report', apiMethod: 'getReportPatientVisits', icon: Eye, defaultChart: 'bar', description: 'Patient visit frequency and patterns' },
      { id: 'no-shows', name: 'No-Show Report', apiMethod: 'getReportNoShows', icon: AlertTriangle, defaultChart: 'area', description: 'No-show rates and trends over time' },
      { id: 'wait-times', name: 'Wait Time Report', apiMethod: 'getReportWaitTimes', icon: Clock, defaultChart: 'hbar', description: 'Average wait times by provider' },
    ]
  },
  {
    id: 'financial',
    name: 'Financial',
    icon: DollarSign,
    color: 'green',
    bgDark: 'bg-green-500/10',
    borderActive: 'border-green-500',
    textActive: 'text-green-400',
    reports: [
      { id: 'revenue', name: 'Revenue Report', apiMethod: 'getReportRevenue', icon: TrendingUp, defaultChart: 'area', description: 'Daily revenue trends and breakdowns' },
      { id: 'billing-summary', name: 'Billing Summary', apiMethod: 'getReportBillingSummary', icon: FileText, defaultChart: 'donut', description: 'Claims by status and payer' },
      { id: 'outstanding-payments', name: 'Outstanding Payments', apiMethod: 'getReportOutstandingPayments', icon: AlertTriangle, defaultChart: 'hbar', description: 'Unpaid claims by payer and aging' },
      { id: 'payment-collection', name: 'Payment Collection', apiMethod: 'getReportPaymentCollection', icon: DollarSign, defaultChart: 'bar', description: 'Payment receipts and methods' },
      { id: 'refunds', name: 'Refund Report', apiMethod: 'getReportRefunds', icon: RefreshCw, defaultChart: 'bar', description: 'Refund history and totals' },
    ]
  },
  {
    id: 'insurance',
    name: 'Insurance & Claims',
    icon: Shield,
    color: 'purple',
    bgDark: 'bg-purple-500/10',
    borderActive: 'border-purple-500',
    textActive: 'text-purple-400',
    reports: [
      { id: 'claim-status', name: 'Claim Status Report', apiMethod: 'getReportClaimStatus', icon: CheckCircle, defaultChart: 'donut', description: 'Distribution of claims by status' },
      { id: 'claim-rejections', name: 'Claim Rejection Report', apiMethod: 'getReportClaimRejections', icon: XCircle, defaultChart: 'hbar', description: 'Rejections and denials by payer' },
      { id: 'denial-analysis', name: 'Denial Analysis', apiMethod: 'getReportDenialAnalysis', icon: BarChart2, defaultChart: 'hbar', description: 'Denial reasons and patterns' },
      { id: 'payer-performance', name: 'Payer Performance', apiMethod: 'getReportPayerPerformance', icon: TrendingUp, defaultChart: 'bar', description: 'Approval rates and amounts by payer' },
    ]
  },
  {
    id: 'patient',
    name: 'Patient',
    icon: Users,
    color: 'teal',
    bgDark: 'bg-teal-500/10',
    borderActive: 'border-teal-500',
    textActive: 'text-teal-400',
    reports: [
      { id: 'demographics', name: 'Patient Demographics', apiMethod: 'getReportPatientDemographics', icon: PieChart, defaultChart: 'donut', description: 'Patient population by gender, age, and location' },
      { id: 'visit-history', name: 'Patient Visit History', apiMethod: 'getReportPatientVisitHistory', icon: Clock, defaultChart: 'bar', description: 'Patient visit counts and activity' },
      { id: 'retention', name: 'Patient Retention', apiMethod: 'getReportPatientRetention', icon: TrendingUp, defaultChart: 'area', description: 'Monthly active patients and retention rates' },
      { id: 'satisfaction', name: 'Patient Satisfaction', apiMethod: 'getReportPatientSatisfaction', icon: CheckCircle, defaultChart: 'hbar', description: 'Completion rates and satisfaction proxies' },
    ]
  },
  {
    id: 'provider',
    name: 'Provider',
    icon: BarChart3,
    color: 'orange',
    bgDark: 'bg-orange-500/10',
    borderActive: 'border-orange-500',
    textActive: 'text-orange-400',
    reports: [
      { id: 'productivity', name: 'Doctor Productivity', apiMethod: 'getReportProviderProductivity', icon: Activity, defaultChart: 'hbar', description: 'Appointments and revenue per provider' },
      { id: 'appointment-volume', name: 'Appointment Volume by Provider', apiMethod: 'getReportAppointmentVolumeByProvider', icon: BarChart2, defaultChart: 'bar', description: 'Weekly appointment volumes by provider' },
      { id: 'revenue', name: 'Revenue by Provider', apiMethod: 'getReportRevenueByProvider', icon: DollarSign, defaultChart: 'hbar', description: 'Billed and collected revenue per provider' },
      { id: 'telehealth-usage', name: 'Telehealth Usage', apiMethod: 'getReportTelehealthUsage', icon: LineChart, defaultChart: 'bar', description: 'Telehealth session counts and durations' },
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance',
    icon: Shield,
    color: 'red',
    bgDark: 'bg-red-500/10',
    borderActive: 'border-red-500',
    textActive: 'text-red-400',
    reports: [
      { id: 'audit-logs', name: 'Audit Logs', apiMethod: 'getReportAuditLogs', icon: FileText, defaultChart: 'bar', description: 'System action audit trail' },
      { id: 'access-logs', name: 'Access Logs', apiMethod: 'getReportAccessLogs', icon: Eye, defaultChart: 'hbar', description: 'User access activity log' },
      { id: 'hipaa', name: 'HIPAA Compliance Report', apiMethod: 'getReportHIPAACompliance', icon: Shield, defaultChart: 'donut', description: 'PHI access tracking and user roles' },
      { id: 'data-access-history', name: 'Data Access History', apiMethod: 'getReportDataAccessHistory', icon: Clock, defaultChart: 'bar', description: 'Detailed data access records' },
    ]
  },
  {
    id: 'accounts',
    name: 'Accounts',
    icon: BookOpen,
    color: 'emerald',
    bgDark: 'bg-emerald-500/10',
    borderActive: 'border-emerald-500',
    textActive: 'text-emerald-400',
    isAccountsModule: true,
    reports: [
      { id: 'acct-trial-balance',    name: 'Trial Balance',     apiMethod: 'getTrialBalance',      icon: Scale,        defaultChart: 'bar',  description: 'Debit/credit balances for all GL accounts' },
      { id: 'acct-income-statement', name: 'Income Statement',  apiMethod: 'getIncomeStatement',   icon: TrendingUp,   defaultChart: 'bar',  description: 'Revenue vs expenses for the period' },
      { id: 'acct-balance-sheet',    name: 'Balance Sheet',     apiMethod: 'getBalanceSheet',      icon: Building2,    defaultChart: 'donut',description: 'Assets, liabilities, and equity snapshot' },
      { id: 'acct-ar-aging',         name: 'AR Aging Report',   apiMethod: 'getARAgingReport',     icon: TrendingDown, defaultChart: 'bar',  description: 'Accounts receivable by aging bucket' },
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Package,
    color: 'amber',
    bgDark: 'bg-amber-500/10',
    borderActive: 'border-amber-500',
    textActive: 'text-amber-400',
    isInventoryModule: true,
    reports: [
      { id: 'inv-stock-levels',      name: 'Stock Levels',       apiMethod: 'getInventoryStockLevels',    icon: Boxes,        defaultChart: 'bar',  description: 'Current quantity on hand for all items' },
      { id: 'inv-low-stock',         name: 'Low Stock Alert',    apiMethod: 'getInventoryLowStock',       icon: AlertTriangle, defaultChart: 'bar', description: 'Items at or below reorder level' },
      { id: 'inv-valuation',         name: 'Inventory Valuation',apiMethod: 'getInventoryValuation',      icon: DollarSign,   defaultChart: 'donut',description: 'Total inventory value by category' },
      { id: 'inv-movement-history',  name: 'Movement History',   apiMethod: 'getInventoryMovementHistory',icon: TrendingUp,   defaultChart: 'bar',  description: 'Stock movements grouped by type' },
      { id: 'inv-expiry-alerts',     name: 'Expiry Alerts',      apiMethod: 'getInventoryExpiryAlerts',   icon: Clock,        defaultChart: 'bar',  description: 'Items expiring within 90 days' },
    ]
  }
];

// ─────────────────────────────────────────────────────────────
// HELPER UI COMPONENTS
// ─────────────────────────────────────────────────────────────

const Card = ({ children, theme, className = '' }) => (
  <div className={`rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'} ${className}`}>
    {children}
  </div>
);

const KPICard = ({ label, value, sub, icon: Icon, color = 'blue', theme }) => {
  const colorMap = {
    blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400',
    red: 'text-red-400', purple: 'text-purple-400', teal: 'text-teal-400', orange: 'text-orange-400'
  };
  return (
    <Card theme={theme} className="p-5">
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{label}</p>
        {Icon && <Icon className={`w-5 h-5 ${colorMap[color] || 'text-blue-400'}`} />}
      </div>
      <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${colorMap[color] || 'text-blue-400'}`}>{sub}</p>}
    </Card>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    Completed: 'bg-green-500/20 text-green-400',
    Confirmed: 'bg-blue-500/20 text-blue-400',
    Pending: 'bg-yellow-500/20 text-yellow-400',
    Cancelled: 'bg-red-500/20 text-red-400',
    'No-Show': 'bg-orange-500/20 text-orange-400',
    Approved: 'bg-green-500/20 text-green-400',
    Paid: 'bg-green-500/20 text-green-400',
    Denied: 'bg-red-500/20 text-red-400',
    Rejected: 'bg-red-500/20 text-red-400',
    Submitted: 'bg-blue-500/20 text-blue-400',
    Refunded: 'bg-purple-500/20 text-purple-400',
    Active: 'bg-green-500/20 text-green-400',
    'At Risk': 'bg-yellow-500/20 text-yellow-400',
    Lapsed: 'bg-red-500/20 text-red-400',
  };
  const cls = map[status] || 'bg-gray-500/20 text-gray-400';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
};

const Spinner = ({ theme }) => (
  <div className="flex items-center justify-center py-16">
    <RefreshCw className={`w-8 h-8 animate-spin ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
  </div>
);

const LoadError = ({ onRetry, theme }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <AlertTriangle className="w-10 h-10 text-red-400" />
    <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>Failed to load report data</p>
    <button onClick={onRetry} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">Retry</button>
  </div>
);


// ─────────────────────────────────────────────────────────────
// DRILLDOWN MODAL
// ─────────────────────────────────────────────────────────────

const DrillDownModal = ({ record, onClose, theme }) => {
  if (!record) return null;
  const entries = Object.entries(record).filter(([k]) => !['__typename'].includes(k));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className={`flex items-center justify-between p-5 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Record Details</h3>
          <button onClick={onClose} className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-3">
              <span className={`text-xs font-medium w-36 shrink-0 pt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
              <span className={`text-sm break-all ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>
                {value === null || value === undefined ? '—' :
                  typeof value === 'object' ? JSON.stringify(value) :
                  String(value)}
              </span>
            </div>
          ))}
        </div>
        <div className={`p-4 border-t flex justify-end ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <button onClick={onClose} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">Close</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// GRAPH BUILDER MODAL
// ─────────────────────────────────────────────────────────────

const GraphBuilderModal = ({ onClose, onSave, theme, reportData, currentChart }) => {
  const [chartType, setChartType] = useState(currentChart?.type || 'bar');
  const [labelField, setLabelField] = useState(currentChart?.labelField || '');
  const [valueField, setValueField] = useState(currentChart?.valueField || '');
  const [chartColor, setChartColor] = useState(currentChart?.color || '#3b82f6');
  const [chartTitle, setChartTitle] = useState(currentChart?.title || '');

  const sampleData = reportData?.summary || reportData?.details || [];
  const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

  const previewData = sampleData.slice(0, 10).map(row => ({
    label: labelField ? String(row[labelField] || '') : 'Item',
    value: valueField ? (parseFloat(row[valueField]) || 0) : 0,
    color: chartColor
  }));

  const chartTypes = [
    { id: 'bar', label: 'Bar Chart', icon: BarChart2 },
    { id: 'line', label: 'Line Chart', icon: LineChart },
    { id: 'area', label: 'Area Chart', icon: Activity },
    { id: 'pie', label: 'Pie Chart', icon: PieChart },
    { id: 'donut', label: 'Donut Chart', icon: PieChart },
    { id: 'hbar', label: 'Horizontal Bar', icon: BarChart3 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-3xl rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className={`flex items-center justify-between p-5 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Graph Builder</h3>
          <button onClick={onClose} className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Config Panel */}
          <div className={`w-64 shrink-0 p-5 border-r space-y-4 overflow-y-auto ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
            <div>
              <label className={`block text-xs font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Chart Type</label>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map(ct => {
                  const Icon = ct.icon;
                  return (
                    <button key={ct.id} onClick={() => setChartType(ct.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        chartType === ct.id
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : theme === 'dark' ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <Icon className="w-4 h-4" />
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Chart Title</label>
              <input value={chartTitle} onChange={e => setChartTitle(e.target.value)}
                placeholder="Chart title..."
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Label Field (X-axis)</label>
              <select value={labelField} onChange={e => setLabelField(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                <option value="">— select field —</option>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Value Field (Y-axis)</label>
              <select value={valueField} onChange={e => setValueField(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                <option value="">— select field —</option>
                {fields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={chartColor} onChange={e => setChartColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0" />
                {CHART_COLORS.map(c => (
                  <button key={c} onClick={() => setChartColor(c)}
                    className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white transition-all"
                    style={{ backgroundColor: c, borderColor: chartColor === c ? '#fff' : 'transparent' }} />
                ))}
              </div>
            </div>
          </div>
          {/* Preview Panel */}
          <div className="flex-1 p-5 overflow-y-auto">
            <p className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Preview</p>
            <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'}`}>
              {chartTitle && <p className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{chartTitle}</p>}
              {previewData.length > 0 && valueField
                ? <ReportChart type={chartType} data={previewData} theme={theme} color={chartColor} />
                : <EmptyChart theme={theme} height={200} />
              }
            </div>
            <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>Showing up to 10 data points from report data</p>
          </div>
        </div>
        <div className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm border ${theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Cancel</button>
          <button onClick={() => onSave({ type: chartType, labelField, valueField, color: chartColor, title: chartTitle })}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">
            <Save className="w-4 h-4" /> Apply Chart
          </button>
        </div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// CUSTOM REPORT BUILDER MODAL
// ─────────────────────────────────────────────────────────────

const CUSTOM_FIELDS = {
  appointments: ['id', 'start_time', 'end_time', 'status', 'appointment_type', 'reason', 'patient_name', 'provider_name', 'specialization'],
  claims: ['id', 'claim_number', 'service_date', 'status', 'amount', 'payer', 'patient_name'],
  payments: ['id', 'payment_date', 'amount', 'payment_method', 'payment_status', 'notes', 'patient_name'],
  patients: ['id', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email', 'insurance', 'state', 'city'],
};

const CustomReportBuilderModal = ({ onClose, onRun, theme }) => {
  const [dataSource, setDataSource] = useState('appointments');
  const [selectedFields, setSelectedFields] = useState(['patient_name', 'status', 'start_time']);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [groupBy, setGroupBy] = useState('');
  const [limit, setLimit] = useState(200);
  const [reportName, setReportName] = useState('My Custom Report');

  const fields = CUSTOM_FIELDS[dataSource] || [];

  const toggleField = (f) => {
    setSelectedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const handleRun = () => {
    onRun({
      reportName,
      dataSource,
      fields: selectedFields,
      filters: { status: filterStatus || undefined, startDate: filterStartDate || undefined, endDate: filterEndDate || undefined },
      groupBy: groupBy || undefined,
      sortBy: sortBy || undefined,
      sortOrder,
      limit
    });
  };

  const statusOptions = {
    appointments: ['Confirmed', 'Completed', 'Cancelled', 'Pending', 'No-Show'],
    claims: ['Approved', 'Denied', 'Pending', 'Submitted', 'Paid'],
    payments: ['Completed', 'Refunded', 'Pending'],
    patients: []
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-200'} max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className={`flex items-center justify-between p-5 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div>
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Custom Report Builder</h3>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Select data source, fields, and filters</p>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Report Name */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Report Name</label>
            <input value={reportName} onChange={e => setReportName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
          </div>

          {/* Data Source */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Data Source</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(CUSTOM_FIELDS).map(src => (
                <button key={src} onClick={() => { setDataSource(src); setSelectedFields(CUSTOM_FIELDS[src].slice(0, 4)); setSortBy(''); setGroupBy(''); }}
                  className={`py-2 px-3 rounded-lg border text-sm capitalize transition-all ${
                    dataSource === src ? 'border-blue-500 bg-blue-500/10 text-blue-400' :
                    theme === 'dark' ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>{src}</button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
              Fields <span className="font-normal opacity-60">({selectedFields.length} selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {fields.map(f => (
                <button key={f} onClick={() => toggleField(f)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${
                    selectedFields.includes(f) ? 'border-blue-500 bg-blue-500/20 text-blue-400' :
                    theme === 'dark' ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{f.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <label className={`block text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Filters</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Start Date</label>
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>End Date</label>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
              </div>
              {statusOptions[dataSource]?.length > 0 && (
                <div>
                  <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                    <option value="">All</option>
                    {statusOptions[dataSource].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Sorting & Grouping */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                <option value="">Default</option>
                {selectedFields.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Sort Order</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Max Rows</label>
              <select value={limit} onChange={e => setLimit(parseInt(e.target.value))}
                className={`w-full px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
              </select>
            </div>
          </div>
        </div>
        <div className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm border ${theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Cancel</button>
          <button onClick={handleRun} disabled={selectedFields.length === 0}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
            <Play className="w-4 h-4" /> Run Report
          </button>
        </div>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// DATA TABLE WITH SEARCH, SORT, PAGINATION
// ─────────────────────────────────────────────────────────────

const DataTable = ({ data = [], columns = [], theme, onRowClick, title, currency = 'USD' }) => {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const filtered = data.filter(row =>
    !search || Object.values(row).some(v => String(v || '').toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        const n = parseFloat(av) - parseFloat(bv);
        if (!isNaN(n)) return sortDir === 'asc' ? n : -n;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      })
    : filtered;

  const pages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const autoColumns = columns.length > 0 ? columns : (data[0] ? Object.keys(data[0]).slice(0, 8) : []);

  const renderCell = (row, col) => {
    const val = row[col];
    if (val === null || val === undefined) return <span className="opacity-30">—</span>;
    if (col === 'status') return <StatusBadge status={val} />;
    if (col.includes('amount') || col.includes('revenue') || col.includes('billed') || col.includes('collected') || col.includes('paid') || col.includes('balance') || col.includes('cost') || col.includes('price') || col.includes('fee') || col.includes('charge')) {
      const num = parseFloat(val);
      return !isNaN(num) ? formatCurrency(num, currency) : val;
    }
    if (col.includes('date') || col.includes('time') || col.includes('_at')) {
      return formatDate(val);
    }
    if (col.includes('rate') || col.includes('percentage')) return `${val}%`;
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 40);
    return String(val).slice(0, 60);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {title && <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{title}</h4>}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-gray-50 border-gray-300'}`}>
          <Search className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search records..."
            className={`bg-transparent text-sm outline-none w-40 ${theme === 'dark' ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'}`} />
        </div>
        <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{filtered.length} records</span>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className={theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50'}>
              {autoColumns.map(col => (
                <th key={col} onClick={() => toggleSort(col)}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}>
                  <span className="flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    {sortCol === col ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                  </span>
                </th>
              ))}
              {onRowClick && <th className={`px-4 py-3 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}></th>}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0
              ? <tr><td colSpan={autoColumns.length + 1} className={`px-4 py-8 text-center text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>No data</td></tr>
              : paged.map((row, i) => (
                <tr key={i}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`border-t transition-colors ${theme === 'dark' ? 'border-slate-700' : 'border-gray-100'} ${onRowClick ? 'cursor-pointer' : ''} ${
                    theme === 'dark' ? 'hover:bg-slate-700/40' : 'hover:bg-gray-50'
                  }`}>
                  {autoColumns.map(col => (
                    <td key={col} className={`px-4 py-2.5 whitespace-nowrap ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                      {renderCell(row, col)}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className="px-4 py-2.5">
                      <Eye className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                    </td>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
            Page {page} of {pages}
          </p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors disabled:opacity-40 ${theme === 'dark' ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Prev</button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const pg = Math.max(1, Math.min(pages - 4, page - 2)) + i;
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    page === pg ? 'bg-blue-500 border-blue-500 text-white' :
                    theme === 'dark' ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}>{pg}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors disabled:opacity-40 ${theme === 'dark' ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// INDIVIDUAL REPORT CONTENT RENDERERS
// ─────────────────────────────────────────────────────────────

const ReportContent = ({ category, report, data, loading, error, onRetry, theme, chartConfig, onDataPointClick, onChartConfigChange, currency = 'USD' }) => {
  if (loading) return <Spinner theme={theme} />;
  if (error) return <LoadError onRetry={onRetry} theme={theme} />;
  if (!data) return null;

  const { summary = [], details = [], byGender, byAge, byState, byMethod, aging, payerSummary, retention, phiAccess, userStats } = data;

  // Use custom chart config if available
  const activeChartType = chartConfig?.type || report.defaultChart;

  // Prepare chart data from summary or from custom config
  const makeChartData = (rows, labelKey, valueKey) =>
    rows.map(r => ({ label: String(r[labelKey] || ''), value: parseFloat(r[valueKey]) || 0 }));

  // Detect best chart data based on report type
  const getDefaultChartData = () => {
    if (chartConfig?.labelField && chartConfig?.valueField) {
      const src = summary.length > 0 ? summary : details;
      return src.map(r => ({ label: String(r[chartConfig.labelField] || ''), value: parseFloat(r[chartConfig.valueField]) || 0 }));
    }
    // Defaults per report
    const rd = report.id;
    if (rd === 'daily-appointments' || rd === 'no-shows') return makeChartData(summary.slice(0, 30).reverse(), 'date', 'total');
    if (rd === 'provider-utilization' || rd === 'productivity') return makeChartData(summary, 'provider_name', 'total_appointments');
    if (rd === 'patient-visits' || rd === 'visit-history') return makeChartData(summary.slice(0, 10), 'patient_name', 'total_visits');
    if (rd === 'wait-times') return makeChartData(summary, 'provider_name', 'avg_wait_minutes');
    if (rd === 'revenue') return makeChartData(summary.slice(0, 30).reverse(), 'date', 'total_billed');
    if (rd === 'billing-summary') return (summary || []).map(r => ({ label: r.status, value: parseFloat(r.count) }));
    if (rd === 'outstanding-payments') return makeChartData(summary, 'payer', 'outstanding_amount');
    if (rd === 'payment-collection') return makeChartData(summary.slice(0, 30).reverse(), 'date', 'total_collected');
    if (rd === 'refunds') return makeChartData(summary.slice(0, 30).reverse(), 'date', 'total_refunded');
    if (rd === 'claim-status') return (summary || []).map(r => ({ label: r.status, value: parseFloat(r.count) }));
    if (rd === 'claim-rejections') return makeChartData(summary, 'payer', 'rejected_count');
    if (rd === 'denial-analysis') return makeChartData(summary, 'denial_reason', 'count');
    if (rd === 'payer-performance') return makeChartData(summary, 'payer', 'approval_rate');
    if (rd === 'demographics') return (byGender || []).map(r => ({ label: r.gender, value: parseInt(r.count) }));
    if (rd === 'retention') return makeChartData((data.summary || []).slice(0, 12).reverse(), 'month', 'unique_patients');
    if (rd === 'satisfaction') return makeChartData(summary, 'provider_name', 'completion_rate');
    if (rd === 'appointment-volume') return makeChartData((data.byProvider || []), 'provider_name', 'total_appointments');
    if (rd === 'revenue' && category === 'provider') return makeChartData(summary, 'provider_name', 'total_billed');
    if (rd === 'telehealth-usage') return makeChartData(summary, 'provider_name', 'session_count');
    if (rd === 'audit-logs') return makeChartData(summary, 'action', 'count');
    if (rd === 'access-logs') return makeChartData(summary, 'user_name', 'access_count');
    if (rd === 'hipaa') return (phiAccess || []).map(r => ({ label: r.resource_type, value: parseInt(r.total_access) }));
    if (rd === 'data-access-history') return makeChartData(summary.slice(0, 10), 'resource_type', 'count');
    // Accounts module reports
    if (rd === 'acct-trial-balance') {
      const rows = data.rows || [];
      return rows.map(r => ({ label: r.accountName || r.account_name || '', value: parseFloat(r.debitBalance || r.debit_balance || 0) || parseFloat(r.creditBalance || r.credit_balance || 0) }));
    }
    if (rd === 'acct-income-statement') {
      const rows = data.rows || [];
      return rows.map(r => ({ label: r.accountName || r.account_name || '', value: Math.abs(parseFloat(r.periodAmount || r.period_amount || 0)) }));
    }
    if (rd === 'acct-balance-sheet') {
      const totals = [
        { label: 'Assets',      value: Math.abs(parseFloat(data.totalAssets      || data.total_assets      || 0)) },
        { label: 'Liabilities', value: Math.abs(parseFloat(data.totalLiabilities || data.total_liabilities || 0)) },
        { label: 'Equity',      value: Math.abs(parseFloat(data.totalEquity      || data.total_equity      || 0)) },
      ];
      return totals.filter(t => t.value > 0);
    }
    if (rd === 'acct-ar-aging') {
      const buckets = data.buckets || {};
      return Object.entries(buckets).map(([key, val]) => ({ label: key.replace(/_/g, ' '), value: parseFloat(val) || 0 }));
    }
    return makeChartData(summary.slice(0, 10), Object.keys(summary[0] || {})[0] || 'label', Object.keys(summary[0] || {})[1] || 'value');
  };

  const chartData = getDefaultChartData();

  // Compute KPIs per report
  const getKPIs = () => {
    const rd = report.id;
    const fmt = (amount) => formatCurrency(amount, currency);
    if (rd === 'daily-appointments') {
      const total = summary.reduce((s, r) => s + (r.total || 0), 0);
      const completed = summary.reduce((s, r) => s + (r.completed || 0), 0);
      const noShows = summary.reduce((s, r) => s + (r.no_shows || 0), 0);
      const rate = total > 0 ? Math.round(completed / total * 100) : 0;
      return [
        { label: 'Total Appointments', value: total, icon: Calendar, color: 'blue' },
        { label: 'Completed', value: completed, icon: CheckCircle, color: 'green' },
        { label: 'No-Shows', value: noShows, icon: AlertTriangle, color: 'red' },
        { label: 'Completion Rate', value: `${rate}%`, icon: TrendingUp, color: 'purple' },
      ];
    }
    if (rd === 'provider-utilization' || rd === 'productivity') {
      const totalAppts = summary.reduce((s, r) => s + (parseInt(r.total_appointments) || 0), 0);
      const totalCompleted = summary.reduce((s, r) => s + (parseInt(r.completed) || 0), 0);
      const totalRevenue = summary.reduce((s, r) => s + (parseFloat(r.total_revenue) || 0), 0);
      return [
        { label: 'Total Appointments', value: totalAppts, icon: Calendar, color: 'blue' },
        { label: 'Completed', value: totalCompleted, icon: CheckCircle, color: 'green' },
        { label: 'Active Providers', value: summary.filter(r => r.total_appointments > 0).length, icon: Users, color: 'purple' },
        { label: 'Total Revenue', value: fmt(totalRevenue), icon: DollarSign, color: 'orange' },
      ];
    }
    if (rd === 'revenue') {
      const total = summary.reduce((s, r) => s + (parseFloat(r.total_billed) || 0), 0);
      const approved = summary.reduce((s, r) => s + (parseFloat(r.approved_amount) || 0), 0);
      const denied = summary.reduce((s, r) => s + (parseFloat(r.denied_amount) || 0), 0);
      return [
        { label: 'Total Billed', value: fmt(total), icon: DollarSign, color: 'green' },
        { label: 'Approved', value: fmt(approved), icon: CheckCircle, color: 'blue' },
        { label: 'Denied', value: fmt(denied), icon: XCircle, color: 'red' },
        { label: 'Collection Rate', value: total > 0 ? `${Math.round(approved / total * 100)}%` : '0%', icon: TrendingUp, color: 'purple' },
      ];
    }
    if (rd === 'outstanding-payments') {
      const totalOut = summary.reduce((s, r) => s + (parseFloat(r.outstanding_amount) || 0), 0);
      return [
        { label: 'Total Outstanding', value: fmt(totalOut), icon: AlertTriangle, color: 'yellow' },
        { label: 'Payers with Balance', value: summary.length, icon: Shield, color: 'purple' },
        { label: 'Total Claims', value: summary.reduce((s, r) => s + (parseInt(r.claim_count) || 0), 0), icon: FileText, color: 'blue' },
        { label: 'Oldest Claim', value: summary.length > 0 ? formatDate(summary.sort((a, b) => new Date(a.oldest_claim_date) - new Date(b.oldest_claim_date))[0]?.oldest_claim_date) : '—', icon: Clock, color: 'red' },
      ];
    }
    if (rd === 'claim-status') {
      const total = summary.reduce((s, r) => s + (parseInt(r.count) || 0), 0);
      const approved = summary.filter(r => ['Approved','Paid'].includes(r.status)).reduce((s, r) => s + (parseInt(r.count) || 0), 0);
      const denied = summary.filter(r => ['Denied','Rejected'].includes(r.status)).reduce((s, r) => s + (parseInt(r.count) || 0), 0);
      return [
        { label: 'Total Claims', value: total, icon: FileText, color: 'blue' },
        { label: 'Approved / Paid', value: approved, icon: CheckCircle, color: 'green' },
        { label: 'Denied / Rejected', value: denied, icon: XCircle, color: 'red' },
        { label: 'Approval Rate', value: total > 0 ? `${Math.round(approved / total * 100)}%` : '0%', icon: TrendingUp, color: 'purple' },
      ];
    }
    if (rd === 'demographics') {
      const total = (data.details || []).length;
      const avgAge = data.details?.length > 0
        ? Math.round(data.details.reduce((s, r) => s + (r.age || 0), 0) / data.details.length)
        : 0;
      const states = new Set(data.details?.map(r => r.state).filter(Boolean)).size;
      return [
        { label: 'Total Patients', value: total, icon: Users, color: 'blue' },
        { label: 'Average Age', value: avgAge, icon: Clock, color: 'teal' },
        { label: 'States Covered', value: states, icon: Grid, color: 'purple' },
        { label: 'Gender Groups', value: (byGender || []).length, icon: PieChart, color: 'orange' },
      ];
    }
    if (rd === 'payer-performance') {
      const total = summary.reduce((s, r) => s + (parseInt(r.total_claims) || 0), 0);
      const billed = summary.reduce((s, r) => s + (parseFloat(r.total_billed) || 0), 0);
      const paid = summary.reduce((s, r) => s + (parseFloat(r.paid_amount) || 0), 0);
      return [
        { label: 'Total Claims', value: total, icon: FileText, color: 'blue' },
        { label: 'Total Billed', value: fmt(billed), icon: DollarSign, color: 'green' },
        { label: 'Amount Paid', value: fmt(paid), icon: CheckCircle, color: 'teal' },
        { label: 'Avg Approval Rate', value: summary.length > 0 ? `${Math.round(summary.reduce((s, r) => s + (parseFloat(r.approval_rate) || 0), 0) / summary.length)}%` : '0%', icon: TrendingUp, color: 'purple' },
      ];
    }
    // Accounts module reports
    if (rd === 'acct-trial-balance') {
      const totalDebit  = parseFloat(data.totalDebit  || data.total_debit  || 0);
      const totalCredit = parseFloat(data.totalCredit || data.total_credit || 0);
      return [
        { label: 'Total Debit',  value: fmt(totalDebit),  icon: TrendingUp,  color: 'green'  },
        { label: 'Total Credit', value: fmt(totalCredit), icon: TrendingDown, color: 'red'   },
        { label: 'Accounts',     value: (data.rows || []).length, icon: BookOpen, color: 'blue' },
        { label: 'Balanced',     value: data.isBalanced || data.is_balanced ? '✓ Yes' : '✗ No', icon: CheckCircle, color: data.isBalanced ? 'green' : 'red' },
      ];
    }
    if (rd === 'acct-income-statement') {
      const revenue    = parseFloat(data.revenue    || 0);
      const expenses   = parseFloat(data.expenses   || 0);
      const netIncome  = parseFloat(data.netIncome  || data.net_income  || 0);
      const netRevenue = parseFloat(data.netRevenue || data.net_revenue || 0);
      return [
        { label: 'Total Revenue',  value: fmt(revenue),   icon: TrendingUp,  color: 'green'  },
        { label: 'Net Revenue',    value: fmt(netRevenue), icon: DollarSign,  color: 'blue'   },
        { label: 'Total Expenses', value: fmt(expenses),  icon: TrendingDown, color: 'red'   },
        { label: 'Net Income',     value: fmt(netIncome), icon: Activity,     color: netIncome >= 0 ? 'green' : 'red' },
      ];
    }
    if (rd === 'acct-balance-sheet') {
      return [
        { label: 'Total Assets',      value: fmt(parseFloat(data.totalAssets      || data.total_assets      || 0)), icon: Building2,   color: 'blue'  },
        { label: 'Total Liabilities', value: fmt(parseFloat(data.totalLiabilities || data.total_liabilities || 0)), icon: AlertTriangle, color: 'red'  },
        { label: 'Total Equity',      value: fmt(parseFloat(data.totalEquity      || data.total_equity      || 0)), icon: DollarSign,  color: 'green' },
        { label: 'Balanced',          value: data.isBalanced || data.is_balanced ? '✓ Yes' : '✗ No', icon: CheckCircle, color: data.isBalanced ? 'green' : 'red' },
      ];
    }
    if (rd === 'acct-ar-aging') {
      const buckets = data.buckets || {};
      const totalAR = parseFloat(data.totalAR || data.total_ar || 0);
      const overdue = Object.entries(buckets).filter(([k]) => k !== 'current').reduce((s, [, v]) => s + parseFloat(v), 0);
      return [
        { label: 'Total AR',      value: fmt(totalAR),            icon: TrendingUp,   color: 'blue'   },
        { label: 'Current',       value: fmt(parseFloat(buckets.current || 0)), icon: CheckCircle, color: 'green' },
        { label: 'Overdue',       value: fmt(overdue),            icon: AlertTriangle, color: 'red'   },
        { label: 'AR Records',    value: (data.rows || []).length, icon: FileText,     color: 'purple' },
      ];
    }
    // Inventory KPIs
    if (rd === 'inv-stock-levels') {
      const rows = data.rows || [];
      const totalItems = rows.length;
      const totalValue = rows.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0);
      const lowStock = rows.filter(r => parseFloat(r.quantity_on_hand) <= parseFloat(r.reorder_level)).length;
      return [
        { label: 'Total Items',    value: totalItems,       icon: Package,       color: 'blue'   },
        { label: 'Total Value',    value: fmt(totalValue),  icon: DollarSign,    color: 'green'  },
        { label: 'Low Stock',      value: lowStock,         icon: AlertTriangle, color: 'red'    },
        { label: 'In Stock',       value: totalItems - lowStock, icon: CheckCircle, color: 'teal' },
      ];
    }
    if (rd === 'inv-low-stock') {
      const rows = data.rows || [];
      const critical = rows.filter(r => parseFloat(r.quantity_on_hand) === 0).length;
      return [
        { label: 'Low Stock Items', value: rows.length,  icon: AlertTriangle, color: 'red'    },
        { label: 'Out of Stock',    value: critical,     icon: XCircle,       color: 'red'    },
        { label: 'Need Reorder',    value: rows.length - critical, icon: ShoppingCart, color: 'orange' },
        { label: 'Categories',      value: new Set(rows.map(r => r.category_name)).size, icon: Tag, color: 'blue' },
      ];
    }
    if (rd === 'inv-valuation') {
      const rows = data.rows || [];
      const total = rows.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0);
      return [
        { label: 'Total Value',    value: fmt(total),    icon: DollarSign, color: 'green' },
        { label: 'Categories',     value: rows.length,   icon: Tag,        color: 'blue'  },
        { label: 'Avg per Cat',    value: fmt(rows.length ? total / rows.length : 0), icon: BarChart2, color: 'purple' },
        { label: 'Items Tracked',  value: rows.reduce((s, r) => s + (parseInt(r.item_count) || 0), 0), icon: Package, color: 'teal' },
      ];
    }
    if (rd === 'inv-movement-history') {
      const rows = data.rows || [];
      const totalIn = rows.filter(r => r.movement_type === 'receipt').reduce((s, r) => s + (parseFloat(r.total_quantity) || 0), 0);
      const totalOut = rows.filter(r => r.movement_type === 'issue').reduce((s, r) => s + Math.abs(parseFloat(r.total_quantity) || 0), 0);
      return [
        { label: 'Total Movements', value: rows.reduce((s, r) => s + (parseInt(r.count) || 0), 0), icon: TrendingUp, color: 'blue' },
        { label: 'Total Received',  value: totalIn.toFixed(2), icon: Package,     color: 'green'  },
        { label: 'Total Issued',    value: totalOut.toFixed(2), icon: Truck,      color: 'orange' },
        { label: 'Move Types',      value: rows.length,         icon: FileText,   color: 'purple' },
      ];
    }
    if (rd === 'inv-expiry-alerts') {
      const rows = data.rows || [];
      const expired = rows.filter(r => new Date(r.expiry_date) < new Date()).length;
      const within30 = rows.filter(r => { const d = new Date(r.expiry_date); const now = new Date(); return d >= now && d <= new Date(now.getTime() + 30*86400000); }).length;
      return [
        { label: 'Expiring Soon', value: rows.length,  icon: AlertTriangle, color: 'red'    },
        { label: 'Already Expired', value: expired,    icon: XCircle,       color: 'red'    },
        { label: 'Within 30 Days',  value: within30,   icon: Clock,         color: 'orange' },
        { label: '31–90 Days',      value: rows.length - expired - within30, icon: CheckCircle, color: 'teal' },
      ];
    }
    // Fallback KPIs
    return [
      { label: 'Total Records', value: (summary.length + details.length), icon: FileText, color: 'blue' },
    ];
  };

  const kpis = getKPIs();
  const isAccountsReport = report.id?.startsWith('acct-');
  const isInventoryReport = report.id?.startsWith('inv-');
  const tableData = (isAccountsReport || isInventoryReport) ? (data.rows || []) : (details.length > 0 ? details : summary);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {kpis.length > 0 && (
        <div className={`grid gap-4 ${kpis.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {kpis.map((kpi, i) => (
            <KPICard key={i} {...kpi} theme={theme} />
          ))}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <Card theme={theme} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {chartConfig?.title || report.name}
            </h3>
            <div className="flex gap-2">
              {/* Quick chart type switcher */}
              {['bar', 'line', 'area', 'donut'].map(t => (
                <button key={t} onClick={() => onChartConfigChange({ ...chartConfig, type: t })}
                  title={t.charAt(0).toUpperCase() + t.slice(1)}
                  className={`px-2 py-1 rounded text-xs border transition-all ${
                    activeChartType === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' :
                    theme === 'dark' ? 'border-slate-700 text-slate-400 hover:border-slate-500' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <ReportChart
            type={activeChartType}
            data={chartData}
            theme={theme}
            onDataClick={onDataPointClick}
            valueFormatter={report.id.includes('revenue') || report.id.includes('payment') || report.id.includes('billing') || report.id.includes('outstanding')
              ? (v) => formatCurrency(v, currency) : undefined}
            color={chartConfig?.color}
          />
        </Card>
      )}

      {/* Secondary charts for demographics */}
      {report.id === 'demographics' && byAge && byAge.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card theme={theme} className="p-5">
            <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Age Distribution</h4>
            <ReportChart type="bar" data={byAge.map(r => ({ label: r.age_group, value: parseInt(r.count) }))} theme={theme} />
          </Card>
          <Card theme={theme} className="p-5">
            <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Top States</h4>
            <ReportChart type="hbar" data={byState?.slice(0, 8).map(r => ({ label: r.state, value: parseInt(r.count) }))} theme={theme} />
          </Card>
        </div>
      )}

      {/* Aging chart for outstanding payments */}
      {report.id === 'outstanding-payments' && aging && aging.length > 0 && (
        <Card theme={theme} className="p-5">
          <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Aging Analysis</h4>
          <ReportChart type="bar" data={aging.map(r => ({ label: r.aging_bucket, value: parseFloat(r.total_amount) }))}
            theme={theme} valueFormatter={v => formatCurrency(v, currency)} />
        </Card>
      )}

      {/* Payment methods */}
      {report.id === 'payment-collection' && byMethod && byMethod.length > 0 && (
        <Card theme={theme} className="p-5">
          <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>By Payment Method</h4>
          <ReportChart type="donut" data={byMethod.map(r => ({ label: r.payment_method, value: parseFloat(r.total_amount) }))} theme={theme} />
        </Card>
      )}

      {/* Retention status */}
      {report.id === 'retention' && data.retention && (
        <Card theme={theme} className="p-5">
          <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Patient Retention Status</h4>
          {(() => {
            const statusCounts = data.retention.reduce((acc, r) => { acc[r.retention_status] = (acc[r.retention_status] || 0) + 1; return acc; }, {});
            return <ReportChart type="donut" data={Object.entries(statusCounts).map(([label, value]) => ({ label, value }))} theme={theme} />;
          })()}
        </Card>
      )}

      {/* HIPAA user stats */}
      {report.id === 'hipaa' && userStats && (
        <Card theme={theme} className="p-5">
          <h4 className={`text-sm font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Users by Role</h4>
          <ReportChart type="donut" data={(userStats || []).map(r => ({ label: r.role, value: parseInt(r.count) }))} theme={theme} />
        </Card>
      )}

      {/* Data Table */}
      {tableData.length > 0 && (
        <Card theme={theme} className="p-5">
          <DataTable data={tableData} theme={theme} onRowClick={onDataPointClick} title="Detailed Records" currency={currency} />
        </Card>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// CUSTOM REPORT RESULT VIEW
// ─────────────────────────────────────────────────────────────

const CustomReportResultView = ({ result, config, theme, onBack, currency = 'USD' }) => {
  const { data = [], fields = [] } = result;

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, config.reportName || 'Custom Report');
    XLSX.writeFile(wb, `custom-report-${Date.now()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(config.reportName || 'Custom Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [fields.map(f => f.replace(/_/g, ' ').toUpperCase())],
      body: data.map(row => fields.map(f => String(row[f] ?? ''))),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`custom-report-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
          <div>
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{config.reportName}</h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              {data.length} records from {config.dataSource}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportToPDF} className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>
      <Card theme={theme} className="p-5">
        <DataTable data={data} columns={fields} theme={theme} title={`${data.length} Records`} currency={currency} />
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN REPORTS VIEW COMPONENT
// ─────────────────────────────────────────────────────────────

const ReportsView = ({ theme, patients = [], appointments = [], claims = [], payments = [], addNotification, setCurrentModule, api, currency = 'USD', activeTab: shellTab, onTabChange }) => {
  // The app shell lists the report catalogue in its secondary pane and passes
  // the selection down as "<categoryId>:<reportId>" (or "custom"). Rendered
  // outside the shell the view keeps its own sidebar.
  const tabsInShell = typeof onTabChange === 'function';
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [drillRecord, setDrillRecord] = useState(null);
  const [showGraphBuilder, setShowGraphBuilder] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [chartConfig, setChartConfig] = useState({});
  const [customResult, setCustomResult] = useState(null);
  const [customConfig, setCustomConfig] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [customLoading, setCustomLoading] = useState(false);

  const { logViewAccess } = useAudit();

  useEffect(() => {
    logViewAccess('ReportsView', { module: 'Reports' });
  }, [logViewAccess]);

  // Date params
  const getDateParams = useCallback(() => {
    if (customStartDate && customEndDate) return { startDate: customStartDate, endDate: customEndDate };
    return { days: dateRange };
  }, [dateRange, customStartDate, customEndDate]);

  // Load report
  const loadReport = useCallback(async (cat, rep, params) => {
    if (!api || !api[rep.apiMethod]) return;
    setLoading(true);
    setError(null);
    setReportData(null);
    try {
      const data = await api[rep.apiMethod](params || getDateParams());
      setReportData(data);
    } catch (err) {
      console.error('Report load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, getDateParams]);

  // When report changes, load data
  useEffect(() => {
    if (selectedReport && selectedCategory) {
      loadReport(selectedCategory, selectedReport);
    }
  }, [selectedReport, selectedCategory, dateRange, customStartDate, customEndDate]);

  const selectReport = useCallback((cat, rep) => {
    setSelectedCategory(cat);
    setSelectedReport(rep);
    setReportData(null);
    setError(null);
    setChartConfig({});
    setCustomResult(null);
  }, []);

  // Mirror the shell's pane-2 selection into the view's own state.
  useEffect(() => {
    if (!tabsInShell) return;

    if (shellTab === 'custom') {
      setSelectedReport(null);
      setSelectedCategory(null);
      setShowCustomBuilder(true);
      return;
    }

    const [catId, repId] = String(shellTab || '').split(':');
    const cat = REPORT_CATEGORIES.find(c => c.id === catId);
    const rep = cat?.reports.find(r => r.id === repId);
    if (!cat || !rep) return;
    if (selectedReport?.id === rep.id && selectedCategory?.id === cat.id) return;
    selectReport(cat, rep);
  }, [tabsInShell, shellTab, selectReport, selectedReport, selectedCategory]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Export current report
  const exportToPDF = () => {
    if (!selectedReport || !reportData) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const dateStr = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text(`AureonCare - ${selectedReport.name}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Period: ${dateRange === 'all' ? 'All Time' : `Last ${dateRange} Days`}`, 14, 32);

    const tableData = reportData.details || reportData.summary || [];
    if (tableData.length > 0) {
      const cols = Object.keys(tableData[0]).slice(0, 10);
      autoTable(doc, {
        startY: 40,
        head: [cols.map(c => c.replace(/_/g, ' ').toUpperCase())],
        body: tableData.slice(0, 100).map(row => cols.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          if (typeof val === 'number' || (c.includes('amount') || c.includes('revenue') || c.includes('billed') || c.includes('paid') || c.includes('balance') || c.includes('cost') || c.includes('price') || c.includes('outstanding'))) {
            const num = parseFloat(val);
            if (!isNaN(num) && (c.includes('amount') || c.includes('revenue') || c.includes('billed') || c.includes('paid') || c.includes('balance') || c.includes('cost') || c.includes('price') || c.includes('outstanding'))) {
              return formatCurrency(num, currency);
            }
          }
          return String(val ?? '');
        })),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 }
      });
    }

    doc.save(`${selectedReport.id}-${dateStr}.pdf`);
    addNotification && addNotification('success', 'Report exported to PDF');
  };

  const exportToXLSX = () => {
    if (!selectedReport || !reportData) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const wb = XLSX.utils.book_new();

    const summary = reportData.summary || [];
    const details = reportData.details || [];

    if (summary.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    }
    if (details.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), 'Details');
    }
    // Extra sheets if present
    if (reportData.aging) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.aging), 'Aging');
    if (reportData.byMethod) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.byMethod), 'By Method');
    if (reportData.retention) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.retention), 'Retention');
    if (reportData.byGender) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData.byGender), 'By Gender');

    if (wb.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data available']]), 'Report');
    }

    XLSX.writeFile(wb, `${selectedReport.id}-${dateStr}.xlsx`);
    addNotification && addNotification('success', 'Report exported to Excel');
  };

  // Run custom report
  const handleRunCustomReport = async (config) => {
    setShowCustomBuilder(false);
    setCustomLoading(true);
    setCustomConfig(config);
    setCustomResult(null);
    setSelectedReport(null);
    setSelectedCategory(null);
    try {
      const result = await api.generateCustomReport(config);
      setCustomResult(result);
    } catch (err) {
      addNotification && addNotification('error', 'Failed to run custom report');
    } finally {
      setCustomLoading(false);
    }
  };

  // Category color maps
  const catColor = { operational: 'blue', financial: 'green', insurance: 'purple', patient: 'teal', provider: 'orange', compliance: 'red', accounts: 'emerald', inventory: 'amber' };
  const catBg = { blue: theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
                  green: theme === 'dark' ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600',
                  purple: theme === 'dark' ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600',
                  teal: theme === 'dark' ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600',
                  orange: theme === 'dark' ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600',
                  red: theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600',
                  emerald: theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
                  amber: theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600' };

  return (
    <div className="flex h-full gap-0">
      {/* Sidebar — replaced by the app shell's secondary pane when present */}
      {!tabsInShell && (
      <div className={`w-64 shrink-0 border-r flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`}
        style={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Sidebar Header */}
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Reports</h2>
          </div>
          <button onClick={() => setShowCustomBuilder(true)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            <PlusCircle className="w-4 h-4" /> Custom Report
          </button>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto py-2">
          {REPORT_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const color = catColor[cat.id];
            const isExpanded = expandedCategories[cat.id] !== false; // default expanded
            const isActiveCategory = selectedCategory?.id === cat.id;

            return (
              <div key={cat.id}>
                <button onClick={() => toggleCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    isActiveCategory ? (theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100') :
                    theme === 'dark' ? 'hover:bg-slate-800/60' : 'hover:bg-gray-100'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${catBg[color]}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>{cat.name}</span>
                  </div>
                  {isExpanded ? <ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                    : <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />}
                </button>
                {isExpanded && (
                  <div className="pb-1">
                    {cat.reports.map(rep => {
                      const RepIcon = rep.icon;
                      const isActive = selectedReport?.id === rep.id && selectedCategory?.id === cat.id;
                      return (
                        <button key={rep.id} onClick={() => selectReport(cat, rep)}
                          className={`w-full flex items-center gap-2.5 pl-8 pr-4 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                              : theme === 'dark' ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}>
                          <RepIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{rep.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Toolbar */}
        <div className={`flex items-center justify-between px-6 py-3 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {selectedReport && (
              <>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{selectedCategory?.name}</span>
                <ChevronRight className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedReport.name}</span>
              </>
            )}
            {customResult && !selectedReport && (
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{customConfig?.reportName}</span>
            )}
            {!selectedReport && !customResult && (
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Select a report from the sidebar</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            {selectedReport && (
              <>
                <select value={dateRange} onChange={e => { setDateRange(e.target.value); setCustomStartDate(''); setCustomEndDate(''); }}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="180">Last 6 Months</option>
                  <option value="365">Last Year</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
                {dateRange === 'custom' && (
                  <>
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                      className={`px-2 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}>to</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                      className={`px-2 py-1.5 rounded-lg border text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  </>
                )}
                <button onClick={() => loadReport(selectedCategory, selectedReport)}
                  className={`p-2 rounded-lg border transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : 'border-gray-300 hover:bg-gray-50'}`}
                  title="Refresh">
                  <RefreshCw className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`} />
                </button>
                <button onClick={() => setShowGraphBuilder(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <Edit3 className="w-3.5 h-3.5" /> Chart
                </button>
                <button onClick={exportToXLSX}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
                <button onClick={exportToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Welcome State */}
          {!selectedReport && !customResult && !customLoading && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <BarChart3 className={`w-6 h-6 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                <div>
                  <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>Reports & Analytics</h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                    Select a report from the sidebar, or create a custom report.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {REPORT_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const color = catColor[cat.id];
                  return (
                    <button key={cat.id} onClick={() => { setExpandedCategories(p => ({ ...p, [cat.id]: true })); selectReport(cat, cat.reports[0]); }}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                        theme === 'dark' ? 'border-slate-700 hover:border-slate-500 bg-slate-800/40' : 'border-gray-200 hover:border-gray-300 bg-white shadow-sm'
                      }`}>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${catBg[color]}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>{cat.name}</p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>{cat.reports.length} reports</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Report Loading */}
          {customLoading && <Spinner theme={theme} />}

          {/* Custom Report Result */}
          {customResult && !selectedReport && (
            <CustomReportResultView result={customResult} config={customConfig} theme={theme}
              onBack={() => { setCustomResult(null); setCustomConfig(null); }} currency={currency} />
          )}

          {/* Standard Report */}
          {selectedReport && (
            <div>
              <div className="mb-5">
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedReport.name}</h2>
                <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{selectedReport.description}</p>
              </div>
              <ReportContent
                category={selectedCategory}
                report={selectedReport}
                data={reportData}
                loading={loading}
                error={error}
                onRetry={() => loadReport(selectedCategory, selectedReport)}
                theme={theme}
                chartConfig={chartConfig}
                onDataPointClick={(record) => setDrillRecord(record)}
                onChartConfigChange={(cfg) => setChartConfig(cfg)}
                currency={currency}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {drillRecord && <DrillDownModal record={drillRecord} onClose={() => setDrillRecord(null)} theme={theme} />}
      {showGraphBuilder && (
        <GraphBuilderModal
          onClose={() => setShowGraphBuilder(false)}
          onSave={(cfg) => { setChartConfig(cfg); setShowGraphBuilder(false); }}
          theme={theme}
          reportData={reportData}
          currentChart={chartConfig}
        />
      )}
      {showCustomBuilder && (
        <CustomReportBuilderModal
          onClose={() => setShowCustomBuilder(false)}
          onRun={handleRunCustomReport}
          theme={theme}
        />
      )}
    </div>
  );
};

export default ReportsView;
