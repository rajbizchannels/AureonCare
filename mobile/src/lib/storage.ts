import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Two stores, deliberately.
 *
 * Credentials go to the Keychain / Android Keystore via SecureStore — the
 * scope doc's rule is that a token never lands in plain preferences. Ordinary
 * preferences (which server, whether biometrics are on) go to AsyncStorage:
 * SecureStore has a small value ceiling and a per-read cost that is not worth
 * paying for a hostname.
 */

const SECRET_KEYS = {
  staffToken: 'aureoncare.auth.jwt',
  portalToken: 'aureoncare.auth.portal',
} as const;

const PREF_KEYS = {
  serverUrl: 'aureoncare.server.url',
  account: 'aureoncare.session.account',
  biometrics: 'aureoncare.pref.biometrics',
} as const;

/** SecureStore throws on some devices (no passcode set); never let that crash a boot. */
const safeSecureGet = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn('[storage] secure read failed', key, error);
    return null;
  }
};

const safeSecureSet = async (key: string, value: string | null): Promise<void> => {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn('[storage] secure write failed', key, error);
  }
};

export const credentials = {
  getStaffToken: () => safeSecureGet(SECRET_KEYS.staffToken),
  getPortalToken: () => safeSecureGet(SECRET_KEYS.portalToken),
  setStaffToken: (v: string | null) => safeSecureSet(SECRET_KEYS.staffToken, v),
  setPortalToken: (v: string | null) => safeSecureSet(SECRET_KEYS.portalToken, v),
  async clear(): Promise<void> {
    await Promise.all([
      safeSecureSet(SECRET_KEYS.staffToken, null),
      safeSecureSet(SECRET_KEYS.portalToken, null),
    ]);
  },
};

export const prefs = {
  async get(key: keyof typeof PREF_KEYS): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PREF_KEYS[key]);
    } catch {
      return null;
    }
  },
  async set(key: keyof typeof PREF_KEYS, value: string | null): Promise<void> {
    try {
      if (value === null) await AsyncStorage.removeItem(PREF_KEYS[key]);
      else await AsyncStorage.setItem(PREF_KEYS[key], value);
    } catch (error) {
      console.warn('[storage] pref write failed', key, error);
    }
  },
};
