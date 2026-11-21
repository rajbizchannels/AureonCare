import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RotateCcw, AlertCircle, Search, ShieldCheck } from 'lucide-react';

/**
 * Fine-grained permissions for every module.
 *
 * This replaces a hand-written grid per module. There were two of them — Inventory and
 * Accounts — each with its own hardcoded list of roles, resources and actions, its own
 * endpoints, and its own copy of the toggle logic. Nine more modules the same way would
 * have been nine more copies drifting apart from each other and from the server.
 *
 * Everything here is drawn from what the server sends: the modules, their resources, the
 * roles and the six actions all come from the registry, so a module added on the server
 * appears here with no change to this file, and the grid can never offer a switch the
 * server would reject.
 *
 * Two things the old grids got wrong and this does not:
 *
 *   * An unsaved row is shown as what is ACTUALLY ENFORCED (the role default), labelled
 *     "default", rather than as an empty row. The Inventory grid rendered unsaved rows as
 *     all-off, so a practice that had never edited its permissions was told nobody could
 *     do anything — while in fact everybody could.
 *   * A click shows that it is working and reports if it fails. The old toggles updated
 *     optimistically with no feedback at all, so a rejected save looked identical to a
 *     successful one.
 */

const CELL_SIZE = 'w-6 h-6';

const ModulePermissionsTab = ({ theme, api, addNotification, canManage }) => {
  const dark = theme === 'dark';
  const [registry, setRegistry] = useState(null);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Keyed per cell, so one slow save never greys out the whole grid.
  const [busy, setBusy] = useState({});
  const [filter, setFilter] = useState('');
  const [openModule, setOpenModule] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.getModulePermissions();
      setRegistry(data);
      setGrants(data.permissions || []);
      setOpenModule((prev) => prev || (data.modules[0] && data.modules[0].key) || null);
    } catch (e) {
      setError(e.message || 'Could not load permissions.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const actionKey = (action) => `can${action[0].toUpperCase()}${action.slice(1)}`;
  const cellId = (module, role, resource) => `${module}|${role}|${resource}`;

  const grantFor = useCallback((module, role, resource) =>
    grants.find((g) => g.module === module && g.roleName === role && g.resource === resource),
  [grants]);

  const replaceGrant = (next) => setGrants((prev) => {
    const i = prev.findIndex((g) => g.module === next.module
      && g.roleName === next.roleName && g.resource === next.resource);
    return i >= 0 ? prev.map((g, n) => (n === i ? next : g)) : [...prev, next];
  });

  /**
   * Save one cell.
   *
   * All six flags go together. Sending only the one that changed would make the result
   * depend on whether a row already existed, so the same click would mean different things
   * on a fresh practice and an edited one.
   */
  const toggle = async (module, role, resource, action) => {
    if (!canManage) return;
    const current = grantFor(module, role, resource);
    if (!current || current.editable === false) return;
    const id = cellId(module, role, resource);
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const payload = { module, roleName: role, resource };
      for (const a of registry.actions) payload[actionKey(a)] = current[actionKey(a)] === true;
      payload[actionKey(action)] = !current[actionKey(action)];
      replaceGrant(await api.updateModulePermission(payload));
    } catch (e) {
      // Reported rather than swallowed: a rejected save used to look exactly like a
      // successful one, so the grid showed access that the server had refused to change.
      addNotification?.('error', e.message || 'Could not save that permission.');
      setError(e.message || 'Could not save that permission.');
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const reset = async (module, role, resource) => {
    if (!canManage) return;
    const id = cellId(module, role, resource);
    setBusy((b) => ({ ...b, [id]: 'reset' }));
    try {
      replaceGrant(await api.resetModulePermission({ module, roleName: role, resource }));
    } catch (e) {
      addNotification?.('error', e.message || 'Could not reset that row.');
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const modules = useMemo(() => {
    if (!registry) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return registry.modules;
    return registry.modules.filter((m) => m.label.toLowerCase().includes(q)
      || m.key.includes(q)
      || m.resources.some((r) => r.replace(/_/g, ' ').includes(q)));
  }, [registry, filter]);

  const panel = dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200';
  const text = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';

  if (loading) {
    return (
      <div className={`rounded-xl border p-6 ${panel}`}>
        <p className={`flex items-center gap-2 text-sm ${muted}`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading module permissions…
        </p>
      </div>
    );
  }

  if (!registry) {
    return (
      <div className={`rounded-xl border p-6 ${panel}`}>
        <p className="flex items-start gap-2 text-sm text-red-500">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{error || 'Permissions are unavailable.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-6 ${panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className={`text-base font-semibold flex items-center gap-2 ${text}`}>
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            Module Permissions
          </h3>
          <p className={`text-xs mt-0.5 ${muted}`}>
            What each role may do, per module and per resource. A row marked
            <strong className={text}> default</strong> has not been edited and follows the role&apos;s
            built-in access; saving a row pins it.
          </p>
        </div>
        <label className="relative">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter modules…"
            className={`pl-9 pr-3 py-2 text-sm rounded-lg border outline-none focus:border-orange-500 ${
              dark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
          />
        </label>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-500 mb-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{error}
        </p>
      )}
      {!canManage && (
        <p className={`text-xs mb-4 ${muted}`}>You can view these settings but not change them.</p>
      )}

      <div className="space-y-3">
        {modules.map((mod) => {
          const open = openModule === mod.key;
          return (
            <div key={mod.key} className={`rounded-lg border ${dark ? 'border-slate-700' : 'border-gray-200'}`}>
              <button
                type="button"
                onClick={() => setOpenModule(open ? null : mod.key)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${
                  dark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}
              >
                <span className={`text-sm font-medium ${text}`}>{mod.label}</span>
                <span className={`text-xs ${muted}`}>
                  {mod.resources.length} resource{mod.resources.length === 1 ? '' : 's'} · {open ? 'hide' : 'show'}
                </span>
              </button>

              {open && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className={dark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'}>
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Role</th>
                        <th className="px-4 py-2.5 text-left font-medium">Resource</th>
                        {registry.actions.map((a) => (
                          <th key={a} className="px-3 py-2.5 text-center font-medium capitalize">{a}</th>
                        ))}
                        <th className="px-3 py-2.5 text-center font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                      {registry.roles.map((role) => mod.resources.map((resource, ri) => {
                        const g = grantFor(mod.key, role, resource) || {};
                        const id = cellId(mod.key, role, resource);
                        const working = busy[id];
                        const locked = !canManage || g.editable === false;
                        return (
                          <tr key={id} className={dark ? 'hover:bg-slate-700/40' : 'hover:bg-gray-50'}>
                            {ri === 0 && (
                              <td rowSpan={mod.resources.length}
                                  className={`px-4 py-2 font-medium capitalize align-top ${dark ? 'text-slate-200' : 'text-gray-800'}`}>
                                {role.replace(/_/g, ' ')}
                                {g.editable === false && (
                                  <span className={`block text-[10px] font-normal ${muted}`}>always full access</span>
                                )}
                              </td>
                            )}
                            <td className={`px-4 py-2 ${muted}`}>{resource.replace(/_/g, ' ')}</td>
                            {registry.actions.map((action) => {
                              const on = g[actionKey(action)] === true;
                              return (
                                <td key={action} className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    aria-label={`${action} ${resource} as ${role}`}
                                    aria-pressed={on}
                                    disabled={locked || Boolean(working)}
                                    onClick={() => toggle(mod.key, role, resource, action)}
                                    className={`${CELL_SIZE} rounded flex items-center justify-center mx-auto transition-colors ${
                                      on ? 'bg-orange-500 text-white'
                                        : dark ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400'
                                    } ${locked ? 'opacity-50 cursor-not-allowed'
                                      : working ? 'cursor-wait' : 'hover:opacity-80 cursor-pointer'}`}
                                  >
                                    {/* The spinner sits in the cell that was clicked, so it is
                                        obvious which switch is saving rather than the whole row
                                        appearing to freeze. */}
                                    {working === action
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : on ? <Check className="w-3 h-3" /> : null}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center">
                              {g.source === 'stored' ? (
                                <button
                                  type="button"
                                  disabled={locked || Boolean(working)}
                                  onClick={() => reset(mod.key, role, resource)}
                                  title="Reset to the role default"
                                  className={`inline-flex items-center gap-1 text-[11px] ${
                                    locked ? 'opacity-50 cursor-not-allowed' : 'hover:underline cursor-pointer'
                                  } ${dark ? 'text-slate-300' : 'text-gray-600'}`}
                                >
                                  {working === 'reset'
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <RotateCcw className="w-3 h-3" />}
                                  saved
                                </button>
                              ) : (
                                <span className={`text-[11px] ${muted}`}>default</span>
                              )}
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {modules.length === 0 && (
          <p className={`text-sm text-center py-6 ${muted}`}>No module matches “{filter}”.</p>
        )}
      </div>
    </div>
  );
};

export default ModulePermissionsTab;
