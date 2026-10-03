import {
  APPS,
  WHATSAPP_MAX_ITEMS,
  checkShare,
  shareMimeType,
  targetApp,
} from '@/features/share/targets';

describe('share targets', () => {
  it('opens WhatsApp Business and Facebook by default', () => {
    const choices = { whatsappApp: 'business' } as const;
    expect(targetApp('whatsapp', choices).packageName).toBe('com.whatsapp.w4b');
    expect(targetApp('facebook', choices).packageName).toBe('com.facebook.katana');
    expect(targetApp('youtube', choices)).toBe(APPS.youtube);
  });

  it('follows the WhatsApp app chosen in Settings', () => {
    const choices = { whatsappApp: 'personal' } as const;
    expect(targetApp('whatsapp', choices).packageName).toBe('com.whatsapp');
    expect(targetApp('facebook', choices).packageName).toBe('com.facebook.katana');
  });

  it('describes what is being shared', () => {
    expect(shareMimeType(['image', 'image'])).toBe('image/*');
    expect(shareMimeType(['video'])).toBe('video/*');
    expect(shareMimeType(['image', 'video'])).toBe('*/*');
  });

  it('allows one video for YouTube', () => {
    expect(checkShare('youtube', ['video'])).toEqual({ ok: true });
    expect(checkShare('youtube', ['image']).ok).toBe(false);
    expect(checkShare('youtube', ['video', 'video']).ok).toBe(false);
  });

  it('allows up to WhatsApp’s limit in one share', () => {
    expect(checkShare('whatsapp', Array(WHATSAPP_MAX_ITEMS).fill('image')).ok).toBe(true);
    expect(checkShare('whatsapp', Array(WHATSAPP_MAX_ITEMS + 1).fill('image')).ok).toBe(false);
  });

  it('needs something to share', () => {
    expect(checkShare('facebook', []).ok).toBe(false);
  });
});
