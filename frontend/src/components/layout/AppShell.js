import React from 'react';
import { ChevronRight, PanelLeftOpen, X } from 'lucide-react';

import PrimaryNav from './PrimaryNav';
import SecondaryNav from './SecondaryNav';
import TopBar from './TopBar';
import { groupItems } from '../../config/navigation';

const RAIL_STORAGE_KEY = 'aureoncare.nav.railCollapsed';
const SECONDARY_STORAGE_KEY = 'aureoncare.nav.secondaryHidden';

const readFlag = (key) => {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch (e) {
    return false;
  }
};

const writeFlag = (key, value) => {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch (e) {
    /* storage unavailable — the preference just won't persist */
  }
};

/**
 * Three-pane application shell.
 *
 *   ┌───────────────────────── TopBar ─────────────────────────┐
 *   │ rail (groups) │ sub-modules │ content                    │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Pane 2 is skipped for single-item groups so those modules get the full
 * width; it can also be hidden manually and brought back from the content
 * header.
 */
const AppShell = ({
  theme,
  navigation,
  activeGroup,
  activeItem,
  onSelectGroup,
  onSelectItem,
  topBar,
  children,
}) => {
  const dark = theme === 'dark';

  const [railCollapsed, setRailCollapsed] = React.useState(() => readFlag(RAIL_STORAGE_KEY));
  const [secondaryHidden, setSecondaryHidden] = React.useState(() => readFlag(SECONDARY_STORAGE_KEY));
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const toggleRail = () => {
    setRailCollapsed((prev) => {
      writeFlag(RAIL_STORAGE_KEY, !prev);
      return !prev;
    });
  };

  const setSecondary = (hidden) => {
    writeFlag(SECONDARY_STORAGE_KEY, hidden);
    setSecondaryHidden(hidden);
  };

  // A group with a single destination has nothing to list in pane 2.
  const groupHasSubModules = groupItems(activeGroup).length > 1;
  const showSecondary = groupHasSubModules && !secondaryHidden;

  const handleSelectGroup = (group) => {
    onSelectGroup(group);
    setMobileNavOpen(false);
  };

  const handleSelectItem = (item) => {
    onSelectItem(item);
    setMobileNavOpen(false);
  };

  // `compact` forces the icon rail — used inside the mobile drawer so both
  // panes fit on a phone-width screen.
  const renderPanes = ({ compact }) => (
    <>
      <PrimaryNav
        theme={theme}
        groups={navigation}
        activeGroupId={activeGroup?.id}
        onSelectGroup={handleSelectGroup}
        collapsed={compact || railCollapsed}
        onToggleCollapsed={compact ? null : toggleRail}
      />
      {(compact ? groupHasSubModules : showSecondary) && (
        <SecondaryNav
          theme={theme}
          group={activeGroup}
          activeItemId={activeItem?.id}
          onSelectItem={handleSelectItem}
          onHide={compact ? null : () => setSecondary(true)}
        />
      )}
    </>
  );

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${dark ? 'bg-slate-950' : 'bg-gray-100'}`}>
      <TopBar
        {...topBar}
        theme={theme}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Panes 1 + 2 — persistent from lg up */}
        <div className="hidden lg:flex flex-shrink-0">{renderPanes({ compact: false })}</div>

        {/* Panes 1 + 2 — drawer on small screens */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="flex h-full shadow-2xl">{renderPanes({ compact: true })}</div>
            <button
              className="flex-1 bg-black/50"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="w-6 h-6 text-white m-4" />
            </button>
          </div>
        )}

        {/* Pane 3 — content */}
        <main className={`flex-1 min-w-0 flex flex-col ${dark ? 'bg-slate-950' : 'bg-gray-50'}`}>
          {activeItem && (
            <div
              className={`flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 h-14 border-b ${
                dark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-gray-200'
              }`}
            >
              {groupHasSubModules && secondaryHidden && (
                <button
                  onClick={() => setSecondary(false)}
                  title="Show sub-modules"
                  className={`p-1.5 rounded-lg transition-colors ${
                    dark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {activeGroup?.label}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-slate-600' : 'text-gray-300'}`} />
                <span className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {activeItem.label}
                </span>
              </nav>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-6 py-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
