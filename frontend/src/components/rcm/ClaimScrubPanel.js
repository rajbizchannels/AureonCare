import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Sparkles, Info } from 'lucide-react';

/**
 * The result of a claim check (services/claimScrubber.js): errors block submission, warnings are
 * shown, and the AI review — when the practice has switched it on — is advisory.
 */
const HEAD = {
  passed: { Icon: CheckCircle2, cls: 'text-green-500', title: 'No problems found' },
  warnings: { Icon: AlertTriangle, cls: 'text-amber-500', title: 'Can be submitted — please review the warnings' },
  failed: { Icon: XCircle, cls: 'text-red-500', title: 'Fix the errors before submitting' },
};

const ClaimScrubPanel = ({ theme, scrub }) => {
  if (!scrub) return null;
  const dark = theme === 'dark';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const h = HEAD[scrub.status] || HEAD.warnings;
  const errors = (scrub.issues || []).filter((i) => i.severity === 'error');
  const warnings = (scrub.issues || []).filter((i) => i.severity === 'warning');
  const Row = ({ i, tone }) => (
    <li className={`rounded-md p-3 text-sm ${tone === 'error'
      ? (dark ? 'bg-red-500/10 text-red-200' : 'bg-red-50 text-red-800')
      : (dark ? 'bg-amber-500/10 text-amber-100' : 'bg-amber-50 text-amber-900')}`}>
      <p className="font-medium">{i.message}</p>
      {i.fix ? <p className="mt-0.5 opacity-80">{i.fix}</p> : null}
    </li>
  );
  return (
    <div className="space-y-3" data-testid="claim-scrub">
      <div className={`flex items-center gap-2 font-semibold ${h.cls}`}>
        <h.Icon className="w-5 h-5" />{h.title}
        <span className={`text-xs font-normal ${muted}`}>{scrub.errors} error{scrub.errors === 1 ? '' : 's'} · {scrub.warnings} warning{scrub.warnings === 1 ? '' : 's'}</span>
      </div>
      {errors.length ? <ul className="space-y-2">{errors.map((i, n) => <Row key={`e${n}`} i={i} tone="error" />)}</ul> : null}
      {warnings.length ? <ul className="space-y-2">{warnings.map((i, n) => <Row key={`w${n}`} i={i} tone="warning" />)}</ul> : null}
      {scrub.ai && scrub.ai.status === 'ok' ? (
        <div className={`rounded-md border p-3 text-sm ${dark ? 'border-violet-500/30 bg-violet-500/10 text-violet-100' : 'border-violet-200 bg-violet-50 text-violet-900'}`}>
          <p className="flex items-center gap-1.5 font-medium"><Sparkles className="w-4 h-4" />AI review — suggestions, check before acting</p>
          <div className="mt-1 whitespace-pre-wrap">{scrub.ai.text}</div>
        </div>
      ) : scrub.ai && scrub.ai.status !== 'skipped' ? (
        <p className={`flex items-center gap-1.5 text-xs ${muted}`}><Info className="w-3.5 h-3.5" />{scrub.ai.message}</p>
      ) : null}
    </div>
  );
};

export default ClaimScrubPanel;
