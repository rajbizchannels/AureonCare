import React from 'react';
import { PanelLeftClose } from 'lucide-react';

/**
 * Pane 2 of the app shell — the sub-module list for the active group.
 *
 * Sections keep related sub-modules together (e.g. Billing → Revenue Cycle /
 * Patient Billing / Setup), which is how the modules were regrouped for the
 * redesign. The pane is hidden by the shell when a group has a single item.
 */
const SecondaryNav = ({
  theme,
  group,
  activeItemId,
  onSelectItem,
  onHide,
}) => {
  const dark = theme === 'dark';

  if (!group) return null;

  const GroupIcon = group.icon;

  return (
    <nav
      aria-label={`${group.label} sections`}
      className={`w-64 flex-shrink-0 flex flex-col h-full border-r ${
        dark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-gray-200'
      }`}
    >
      <div className={`flex items-center gap-2 px-4 h-14 flex-shrink-0 border-b ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${group.color} text-white flex-shrink-0`}>
          <GroupIcon className="w-4 h-4" />
        </span>
        <h2 className={`flex-1 text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
          {group.label}
        </h2>
        {onHide && (
          <button
            onClick={onHide}
            title="Hide this pane"
            className={`p-1.5 rounded-lg transition-colors ${
              dark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {group.sections.map((section) => (
          <div key={section.id}>
            {section.label && (
              <p
                className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                  dark ? 'text-slate-500' : 'text-gray-400'
                }`}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeItemId;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      active
                        ? dark
                          ? 'bg-slate-800 text-white'
                          : 'bg-gray-100 text-gray-900'
                        : dark
                          ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        active ? (dark ? 'text-cyan-400' : 'text-blue-600') : ''
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{item.label}</span>
                      {item.description && (
                        <span
                          className={`block text-xs truncate ${
                            dark ? 'text-slate-500' : 'text-gray-400'
                          }`}
                        >
                          {item.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
};

export default SecondaryNav;
