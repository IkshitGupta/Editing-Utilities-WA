import type { SkCanvas, SkParagraph } from '@shopify/react-native-skia';

import { drawNoticeCard } from '@/features/notice-card/draw-card';
import { layoutParagraph, type TextSpec } from '@/lib/skia';
import { SCHOOL } from '@/school/defaults';

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Color: (color: string) => color,
    Paint: () => ({
      setAntiAlias: () => undefined,
      setColor: () => undefined,
      setStyle: () => undefined,
      setStrokeWidth: () => undefined,
    }),
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
  },
  TextAlign: { Left: 0, Center: 2 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  FilterMode: { Linear: 1 },
  MipmapMode: { Linear: 2 },
}));
jest.mock('@/lib/skia', () => ({ layoutParagraph: jest.fn() }));

// A stand-in for Skia's text layout: each character takes 0.55 of the font size, and text wraps at
// the given width and at line breaks.
function wrappedLines(spec: TextSpec, width: number): number {
  return spec.text
    .split('\n')
    .reduce(
      (count, line) => count + Math.max(1, Math.ceil((line.length * spec.fontSize * 0.55) / width)),
      0
    );
}

type Layout = { spec: TextSpec; width: number };
let layouts: Layout[] = [];

function useFakeLayout(lines: (spec: TextSpec, width: number) => number) {
  jest.mocked(layoutParagraph).mockImplementation((spec, width) => {
    layouts.push({ spec, width });
    const count = Math.min(lines(spec, width), spec.maxLines ?? Infinity);
    return {
      getLineMetrics: () => Array.from({ length: count }, () => ({})),
      getHeight: () => count * spec.fontSize * (spec.lineHeight ?? 1.2),
      getLongestLine: () => Math.min(width, spec.text.length * spec.fontSize * 0.55),
      paint: () => undefined,
    } as unknown as SkParagraph;
  });
}

const canvas = new Proxy({}, { get: () => () => undefined }) as SkCanvas;
const NAME_SIZE = 1080 * 0.058;

// Draws a letterhead card and returns the layouts of the school name.
function drawName(name: string): Layout[] {
  layouts = [];
  drawNoticeCard(
    canvas,
    {
      title: 'Holiday Notice',
      body: 'The school is closed on Friday.',
      date: new Date(2026, 9, 7),
    },
    { design: 'letterhead', theme: 'royal', size: 'square' },
    { fonts: null, logo: null },
    { name, address: SCHOOL.address, phone: SCHOOL.phone, website: SCHOOL.website }
  );
  return layouts.filter(({ spec }) => spec.text.startsWith('Walnut'));
}

function last(nameLayouts: Layout[]): Layout {
  return nameLayouts[nameLayouts.length - 1];
}

describe('notice card school details', () => {
  beforeEach(() => useFakeLayout(wrappedLines));

  it('draws a name pasted over several lines on one line at its normal size', () => {
    expect(drawName('Walnut\nAcademy\r\nJaipur').map(({ spec }) => spec)).toEqual([
      expect.objectContaining({ text: 'Walnut Academy Jaipur', fontSize: NAME_SIZE }),
    ]);
  });

  it('makes a long name smaller instead of cutting it short', () => {
    const name = 'Walnut Academy Senior Secondary School, Mansarovar, Jaipur';
    const { spec, width } = last(drawName(name));
    expect(spec.text).toBe(name);
    expect(spec.fontSize).toBeLessThan(NAME_SIZE);
    expect(wrappedLines(spec, width)).toBeLessThanOrEqual(2);
  });

  it('cuts text that fits at no size at its normal size rather than too small to read', () => {
    useFakeLayout((spec, width) =>
      spec.text.startsWith('Walnut') ? 3 : wrappedLines(spec, width)
    );
    expect(last(drawName('Walnut Academy')).spec).toMatchObject({
      fontSize: NAME_SIZE,
      maxLines: 2,
    });
  });
});
