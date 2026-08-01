import React from 'react';
import { ChevronDown, ChevronRight, ChevronsRight, PanelLeftClose } from 'lucide-react';

/**
 * Pane 2 of the app shell — the sub-module list for the active group.
 *
 * Sections keep related sub-modules together (e.g. Billing → Revenue Cycle /
 * Patient Billing / Setup), which is how the modules were regrouped for the
 * redesign. Items may also carry `children`, which render as a nested branch:
 * that is reserved for sub-modules that are genuinely a drill-down from their
 * parent rather than a sibling of it. The pane collapses to an icon strip, like
 * the rail, and the shell skips it entirely when a group has one destination.
 */
const SecondaryNav = ({
  theme,
  group,
  activeItemId,
  onSelectItem,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const dark = theme === 'dark';

  // Branches open themselves when the active item is the parent or anywhere
  // beneath it; an explicit toggle wins over that until the user navigates
  // elsewhere in the branch.
  const [toggled, setToggled] = React.useState({});

  const holdsActive = React.useCallback(
    (item) =>
      item.id === activeItemId ||
      (item.children || []).some((child) => holdsActive(child)),
    [activeItemId]
  );

  if (!group) return null;

  const GroupIcon = group.icon;

  const renderCollapsedItem = (item) => {
    const Icon = item.icon;
    const active = item.id === activeItemId;
    const isGroupingOnly = item.children?.length && !item.module && !item.action;

    return (
      <React.Fragment key={item.id}>
        {!isGroupingOnly && (
          <button
            onClick={() => onSelectItem(item)}
            title={item.label}
            aria-current={active ? 'page' : undefined}
            className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-colors ${
              active
                ? dark ? 'bg-slate-800 text-cyan-400' : 'bg-gray-100 text-blue-600'
                : dark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" />
          </button>
        )}
        {(item.children || []).map(renderCollapsedItem)}
      </React.Fragment>
    );
  };

  const renderItem = (item, depth) => {
    const Icon = item.icon;
    const active = item.id === activeItemId;
    const hasChildren = item.children && item.children.length > 0;
    const expanded = hasChildren && (toggled[item.id] ?? holdsActive(item));
    // A branch with no destination of its own (e.g. a report category) exists
    // only to group its children, so its label toggles rather than navigates.
    const isGroupingOnly = hasChildren && !item.module && !item.action;
    const toggle = () => setToggled((prev) => ({ ...prev, [item.id]: !expanded }));

    return (
      <React.Fragment key={item.id}>
        <div className="flex items-stretch">
          <button
            onClick={() => (isGroupingOnly ? toggle() : onSelectItem(item))}
            aria-current={active ? 'page' : undefined}
            aria-expanded={isGroupingOnly ? expanded : undefined}
            style={{ paddingLeft: `${12 + depth * 18}px` }}
            className={`flex-1 min-w-0 flex items-start gap-2.5 pr-2 py-2 rounded-lg text-left transition-colors ${
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
              <span className={`block truncate ${depth > 0 ? 'text-[13px]' : 'text-sm font-medium'}`}>
                {item.label}
              </span>
              {item.description && (
                <span className={`block text-xs truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {item.description}
                </span>
              )}
            </span>
          </button>

          {hasChildren && (
            <button
              onClick={toggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
              className={`px-1.5 rounded-lg transition-colors ${
                dark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {expanded && item.children.map((child) => renderItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <nav
      aria-label={`${group.label} sections`}
      className={`${collapsed ? 'w-[60px]' : 'w-64'} flex-shrink-0 flex flex-col h-full border-r transition-[width] duration-200 ${
        dark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-gray-200'
      }`}
    >
      <div
        className={`flex items-center gap-2 h-14 flex-shrink-0 border-b ${collapsed ? 'justify-center px-2' : 'px-4'} ${
          dark ? 'border-slate-800' : 'border-gray-200'
        }`}
      >
        <span
          title={collapsed ? group.label : undefined}
          className={`flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${group.color} text-white flex-shrink-0`}
        >
          <GroupIcon className="w-4 h-4" />
        </span>
        {!collapsed && (
          <>
            <h2 className={`flex-1 text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
              {group.label}
            </h2>
            {onToggleCollapsed && (
              <button
                onClick={onToggleCollapsed}
                title="Collapse this pane"
                className={`p-1.5 rounded-lg transition-colors ${
                  dark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2 space-y-1' : 'px-2 space-y-4'}`}>
        {collapsed
          ? group.sections.map((section) => (
              <div key={section.id} className="space-y-1">
                {section.items.map(renderCollapsedItem)}
              </div>
            ))
          : group.sections.map((section) => (
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
                <div className="space-y-0.5">{section.items.map((item) => renderItem(item, 0))}</div>
              </div>
            ))}
      </div>

      {collapsed && onToggleCollapsed && (
        <div className={`px-2 py-3 border-t ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
          <button
            onClick={onToggleCollapsed}
            title="Expand this pane"
            className={`w-full flex items-center justify-center py-2 rounded-lg transition-colors ${
              dark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
};

export default SecondaryNav;
