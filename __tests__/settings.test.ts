import { DEFAULT_SETTINGS, parseSettings } from '@/features/settings/settings';
import { SCHOOL } from '@/school/defaults';

describe('settings', () => {
  it('starts with Walnut Academy’s details', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      schoolName: 'Walnut Academy',
      phone: SCHOOL.phone,
      whatsappApp: 'business',
      logoUri: null,
    });
  });

  it('keeps valid saved values', () => {
    expect(
      parseSettings({ schoolName: '  Walnut Academy Jaipur ', whatsappApp: 'personal' })
    ).toMatchObject({
      schoolName: 'Walnut Academy Jaipur',
      whatsappApp: 'personal',
      address: SCHOOL.address,
    });
  });

  it('falls back field by field when a saved value is broken', () => {
    expect(
      parseSettings({ schoolName: '   ', whatsappApp: 'myspace', phone: 42, address: '' })
    ).toMatchObject({
      schoolName: SCHOOL.name,
      whatsappApp: 'business',
      phone: SCHOOL.phone,
      address: '',
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
});
