import type { SkCanvas, SkImage, SkParagraph } from '@shopify/react-native-skia';

import { drawNoticeCard, type Notice } from '@/features/notice-card/draw-card';
import { contactText, formatNoticeDate } from '@/features/notice-card/fit';
import type { CardSizeId, DesignId } from '@/features/notice-card/styles';
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
  ClipOp: { Intersect: 1 },
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
// Text drawn on the card, with where it was drawn.
type Painted = { text: string; fontSize: number; y: number; height: number };
let painted: Painted[] = [];

function useFakeLayout(lines: (spec: TextSpec, width: number) => number) {
  jest.mocked(layoutParagraph).mockImplementation((spec, width) => {
    layouts.push({ spec, width });
    const count = Math.min(lines(spec, width), spec.maxLines ?? Infinity);
    const height = count * spec.fontSize * (spec.lineHeight ?? 1.2);
    return {
      getLineMetrics: () => Array.from({ length: count }, () => ({})),
      getHeight: () => height,
      getLongestLine: () => Math.min(width, spec.text.length * spec.fontSize * 0.55),
      paint: (_canvas: SkCanvas, _x: number, y: number) => {
        painted.push({ text: spec.text, fontSize: spec.fontSize, y, height });
      },
    } as unknown as SkParagraph;
  });
}

type CanvasCall = { name: string; args: unknown[] };
let calls: CanvasCall[] = [];
const canvas = new Proxy(
  {},
  {
    get:
      (_target, name) =>
      (...args: unknown[]) => {
        calls.push({ name: String(name), args });
      },
  }
) as SkCanvas;
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

type Rect = { x: number; y: number; width: number; height: number };

const DATE = new Date(2026, 9, 7);
const MARGIN = 1080 * 0.065;

function photo(width: number, height: number): SkImage {
  return { width: () => width, height: () => height } as unknown as SkImage;
}

type PhotoCard = { size?: CardSizeId; design?: DesignId; logo?: SkImage | null };

// Draws a card with a photo and returns the part of the photo drawn and where it went.
function drawWithPhoto(
  notice: Partial<Notice>,
  { size = 'portrait', design = 'letterhead', logo = null }: PhotoCard = {}
) {
  layouts = [];
  painted = [];
  calls = [];
  const result = drawNoticeCard(
    canvas,
    { title: '', body: '', date: DATE, ...notice },
    { design, theme: 'royal', size },
    { fonts: null, logo },
    SCHOOL
  );
  const images = calls.filter(
    ({ name, args }) => name === 'drawImageRectOptions' && args[0] === notice.photo
  );
  expect(images).toHaveLength(1);
  const [, source, target] = images[0].args as [SkImage, Rect, Rect];
  return { result, source, target };
}

function paintedText(value: string): Painted {
  const found = painted.find(({ text }) => text === value);
  if (!found) {
    throw new Error(`"${value}" was not drawn`);
  }
  return found;
}

describe('notice card photo', () => {
  beforeEach(() => useFakeLayout(wrappedLines));

  it('shows a photo on its own whole, centred between the school details, without the date', () => {
    const { source, target } = drawWithPhoto({ photo: photo(3000, 4000) });
    expect(source).toEqual({ x: 0, y: 0, width: 3000, height: 4000 });
    expect(target.width / target.height).toBeCloseTo(3 / 4);
    expect(target.x).toBeGreaterThanOrEqual(MARGIN);
    expect(target.x + target.width / 2).toBeCloseTo(540);
    const name = paintedText(SCHOOL.name);
    expect(target.y).toBeGreaterThan(name.y + name.height);
    expect(target.y + target.height).toBeLessThan(paintedText(contactText(SCHOOL)).y);
    expect(painted.map(({ text }) => text)).not.toContain(formatNoticeDate(DATE));
  });

  it('puts the notice text under the photo, at a smaller size', () => {
    const body = 'Photos from the annual function.';
    const { target } = drawWithPhoto({ title: 'Annual Day', body, photo: photo(4000, 3000) });
    expect(paintedText(formatNoticeDate(DATE)).y).toBeLessThan(target.y);
    const text = paintedText(body);
    expect(text.y).toBeGreaterThan(target.y + target.height);
    expect(text.fontSize).toBeLessThanOrEqual(1080 * 0.04);
  });

  it('keeps most of the space for the photo when the notice is too long, and warns', () => {
    const body = 'The school will remain closed on Friday for the festival. '.repeat(40).trim();
    const { result, target } = drawWithPhoto(
      { title: 'Holiday Notice', body, photo: photo(3000, 4000) },
      { size: 'square' }
    );
    expect(result.overflow.body).toBe(true);
    expect(target.height).toBeGreaterThan(paintedText(body).height);
  });

  it('leaves the notice text off when not even one line fits beside the photo, and says so', () => {
    const notice = { title: 'Annual Function and Graduation Ceremony', photo: photo(4000, 3000) };
    const crowded: PhotoCard = { size: 'square', design: 'minimal', logo: photo(500, 500) };
    const withoutText = drawWithPhoto(notice, crowded).target;
    const { result, target } = drawWithPhoto({ ...notice, body: 'Please join us.' }, crowded);
    expect(result.bodyLeftOff).toBe(true);
    expect(result.overflow.body).toBe(false);
    expect(painted.map(({ text }) => text)).not.toContain('Please join us.');
    expect(target).toEqual(withoutText);
  });
});
