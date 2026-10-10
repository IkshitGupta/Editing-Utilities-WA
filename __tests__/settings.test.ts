import {
  DEFAULT_SETTINGS,
  parseSettings,
  parseStoredSettings,
  SETTINGS_REVISION,
} from '@/features/settings/settings';
import type * as SettingsStore from '@/features/settings/store';
import { SCHOOL } from '@/school/defaults';

const mockStorage = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  Storage: {
    getItemSync: (key: string) => mockStorage.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStorage.set(key, value),
  },
}));

// A fresh copy of the store, as after restarting the app.
function startApp(): typeof SettingsStore {
  let store: typeof SettingsStore | undefined;
  jest.isolateModules(() => {
    store = require('@/features/settings/store');
  });
  return store!;
}

describe('settings', () => {
  it('starts with Walnut Academy’s details', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      schoolName: 'Walnut Academy',
      phone: '+91 96948 53435',
      website: 'walnutacademy.in',
      whatsappApp: 'business',
      logoUri: null,
    });
  });

  it('adds the website to details saved before it existed', () => {
    expect(
      parseSettings({ schoolName: 'Walnut Academy', address: SCHOOL.address, phone: '98765 43210' })
    ).toMatchObject({ phone: '98765 43210', website: SCHOOL.website });
  });

  it('keeps valid saved values', () => {
    expect(
      parseSettings({
        schoolName: '  Walnut Academy Jaipur ',
        whatsappApp: 'personal',
        mediaAccessAnsweredFor: 1791196821000,
      })
    ).toMatchObject({
      schoolName: 'Walnut Academy Jaipur',
      whatsappApp: 'personal',
      address: SCHOOL.address,
      mediaAccessAnsweredFor: 1791196821000,
    });
  });

  it('falls back field by field when a saved value is broken', () => {
    expect(
      parseSettings({
        schoolName: '   ',
        whatsappApp: 'myspace',
        phone: 42,
        address: '',
        mediaAccessAnsweredFor: true,
      })
    ).toMatchObject({
      schoolName: SCHOOL.name,
      whatsappApp: 'business',
      phone: SCHOOL.phone,
      address: '',
      mediaAccessAnsweredFor: null,
    });
  });

  it('drops saved values for settings the app no longer has', () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, facebookApp: 'business-suite' })).toEqual(
      DEFAULT_SETTINGS
    );
  });

  it('ignores stored data that is not an object', () => {
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps other phones saved before the revision existed', () => {
    expect(parseStoredSettings({ phone: '98765 43210' }).phone).toBe('98765 43210');
    expect(parseStoredSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings store', () => {
  // Saved by the first release: every value, the phone without +91 and no website.
  const firstRelease = {
    schoolName: SCHOOL.name,
    address: SCHOOL.address,
    phone: '96948 53435',
    logoUri: null,
    whatsappApp: 'personal',
    mediaAccessAnsweredFor: 1791196821000,
  };

  beforeEach(() => mockStorage.clear());

  it('moves the default phone saved by the first release to the current one', () => {
    mockStorage.set('settings.v1', JSON.stringify(firstRelease));
    expect(startApp().getSettings()).toMatchObject({
      phone: SCHOOL.phone,
      website: SCHOOL.website,
      whatsappApp: 'personal',
      mediaAccessAnsweredFor: 1791196821000,
    });
  });

  it('stores only the values that differ from the defaults', () => {
    mockStorage.set('settings.v1', JSON.stringify(firstRelease));
    startApp().updateSettings({ whatsappApp: 'business' });
    expect(JSON.parse(mockStorage.get('settings.v1')!)).toEqual({
      mediaAccessAnsweredFor: 1791196821000,
      revision: SETTINGS_REVISION,
    });
    expect(startApp().getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      mediaAccessAnsweredFor: 1791196821000,
    });
  });

  it('keeps a phone without +91 and an empty website typed in, after a restart', () => {
    mockStorage.set('settings.v1', JSON.stringify(firstRelease));
    startApp().updateSettings({ phone: '96948 53435', website: '' });
    expect(startApp().getSettings()).toMatchObject({ phone: '96948 53435', website: '' });
  });
});
