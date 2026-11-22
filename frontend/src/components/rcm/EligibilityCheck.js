import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, ShieldAlert, ShieldQuestion, Loader2, RefreshCw } from 'lucide-react';

/**
 * Insurance eligibility for one patient: the latest check that applies (to `serviceDate` when
 * given), and a button to run a new one through the practice's clearinghouse (X12 270/271).
 * Shows what the patient will pay — copay, deductible left, coinsurance, out-of-pocket left —
 * and, when a check cannot be sent, exactly which details are missing.
 */
const STATUS = {
  active: { label: 'Active coverage', Icon: ShieldCheck, tone: 'green' },
  inactive: { label: 'Not active', Icon: ShieldOff, tone: 'red' },
  error: { label: 'Payer could not confirm', Icon: ShieldAlert, tone: 'amber' },
  unknown: { label: 'Unclear', Icon: ShieldQuestion, tone: 'slate' },
};
const TONES = {
  green: 'text-green-500 bg-green-500/10 border-green-500/30',
  red: 'text-red-500 bg-red-500/10 border-red-500/30',
  amber: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  slate: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};
const money = (v) => (v === null || v === undefined ? null : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

const EligibilityCheck = ({ theme, api, patientId, payerId = null, serviceDate = null, claimId = null, onResult }) => {
  const dark = theme === 'dark';
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState(null); // { message, missing }

  const load = useCallback(async () => {
    if (!patientId) { setCheck(null); return; }
    setLoading(true);
    try {
      const c = await api.getLatestEligibility(patientId, { payerId, serviceDate });
      setCheck(c); onResult && onResult(c);
    } catch { setCheck(null); }
    finally { setLoading(false); }
  }, [api, patientId, payerId, serviceDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setProblem(null); load(); }, [load]);

  const run = async () => {
    setRunning(true); setProblem(null);
    try {
      const c = await api.checkEligibility({ patientId, payerId: payerId || undefined, serviceDate: serviceDate || undefined, claimId: claimId || undefined });
      setCheck(c); onResult && onResult(c);
    } catch (e) {
      setProblem({ message: e.message, missing: e.missing || null });
    } finally { setRunning(false); }
  };

  if (!patientId) return null;
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const s = check ? (STATUS[check.status] || STATUS.unknown) : null;
  const cov = (check && check.coverage) || {};
  const facts = check && check.status === 'active' ? [
    ['Copay', money(cov.copay)],
    ['Deductible left', cov.deductible && cov.deductible.remaining !== null ? `${money(cov.deductible.remaining)}${cov.deductible.total !== null ? ` of ${money(cov.deductible.total)}` : ''}` : null],
    ['Coinsurance', cov.coinsurancePercent !== null && cov.coinsurancePercent !== undefined ? `${cov.coinsurancePercent}%` : null],
    ['Out-of-pocket left', cov.outOfPocket && cov.outOfPocket.remaining !== null ? money(cov.outOfPocket.remaining) : null],
    ['Plan', [cov.planName, cov.groupNumber ? `group ${cov.groupNumber}` : null].filter(Boolean).join(', ') || null],
    ['Covered', cov.coverageStart ? `${cov.coverageStart}${cov.coverageEnd ? ` to ${cov.coverageEnd}` : ''}` : null],
  ].filter(([, v]) => v) : [];

  return (
    <div className={`rounded-lg border p-4 ${dark ? 'border-slate-600 bg-slate-800/40' : 'border-gray-200 bg-white'}`} data-testid="eligibility-check">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-cyan-500" /> : null}
          {s ? (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium ${TONES[s.tone]}`}>
              <s.Icon className="w-4 h-4" />{s.label}
            </span>
          ) : !loading ? <span className={`text-sm ${muted}`}>Eligibility not checked yet{serviceDate ? ' for this date' : ''}.</span> : null}
          {check ? <span className={`text-xs ${muted}`}>{check.payerName} · {check.serviceDate} · checked {new Date(check.checkedAt).toLocaleString()}</span> : null}
        </div>
        <button type="button" onClick={run} disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-60">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {check ? 'Check again' : 'Check eligibility'}
        </button>
      </div>

      {check && check.status !== 'active' && check.message ? <p className={`mt-2 text-sm ${muted}`}>{check.message}</p> : null}
      {facts.length ? (
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}><dt className={`text-xs ${muted}`}>{k}</dt><dd className={dark ? 'text-white' : 'text-gray-900'}>{v}</dd></div>
          ))}
        </dl>
      ) : null}

      {problem ? (
        <div className={`mt-3 text-sm rounded-md p-3 ${dark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-800'}`} role="alert">
          <p>{problem.message}</p>
          {problem.missing && problem.missing.length ? (
            <ul className="list-disc ml-5 mt-1">{problem.missing.map((m) => <li key={m}>Add {m}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default EligibilityCheck;
