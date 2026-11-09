// "Nothing happens when I click."
//
// The first attempt at this added BusyButton and reached exactly one component, so for
// almost every one of the app's ~846 buttons a click still produced no visible change
// until the response came back. This covers the global indicator instead: one counter at
// the single function every request goes through, and one bar mounted once.
//
// The two timing rules are as much the point as the bar itself. A bar that flashes on
// every fast click is noise, and noise gets ignored — at which point the feedback is worse
// than none.

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import ActivityIndicator from './ActivityIndicator';
import { trackRequest, getInFlight, onActivityChange, __resetActivity } from '../../api/activity';

const APPEAR_AFTER_MS = 150;
const MIN_VISIBLE_MS = 400;

beforeEach(() => {
  jest.useFakeTimers();
  __resetActivity();
});
afterEach(() => {
  jest.useRealTimers();
});

const tick = (ms) => act(() => { jest.advanceTimersByTime(ms); });
const bar = () => screen.queryByRole('status');

describe('the request counter', () => {
  test('counts up and down', () => {
    const doneA = trackRequest('/api/patients');
    expect(getInFlight()).toBe(1);
    const doneB = trackRequest('/api/appointments');
    expect(getInFlight()).toBe(2);
    doneA(); doneB();
    expect(getInFlight()).toBe(0);
  });

  test('settling twice does not drive the count negative', () => {
    // It would stick the indicator on for the rest of the session.
    const done = trackRequest('/api/patients');
    done(); done();
    expect(getInFlight()).toBe(0);
  });

  test('ignores polling, which is not a click', () => {
    // A bar that appears on its own every few seconds teaches people to ignore it.
    const done = trackRequest('/api/notifications?unread=1');
    expect(getInFlight()).toBe(0);
    done();
    expect(getInFlight()).toBe(0);
  });

  test('tells subscribers the current count straight away', () => {
    const seen = [];
    const off = onActivityChange((n) => seen.push(n));
    expect(seen).toEqual([0]);
    const done = trackRequest('/api/patients');
    expect(seen).toEqual([0, 1]);
    done();
    expect(seen).toEqual([0, 1, 0]);
    off();
  });

  test('a listener that throws does not stop the others', () => {
    const good = jest.fn();
    const offBad = onActivityChange(() => { throw new Error('boom'); });
    const offGood = onActivityChange(good);
    good.mockClear();
    const done = trackRequest('/api/patients');
    expect(good).toHaveBeenCalledWith(1);
    done(); offBad(); offGood();
  });
});

describe('the wiring into apiService', () => {
  // The checks above all call trackRequest by hand, so every one of them passes even if
  // apiService never counts anything — which is exactly the state the app was in. This is
  // the check that fails if the counter is not actually hooked up to real requests.
  let fetchSpy;
  afterEach(() => { if (fetchSpy) fetchSpy.mockRestore(); });

  test('a real API call raises the counter while it is in flight', async () => {
    jest.useRealTimers();
    let release;
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ ok: true, status: 200, json: async () => [] });
    }));

    // eslint-disable-next-line global-require
    const api = require('../../api/apiService').default;
    expect(getInFlight()).toBe(0);

    const pending = api.getSubscriptionPlans();
    await waitFor(() => expect(getInFlight()).toBe(1));

    release();
    await pending;
    await waitFor(() => expect(getInFlight()).toBe(0));
  });

  test('the counter comes back down when a real API call FAILS', async () => {
    // Otherwise one failed request leaves the bar on screen for the rest of the session.
    jest.useRealTimers();
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    // eslint-disable-next-line global-require
    const api = require('../../api/apiService').default;
    await expect(api.getSubscriptionPlans()).rejects.toThrow();
    expect(getInFlight()).toBe(0);
  });
});

describe('the indicator', () => {
  test('is not shown while nothing is happening', () => {
    render(<ActivityIndicator theme="light" />);
    expect(bar()).toBeNull();
  });

  test('appears once a request is slow enough to notice', async () => {
    render(<ActivityIndicator theme="light" />);
    const done = trackRequest('/api/patients');

    // Deliberately absent at first: a request that finishes in 120ms does not need a
    // progress bar, and showing one makes a fast app look busy.
    tick(APPEAR_AFTER_MS - 20);
    expect(bar()).toBeNull();

    tick(40);
    await waitFor(() => expect(bar()).not.toBeNull());
    done();
  });

  test('never appears at all for a fast request', () => {
    render(<ActivityIndicator theme="light" />);
    const done = trackRequest('/api/patients');
    tick(60);
    done();
    tick(1000);
    expect(bar()).toBeNull();
  });

  test('stays up for a minimum time once shown, so it cannot flicker', async () => {
    render(<ActivityIndicator theme="light" />);
    const done = trackRequest('/api/patients');
    tick(APPEAR_AFTER_MS + 10);
    await waitFor(() => expect(bar()).not.toBeNull());

    done();
    tick(MIN_VISIBLE_MS - 100);
    expect(bar()).not.toBeNull();        // a one-frame flash reads as a glitch

    tick(150);
    await waitFor(() => expect(bar()).toBeNull());
  });

  test('stays up while a second request is still running', async () => {
    render(<ActivityIndicator theme="light" />);
    const first = trackRequest('/api/patients');
    const second = trackRequest('/api/appointments');
    tick(APPEAR_AFTER_MS + 10);
    await waitFor(() => expect(bar()).not.toBeNull());

    first();
    tick(MIN_VISIBLE_MS + 200);
    expect(bar()).not.toBeNull();

    second();
    tick(MIN_VISIBLE_MS + 200);
    await waitFor(() => expect(bar()).toBeNull());
  });

  test('is announced politely rather than interrupting', async () => {
    render(<ActivityIndicator theme="light" />);
    const done = trackRequest('/api/patients');
    tick(APPEAR_AFTER_MS + 10);
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(bar()).toHaveAttribute('aria-live', 'polite');
    expect(bar()).toHaveAttribute('aria-label', 'Loading');
    done();
  });

  test('does not swallow clicks on whatever is underneath it', async () => {
    render(<ActivityIndicator theme="light" />);
    const done = trackRequest('/api/patients');
    tick(APPEAR_AFTER_MS + 10);
    await waitFor(() => expect(bar()).not.toBeNull());
    // It spans the full width at the top of the window, so without this it would sit over
    // the header and eat clicks on it.
    expect(bar().className).toMatch(/pointer-events-none/);
    done();
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = render(<ActivityIndicator theme="light" />);
    unmount();
    // No "set state on an unmounted component" warning, and no leaked listener holding the
    // component alive for the rest of the session.
    const done = trackRequest('/api/patients');
    tick(APPEAR_AFTER_MS + 10);
    done();
    expect(bar()).toBeNull();
  });
});
