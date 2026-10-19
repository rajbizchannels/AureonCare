import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, ShieldCheck, RefreshCw, TrendingUp } from 'lucide-react';

/**
 * CampDashboardPanel — outcomes, throughput, referral conversion, and the sponsor export.
 *
 * The two reports are separate on purpose. The internal one is ordinary PHI. The sponsor
 * one is aggregates only, built by its own endpoint with an allowlisted projection, and
 * groups smaller than the minimum bucket size are combined — in a camp of eighty people a
 * count of one plus local knowledge identifies somebody. The panel says so on screen,
 * because whoever presses Export is the person accountable for sending it.
 */
const CampDashboardPanel = ({ theme, t = {}, api, camp, user, addNotification }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';

  const [report, setReport] = useState(null);
  const [sponsor, setSponsor] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = user && user.role === 'admin';
  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await api.getCampReport(camp.id));
    } catch (err) {
      notify(err.message || 'Failed to load the camp report', 'error');
    } finally { setLoading(false); }
  }, [api, camp.id, notify]);

  useEffect(() => { load(); }, [load]);

  const loadSponsor = async () => {
    try {
      setSponsor(await api.getCampSponsorReport(camp.id));
    } catch (err) {
      notify(err.message || 'Failed to build the sponsor report', 'error');
    }
  };

  const downloadSponsor = () => {
    if (!sponsor) return;
    const blob = new Blob([JSON.stringify(sponsor, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camp-${camp.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-sponsor-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Stat = ({ label, value, hint }) => (
    <div className={`p-4 rounded-lg shadow ${card}`}>
      <p className={`text-xs ${sub}`}>{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value ?? '—'}</p>
      {hint && <p className={`text-xs mt-1 ${sub}`}>{hint}</p>}
    </div>
  );

  const totals = report && report.totals;

  return (
    <div className={`space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h4 className="font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />{t.campReport || 'Camp outcomes'}
        </h4>
        <button onClick={load} disabled={loading}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{t.refresh || 'Refresh'}
        </button>
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label={t.campAttendees || 'Attendees'} value={totals.registrations} />
          <Stat label={t.campConsented || 'Consented'} value={totals.consented} />
          <Stat label={t.campPatientRecords || 'Patient records'} value={totals.promoted}
            hint={t.campPromotedHint || 'promoted from registrations'} />
          <Stat label={t.campCompleted || 'Completed'} value={totals.completed} />
          <Stat label={t.campLeftEarly || 'Left early'} value={totals.leftEarly} />
        </div>
      )}

      {report && report.referrals && (
        <div className={`p-4 rounded-lg shadow ${card}`}>
          <h5 className="font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />{t.campReferralConversion || 'Referral conversion'}
          </h5>
          <p className={`text-xs mt-1 ${sub}`}>
            {t.campReferralHint || 'Camp attendees who went on to book at the practice — the reason a camp pays for itself.'}
          </p>
          <div className="mt-3 flex gap-8">
            <div>
              <p className="text-2xl font-bold tabular-nums">{report.referrals.referredAttendees ?? 0}</p>
              <p className={`text-xs ${sub}`}>{t.campReferredAttendees || 'with a patient record'}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{report.referrals.followUpAppointments ?? 0}</p>
              <p className={`text-xs ${sub}`}>{t.campFollowUpAppointments || 'follow-up appointments'}</p>
            </div>
          </div>
        </div>
      )}

      {report && (report.stations || []).length > 0 && (
        <div className={`rounded-lg shadow ${card}`}>
          <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h5 className="font-medium">{t.campThroughput || 'Station throughput'}</h5>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={sub}>
                <tr className="text-left text-xs">
                  <th className="p-3">{t.campStation || 'Station'}</th>
                  <th className="p-3">{t.campVisits || 'Visits'}</th>
                  <th className="p-3">{t.campCompleted || 'Completed'}</th>
                  <th className="p-3">{t.campAvgWait || 'Avg wait'}</th>
                  <th className="p-3">{t.campAvgService || 'Avg service'}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {report.stations.map((s) => (
                  <tr key={s.station}>
                    <td className="p-3">{s.station}</td>
                    <td className="p-3 tabular-nums">{s.visits}</td>
                    <td className="p-3 tabular-nums">{s.completed}</td>
                    <td className="p-3 tabular-nums">{s.avgWaitSeconds != null ? `${Math.round(s.avgWaitSeconds / 60)}m` : '—'}</td>
                    <td className="p-3 tabular-nums">{s.avgServiceSeconds != null ? `${Math.round(s.avgServiceSeconds / 60)}m` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report && report.cost && (
        <div className={`p-4 rounded-lg shadow ${card}`}>
          <h5 className="font-medium">{t.campCost || 'Cost'}</h5>
          <p className={`text-xs mt-1 ${sub}`}>
            {t.campCostHint || 'Camps are normally free or sponsor-funded, so this is the budget against the stock actually consumed — not a revenue line.'}
          </p>
          <div className="mt-3 flex gap-8 text-sm">
            <div><span className={sub}>{t.campBudget || 'Budget'}: </span>{camp.budget ?? '—'} {camp.currency || ''}</div>
            <div><span className={sub}>{t.campStockConsumed || 'Stock consumed'}: </span>{report.cost.consumedCost}</div>
            <div><span className={sub}>{t.campStockIssuedValue || 'Stock issued'}: </span>{report.cost.issuedCost}</div>
          </div>
        </div>
      )}

      {/* ── sponsor export ── */}
      <div className={`rounded-lg shadow ${card}`}>
        <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h5 className="font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />{t.campSponsorReport || 'Sponsor report'}
          </h5>
          <p className={`text-xs mt-1 ${sub}`}>
            {t.campSponsorHint || 'Counts only. No names, contact details, dates of birth or clinical notes — and small groups are combined so a single case cannot identify anyone. Every export is recorded in the audit log.'}
          </p>
        </div>
        <div className="p-4 space-y-3">
          {!isAdmin && (
            <p className={`text-sm ${sub}`}>
              {t.campSponsorAdminOnly || 'Only an administrator can produce the sponsor report.'}
            </p>
          )}
          {isAdmin && !sponsor && (
            <button onClick={loadSponsor}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
              {t.campBuildSponsorReport || 'Build sponsor report'}
            </button>
          )}
          {sponsor && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label={t.campAttendees || 'Attendees'} value={sponsor.attendance.attendees} />
                <Stat label={t.campCompletedPipeline || 'Completed pipeline'} value={sponsor.attendance.completedPipeline} />
                <Stat label={t.campReferralsMade || 'Referrals made'} value={sponsor.referralsMade} />
                <Stat label={t.campMinBucket || 'Min group size'} value={sponsor.disclosure.minimumBucketSize} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                {[
                  [t.campAgeBands || 'Age bands', sponsor.ageBands, 'band', 'count'],
                  [t.gender || 'Gender', sponsor.gender, 'gender', 'count'],
                  [t.campConditionsScreened || 'Conditions screened', sponsor.conditionsScreened, 'condition', 'count'],
                ].map(([title, rows, labelKey, valueKey]) => (
                  <div key={title}>
                    <p className={`text-xs mb-1 ${sub}`}>{title}</p>
                    <ul className="space-y-1">
                      {(rows || []).length === 0 && <li className={`text-xs ${sub}`}>—</li>}
                      {(rows || []).map((r) => (
                        <li key={r[labelKey]} className="flex justify-between">
                          <span>{r[labelKey]}</span><span className="tabular-nums">{r[valueKey]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button onClick={downloadSponsor}
                className="px-3 py-2 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 flex items-center gap-2">
                <Download className="w-4 h-4" />{t.campDownloadSponsorReport || 'Download for the sponsor'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampDashboardPanel;
