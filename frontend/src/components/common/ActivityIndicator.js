import React, { useEffect, useState } from 'react';
import { onActivityChange } from '../../api/activity';

/**
 * A thin bar across the top of the window while any API request is in flight.
 *
 * This is the answer to "nothing happens when I click". Per-button spinners are right where
 * a button owns a single action, but there are hundreds of buttons and the first pass at
 * this reached one of them. Every request goes through one function, so one indicator
 * mounted once covers every button in the app — including list refreshes, tab loads,
 * filters and deletes, which have no obvious button to hang a spinner on.
 *
 * Two deliberate choices:
 *
 *   * A DELAY before it appears. A request that finishes in 120ms does not need a progress
 *     bar, and showing one makes a fast app look busy — a flash of movement on every click
 *     is noise, and noise gets ignored. It only appears when something is actually slow
 *     enough to leave the user wondering.
 *   * A MINIMUM visible time once it has appeared. Without it, a request that settles just
 *     after the delay produces a one-frame flicker, which reads as a glitch rather than as
 *     progress.
 *
 * It does not block the page. A modal overlay for a one-field save makes the whole app
 * feel heavier and says nothing about what is happening.
 */

const APPEAR_AFTER_MS = 150;
const MIN_VISIBLE_MS = 400;

const ActivityIndicator = ({ theme }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let appearTimer = null;
    let hideTimer = null;
    let shownAt = 0;

    const unsubscribe = onActivityChange((count) => {
      if (count > 0) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!appearTimer && !shownAt) {
          appearTimer = setTimeout(() => {
            appearTimer = null;
            shownAt = Date.now();
            setVisible(true);
          }, APPEAR_AFTER_MS);
        }
        return;
      }

      // Back to idle.
      if (appearTimer) { clearTimeout(appearTimer); appearTimer = null; }
      if (!shownAt) { setVisible(false); return; }
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
      hideTimer = setTimeout(() => {
        hideTimer = null;
        shownAt = 0;
        setVisible(false);
      }, remaining);
    });

    return () => {
      unsubscribe();
      if (appearTimer) clearTimeout(appearTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      // Announced politely rather than assertively: a screen reader should mention it when
      // it reaches a natural pause, not interrupt what the user is reading.
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none overflow-hidden"
    >
      <div
        className={`h-full w-1/3 rounded-full ac-activity-sweep ${
          theme === 'dark'
            ? 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'
            : 'bg-gradient-to-r from-transparent via-blue-500 to-transparent'
        }`}
      />
      {/* Inline, because the sweep is the one thing this component needs that Tailwind's
          built-in animations do not provide, and a project-wide keyframe for a single use
          is harder to find than a rule next to the element it animates. */}
      <style>{`
        @keyframes ac-activity-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .ac-activity-sweep { animation: ac-activity-sweep 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          /* A steady bar still says "working" without the movement. */
          .ac-activity-sweep { animation: none; width: 100%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default ActivityIndicator;
