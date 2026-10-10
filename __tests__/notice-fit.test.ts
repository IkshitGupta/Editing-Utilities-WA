import { contactText, fitFontSize, formatNoticeDate } from '@/features/notice-card/fit';

// A stand-in for Skia text layout: about 0.5 em per character and 1.3 em per line.
function fitsBox(text: string, width: number, height: number) {
  return (fontSize: number) => {
    const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.5)));
    const lines = Math.ceil(text.length / charsPerLine);
    return lines * fontSize * 1.3 <= height;
  };
}

describe('notice text fitting', () => {
  it('uses the largest size for short notices', () => {
    expect(fitFontSize(28, 54, fitsBox('School closed on Friday.', 950, 600))).toEqual({
      fontSize: 54,
      overflow: false,
    });
  });

  it('shrinks the text for longer notices', () => {
    const fits = fitsBox('a'.repeat(900), 950, 600);
    const result = fitFontSize(28, 54, fits);
    expect(result.overflow).toBe(false);
    expect(result.fontSize).toBeLessThan(54);
    expect(fits(result.fontSize)).toBe(true);
    expect(fits(result.fontSize + 1)).toBe(false);
  });

  it('reports notices that do not fit even at the smallest size', () => {
    expect(fitFontSize(28, 54, fitsBox('a'.repeat(5000), 950, 600))).toEqual({
      fontSize: 28,
      overflow: true,
    });
  });

  it('copes with a range given the wrong way round', () => {
    expect(fitFontSize(40, 30, () => true)).toEqual({ fontSize: 40, overflow: false });
  });
});

describe('notice date', () => {
  it('writes the date the Indian way', () => {
    expect(formatNoticeDate(new Date(2026, 9, 5))).toBe('Monday, 5 October 2026');
    expect(formatNoticeDate(new Date(2027, 0, 26))).toBe('Tuesday, 26 January 2027');
  });
});

describe('notice contact details', () => {
  const school = {
    address: '175, Prajapati Vihar, Jaipur',
    phone: '+91 96948 53435',
    website: 'walnutacademy.in',
  };

  it('puts the phone and website on one line under the address', () => {
    expect(contactText(school)).toBe(
      '175, Prajapati Vihar, Jaipur\n+91 96948 53435 · walnutacademy.in'
    );
  });

  it('leaves out empty details', () => {
    expect(contactText({ ...school, website: '  ' })).toBe(
      '175, Prajapati Vihar, Jaipur\n+91 96948 53435'
    );
    expect(contactText({ ...school, phone: '' })).toBe(
      '175, Prajapati Vihar, Jaipur\nwalnutacademy.in'
    );
    expect(contactText({ ...school, phone: ' ', website: '' })).toBe(
      '175, Prajapati Vihar, Jaipur'
    );
    expect(contactText({ ...school, address: '' })).toBe('+91 96948 53435 · walnutacademy.in');
    expect(contactText({ address: ' ', phone: '', website: '' })).toBe('');
  });

  it('joins an address typed over several lines', () => {
    expect(
      contactText({
        ...school,
        address:
          '175, Prajapati Vihar,\nPatrakar Colony Road ,\r\n\n  Jaipur\u2028Rajasthan 302020\n',
      })
    ).toBe(
      '175, Prajapati Vihar, Patrakar Colony Road, Jaipur, Rajasthan 302020\n+91 96948 53435 · walnutacademy.in'
    );
  });

  it('joins details pasted over several lines with commas', () => {
    expect(
      contactText({
        ...school,
        phone: '96948 53435\n98765 43210',
        website: '\twalnutacademy.in\r\n',
      })
    ).toBe('175, Prajapati Vihar, Jaipur\n96948 53435, 98765 43210 · walnutacademy.in');
  });

  it('joins lines next to a dash with a space and drops commas typed at their ends', () => {
    expect(
      contactText({ ...school, address: 'Patrakar Colony Road;\n, Mansarovar,,\nJaipur -\n302020' })
    ).toBe('Patrakar Colony Road, Mansarovar, Jaipur - 302020\n+91 96948 53435 · walnutacademy.in');
    expect(contactText({ address: 'Jaipur\n- 302020', phone: '', website: '' })).toBe(
      'Jaipur - 302020'
    );
  });
});
