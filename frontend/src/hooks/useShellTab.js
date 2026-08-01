import { useState } from 'react';

/**
 * Sub-module tab state for a module view.
 *
 * When the three-pane app shell drives the module (it passes `controlledTab`
 * plus `onTabChange`), the shell's secondary pane *is* the tab strip and the
 * view should hide its own. Rendered outside the shell — inside a modal, a
 * portal page, a test — the view falls back to owning the state itself.
 *
 * @returns {[string, (tab: string) => void, boolean]} active tab, setter, and
 *          whether the shell owns the tabs (i.e. hide the in-view tab strip).
 */
export const useShellTab = (controlledTab, onTabChange, fallbackTab) => {
  const [internalTab, setInternalTab] = useState(controlledTab || fallbackTab);

  const isControlled = typeof onTabChange === 'function' && controlledTab != null;
  const activeTab = isControlled ? controlledTab : internalTab;

  const setActiveTab = (tab) => {
    if (isControlled) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return [activeTab, setActiveTab, isControlled];
};

export default useShellTab;
