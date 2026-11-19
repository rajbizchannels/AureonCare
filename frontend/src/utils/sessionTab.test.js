// SEC-40 session policy helpers: reload detection and finding other signed-in tabs.
import { wasThisTabReloaded, markTabAlive, RELOAD_WINDOW_MS } from './sessionTab';

beforeEach(() => sessionStorage.clear());

test('a fresh tab (nothing remembered) is not a reload', () => {
  expect(wasThisTabReloaded()).toBe(false);
});

test('a page load moments after this tab was open is a reload', () => {
  markTabAlive(1_000_000);
  expect(wasThisTabReloaded(1_000_000 + 2_000)).toBe(true);
});

test('an old marker — a browser restored later — is a new session', () => {
  markTabAlive(1_000_000);
  expect(wasThisTabReloaded(1_000_000 + RELOAD_WINDOW_MS + 1)).toBe(false);
});

test('a marker from the future (clock change) is not trusted', () => {
  markTabAlive(2_000_000);
  expect(wasThisTabReloaded(1_000_000)).toBe(false);
});

describe('other tabs', () => {
  // A minimal in-process BroadcastChannel: every instance with the same name hears the
  // others' messages, never its own — as in a browser.
  class FakeChannel {
    static all = [];
    constructor(name) { this.name = name; this.listeners = []; FakeChannel.all.push(this); }
    postMessage(data) {
      FakeChannel.all.filter((c) => c !== this && c.name === this.name)
        .forEach((c) => setTimeout(() => c.listeners.forEach((l) => l({ data })), 0));
    }
    addEventListener(_t, l) { this.listeners.push(l); }
    removeEventListener(_t, l) { this.listeners = this.listeners.filter((x) => x !== l); }
  }

  const load = () => {
    let mod;
    jest.isolateModules(() => { mod = require('./sessionTab'); });
    return mod;
  };

  beforeEach(() => { FakeChannel.all = []; global.BroadcastChannel = FakeChannel; });
  afterEach(() => { delete global.BroadcastChannel; });

  test('with no other tab answering, there is no signed-in tab', async () => {
    const me = load();
    await expect(me.anotherSignedInTab(50)).resolves.toBe(false);
  });

  test('a signed-in tab that answers the ping is found', async () => {
    const other = load(); const me = load();
    other.onTabMessage((m) => { if (m.type === 'ping') other.broadcast({ type: 'pong', nonce: m.nonce }); });
    await expect(me.anotherSignedInTab(200)).resolves.toBe(true);
  });

  test('a tab does not hear its own messages', async () => {
    const me = load();
    const heard = [];
    me.onTabMessage((m) => heard.push(m));
    me.broadcast({ type: 'session', userId: 'u1' });
    await new Promise((r) => setTimeout(r, 20));
    expect(heard).toHaveLength(0);
  });

  test('without BroadcastChannel the safe answer is "no other tab"', async () => {
    delete global.BroadcastChannel;
    const me = load();
    await expect(me.anotherSignedInTab(20)).resolves.toBe(false);
  });
});
