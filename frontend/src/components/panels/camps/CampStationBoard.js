import React, { useState, useEffect, useCallback } from 'react';
import { Play, Check, Clock, RefreshCw, ShieldAlert, Users } from 'lucide-react';

import ThemedSelect from '../../forms/ThemedSelect';

/** Seconds → "4m 12s", for wait and service times that are read at a glance. */
const dur = (s) => {
  if (s == null) return '—';
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return '—';
  const m = Math.floor(n / 60);
  return m > 0 ? `${m}m ${n % 60}s` : `${n}s`;
};

/**
 * CampStationBoard — what each station is working through right now.
 *
 * The board is the camp's operational view: queue depth per station and the longest wait,
 * so whoever is running the camp can see where it is backing up. Picking a station shows
 * its queue, and each attendee can be started and completed from there.
 */
const CampStationBoard = ({ theme, t = {}, api, camp, addNotification }) => {
  const dark = theme === 'dark';
  const sub = dark ? 'text-gray-400' : 'text-gray-600';
  const card = dark ? 'bg-gray-800' : 'bg-white';

  const [board, setBoard] = useState([]);
  const [stationId, setStationId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState({}); // visitId -> outcome

  const notify = useCallback((m, type) => addNotification && addNotification(m, type), [addNotification]);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getCampBoard(camp.id);
      setBoard(rows);
      setStationId((cur) => cur || (rows[0] && rows[0].id) || null);
    } catch (err) {
      notify(err.message || 'Failed to load the board', 'error');
    } finally { setLoading(false); }
  }, [api, camp.id, notify]);

  const loadQueue = useCallback(async () => {
    if (!stationId) { setQueue([]); return; }
    try {
      setQueue(await api.getCampStationQueue(stationId));
    } catch (err) {
      notify(err.message || 'Failed to load the station queue', 'error');
    }
  }, [api, stationId, notify]);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const refresh = async () => { await loadBoard(); await loadQueue(); };

  const start = async (v) => {
    try {
      await api.startCampVisit(v.id);
      await refresh();
    } catch (err) {
      // The consent gate surfaces here: a clinical station refuses an unconsented attendee.
      notify(err.message || 'Failed to start', 'error');
    }
  };

  const complete = async (v) => {
    try {
      await api.completeCampVisit(v.id, { outcome: outcome[v.id] || undefined });
      setOutcome((p) => ({ ...p, [v.id]: undefined }));
      await refresh();
    } catch (err) {
      notify(err.message || 'Failed to complete', 'error');
    }
  };

  const selected = board.find((s) => s.id === stationId);

  return (
    <div className={`space-y-6 ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h4 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />{t.campBoard || 'Station board'}
        </h4>
        <button onClick={refresh} disabled={loading}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{t.refresh || 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {board.length === 0 && (
          <p className={`text-sm ${sub}`}>{t.campNoStations || 'No stations defined yet.'}</p>
        )}
        {board.map((s) => (
          <button key={s.id} onClick={() => setStationId(s.id)}
            className={`text-left p-4 rounded-lg shadow ${card} border-2 ${
              s.id === stationId ? 'border-blue-500' : 'border-transparent'}`}>
            <p className="text-sm font-medium">
              <span className={`mr-2 text-xs ${sub}`}>#{s.stepOrder}</span>{s.name}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{s.queued}</p>
            <p className={`text-xs ${sub}`}>{t.campWaiting || 'waiting'}</p>
            <p className={`text-xs mt-2 ${sub}`}>
              {(t.campInProgressCount || '{n} in progress').replace('{n}', s.inProgress)} ·{' '}
              {(t.campCompletedCount || '{n} done').replace('{n}', s.completed)}
            </p>
            {s.longestWaitSeconds != null && s.queued > 0 && (
              <p className="text-xs mt-1 text-amber-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {(t.campLongestWait || 'longest wait {d}').replace('{d}', dur(s.longestWaitSeconds))}
              </p>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div className={`rounded-lg shadow ${card}`}>
          <div className={`p-4 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h5 className="font-medium">{selected.name}</h5>
            {selected.isClinical && (
              <p className={`text-xs mt-1 ${sub}`}>
                {t.campClinicalStationNote || 'Clinical station — an attendee without recorded consent cannot be started here.'}
              </p>
            )}
          </div>
          <div className={`divide-y ${dark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {queue.length === 0 && (
              <p className={`p-4 text-sm ${sub}`}>{t.campQueueEmpty || 'Nobody waiting at this station.'}</p>
            )}
            {queue.map((v) => (
              <div key={v.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="tabular-nums text-blue-600">#{v.tokenNo}</span>
                    {v.fullName}
                    {!v.consentGivenAt && (
                      <ShieldAlert className="w-4 h-4 text-amber-600"
                        title={t.campConsentMissing || 'No consent on record'} />
                    )}
                  </p>
                  <p className={`text-xs ${sub}`}>
                    {[v.ageYears != null ? `${v.ageYears}y` : null, v.gender].filter(Boolean).join(' · ')}
                    {' · '}{v.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {v.status === 'queued' && (
                    <button onClick={() => start(v)}
                      className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                      <Play className="w-4 h-4" />{t.campStart || 'Start'}
                    </button>
                  )}
                  {v.status === 'in_progress' && (
                    <>
                      <ThemedSelect theme={theme} value={outcome[v.id] || ''}
                        onChange={(e) => setOutcome({ ...outcome, [v.id]: e.target.value })}>
                        <option value="">{t.campOutcome || 'Outcome…'}</option>
                        <option value="normal">{t.campOutcomeNormal || 'Normal'}</option>
                        <option value="referred">{t.campOutcomeReferred || 'Referred'}</option>
                        <option value="follow_up">{t.campOutcomeFollowUp || 'Follow-up'}</option>
                        <option value="declined">{t.campOutcomeDeclined || 'Declined'}</option>
                        <option value="no_show">{t.campOutcomeNoShow || 'No show'}</option>
                      </ThemedSelect>
                      <button onClick={() => complete(v)}
                        className="px-3 py-1.5 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 flex items-center gap-2">
                        <Check className="w-4 h-4" />{t.campComplete || 'Done'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampStationBoard;
