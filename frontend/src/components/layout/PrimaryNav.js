import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Pane 1 of the app shell — the workspace rail.
 *
 * Holds one entry per navigation group. Selecting an entry moves the shell to
 * that group's default module and repopulates pane 2 with its sub-modules.
 * Collapses to an icon-only rail so pane 3 can take the space back.
 */
const PrimaryNav = ({
  theme,
  groups,
  activeGroupId,
  onSelectGroup,
  collapsed,
  onToggleCollapsed,
}) => {
  const dark = theme === 'dark';

  const topGroups = groups.filter((group) => group.placement !== 'bottom');
  const bottomGroups = groups.filter((group) => group.placement === 'bottom');

  const renderGroup = (group) => {
    const Icon = group.icon;
    const active = group.id === activeGroupId;

    return (
      <button
        key={group.id}
        onClick={() => onSelectGroup(group)}
        title={collapsed ? group.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative w-full flex items-center rounded-xl transition-colors ${
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
        } ${
          active
            ? dark
              ? 'bg-slate-800 text-white'
              : 'bg-white text-gray-900 shadow-sm'
            : dark
              ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
        }`}
      >
        {/* Active marker, flush with the rail edge */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all ${
            active ? 'h-6 bg-gradient-to-b ' + group.color : 'h-0 bg-transparent'
          }`}
        />
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-colors ${
            active
              ? `bg-gradient-to-br ${group.color} text-white`
              : dark
                ? 'bg-slate-800/70 text-slate-400 group-hover:text-slate-100'
                : 'bg-gray-100 text-gray-500 group-hover:text-gray-900'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
        {!collapsed && <span className="text-sm font-medium truncate">{group.label}</span>}
      </button>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className={`flex flex-col h-full border-r ${collapsed ? 'w-[72px]' : 'w-60'} transition-[width] duration-200 ${
        dark ? 'bg-slate-900/70 border-slate-800' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {topGroups.map(renderGroup)}
      </div>

      {bottomGroups.length > 0 && (
        <div className={`px-3 py-3 space-y-1 border-t ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
          {bottomGroups.map(renderGroup)}
        </div>
      )}

      {onToggleCollapsed && (
      <div className={`px-3 py-3 border-t ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={`w-full flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
            collapsed ? 'justify-center' : 'gap-2'
          } ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
      )}
    </nav>
  );
};

export default PrimaryNav;
