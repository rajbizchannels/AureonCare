import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, MessageCircle, Info, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

/**
 * My notifications — each staff member picks, per notification and per channel (in the app,
 * email, WhatsApp), what they receive. The server lists only notifications the person's role
 * is eligible for (e.g. low-stock alerts only for people who can reorder) and refuses any
 * other, so this page never offers a switch that would not work.
 *
 * Each switch saves on its own; a channel the person cannot receive yet (no email / mobile
 * number on their profile) is shown but disabled, with the reason.
 */
const CHANNEL_ICONS = { in_app: Bell, email: Mail, whatsapp: MessageCircle };

// Same switch as the Integrations page (ToggleRight green = on, ToggleLeft grey = off), kept
// as a real switch for screen readers and the keyboard.
const Switch = ({ on, disabled, busy, onClick, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!on}
    aria-label={label}
    disabled={disabled || busy}
    onClick={onClick}
    title={disabled ? undefined : on ? 'Disable' : 'Enable'}
    className={`relative inline-flex items-center transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500
      ${disabled || busy ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
  >
    {on
      ? <ToggleRight className="w-6 h-6 text-green-400" />
      : <ToggleLeft className={`w-6 h-6 ${disabled ? 'text-gray-600' : 'text-gray-400'}`} />}
    {busy ? <Loader2 className="absolute -right-6 w-4 h-4 animate-spin text-cyan-500" /> : null}
  </button>
);

const NotificationSettingsView = ({ theme, t = {}, api, addNotification }) => {
  const dark = theme === 'dark';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({}); // "event|channel" -> true

  const load = useCallback(async () => {
    try { setError(null); setData(await api.getNotificationSettings()); }
    catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const out = [];
    for (const ev of (data && data.events) || []) {
      let g = out.find((x) => x.name === ev.group);
      if (!g) { g = { name: ev.group, events: [] }; out.push(g); }
      g.events.push(ev);
    }
    return out;
  }, [data]);

  const save = async (changes, label) => {
    const keys = changes.map((c) => `${c.event}|${c.channel}`);
    setSaving((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    // Optimistic: flip now, put back if the server refuses.
    const before = data;
    setData((d) => ({ ...d, events: d.events.map((ev) => {
      const mine = changes.filter((c) => c.event === ev.key);
      if (!mine.length) return ev;
      const channels = { ...ev.channels };
      for (const c of mine) channels[c.channel] = { ...channels[c.channel], enabled: c.enabled, isDefault: false };
      return { ...ev, channels };
    }) }));
    try {
      setData(await api.saveNotificationSettings(changes));
      if (label) addNotification && addNotification('success', label);
    } catch (e) {
      setData(before);
      addNotification && addNotification('alert', e.message);
    } finally {
      setSaving((s) => { const n = { ...s }; keys.forEach((k) => delete n[k]); return n; });
    }
  };

  const setAll = (channel, enabled) => {
    const changes = ((data && data.events) || [])
      .filter((ev) => ev.channels[channel] && ev.channels[channel].offered && ev.channels[channel].available && ev.channels[channel].enabled !== enabled)
      .map((ev) => ({ event: ev.key, channel, enabled }));
    if (!changes.length) return;
    const ch = data.channels.find((c) => c.key === channel);
    save(changes, `${ch ? ch.label : channel}: all ${enabled ? 'on' : 'off'}`);
  };

  const card = dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const muted = dark ? 'text-slate-400' : 'text-gray-600';
  const strong = dark ? 'text-white' : 'text-gray-900';

  if (error) {
    return (
      <div className={`rounded-xl border p-6 ${card}`}>
        <p className="text-red-500">{error}</p>
        <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 text-white">Try again</button>
      </div>
    );
  }
  if (!data) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;

  const unavailable = (data.channels || []).filter((c) => c.key !== 'in_app'
    && data.events.some((ev) => ev.channels[c.key] && ev.channels[c.key].offered && !ev.channels[c.key].available));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className={`text-2xl font-bold ${strong}`}>{t.myNotifications || 'My notifications'}</h1>
        <p className={`mt-1 ${muted}`}>
          Choose what you are told about and how. Only notifications your role receives are listed; each switch saves straight away.
        </p>
      </div>

      {unavailable.length ? (
        <div className={`flex gap-3 rounded-xl border p-4 ${dark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-300 bg-amber-50'}`}>
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className={`text-sm ${dark ? 'text-amber-200' : 'text-amber-800'}`}>
            {unavailable.map((c) => c.key === 'email' ? 'Add an email address' : 'Add a mobile number').join(' and ')} to your profile to receive {unavailable.map((c) => c.label).join(' and ')} notifications.
          </p>
        </div>
      ) : null}

      {!data.events.length ? (
        <div className={`rounded-xl border p-8 text-center ${card}`}>
          <Bell className={`w-10 h-10 mx-auto mb-3 ${muted}`} />
          <p className={`font-medium ${strong}`}>Nothing to set up for your role</p>
          <p className={`text-sm mt-1 ${muted}`}>None of the notifications AureonCare sends to staff apply to your role.</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-x-auto ${card}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={dark ? 'border-b border-slate-700' : 'border-b border-gray-200'}>
                <th scope="col" className={`text-left font-semibold px-4 py-3 ${strong}`}>Notification</th>
                {data.channels.map((c) => {
                  const Icon = CHANNEL_ICONS[c.key] || Bell;
                  const any = data.events.some((ev) => ev.channels[c.key] && ev.channels[c.key].offered && ev.channels[c.key].available);
                  return (
                    <th key={c.key} scope="col" className={`px-4 py-3 text-center font-semibold ${strong}`}>
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4" />{c.label}</span>
                        {any ? (
                          <span className={`text-xs font-normal ${muted}`}>
                            <button type="button" className="underline hover:text-cyan-500" onClick={() => setAll(c.key, true)}>All on</button>
                            {' · '}
                            <button type="button" className="underline hover:text-cyan-500" onClick={() => setAll(c.key, false)}>All off</button>
                          </span>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.name}>
                <tr>
                  <th colSpan={1 + data.channels.length} scope="colgroup"
                    className={`text-left text-xs uppercase tracking-wide px-4 pt-4 pb-1 ${muted}`}>{g.name}</th>
                </tr>
                {g.events.map((ev) => (
                  <tr key={ev.key} className={dark ? 'border-t border-slate-700/60' : 'border-t border-gray-100'}>
                    <td className="px-4 py-3">
                      <div className={strong}>{ev.label}</div>
                      {ev.note ? <div className={`text-xs mt-0.5 ${muted}`}>{ev.note}</div> : null}
                    </td>
                    {data.channels.map((c) => {
                      const ch = ev.channels[c.key] || { offered: false };
                      if (!ch.offered) return <td key={c.key} className={`px-4 py-3 text-center ${muted}`} title="Not sent this way">—</td>;
                      const k = `${ev.key}|${c.key}`;
                      return (
                        <td key={c.key} className="px-4 py-3">
                          <div className="flex justify-center" title={!ch.available ? (c.key === 'email' ? 'No email address on your profile' : 'No mobile number on your profile') : undefined}>
                            <Switch theme={theme} on={ch.enabled && ch.available} disabled={!ch.available} busy={!!saving[k]}
                              label={`${ev.label} — ${c.label}`}
                              onClick={() => save([{ event: ev.key, channel: c.key, enabled: !ch.enabled }])} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <p className={`text-xs ${muted}`}>
        Patients&apos; notifications are not affected — they choose theirs in the patient portal. Messages to the practice&apos;s contact address are set under Clinic Settings.
      </p>
    </div>
  );
};

export default NotificationSettingsView;
