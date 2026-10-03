import {
  applyOverlayChange,
  arrowHead,
  arrowLine,
  containsPoint,
  isLightColor,
  logoRect,
} from '@/features/overlays/layout';
import { TEXT_SIZE_MAX, newShapeOverlay, newTextOverlay } from '@/features/overlays/types';
import { formatBytes, formatDuration, plural } from '@/lib/format';

describe('overlay layout', () => {
  it('moves overlays by drag steps and keeps them on the picture', () => {
    const text = newTextOverlay({ x: 0.5, y: 0.5 });
    const moved = applyOverlayChange(applyOverlayChange(text, { dx: 0.1, dy: -0.2, scale: 1 }), {
      dx: 0.1,
      dy: 0,
      scale: 1,
    });
    expect(moved.x).toBeCloseTo(0.7);
    expect(moved.y).toBeCloseTo(0.3);
    expect(applyOverlayChange(text, { dx: 2, dy: -2, scale: 1 })).toMatchObject({ x: 1, y: 0 });
  });

  it('resizes overlays by pinch steps within limits', () => {
    const text = newTextOverlay({ size: 0.1 });
    expect(applyOverlayChange(text, { dx: 0, dy: 0, scale: 1.5 })).toMatchObject({
      size: expect.closeTo(0.15),
    });
    expect(applyOverlayChange(text, { dx: 0, dy: 0, scale: 10 })).toMatchObject({
      size: TEXT_SIZE_MAX,
    });

    const box = newShapeOverlay('rectangle');
    const shrunk = applyOverlayChange(box, { dx: 0, dy: 0, scale: 0.5 });
    expect(shrunk).toMatchObject({ width: box.width * 0.5, height: box.height * 0.5 });
  });

  it('places the logo in the chosen corner with a margin', () => {
    const rect = logoRect(
      { enabled: true, corner: 'bottom-right', size: 'medium' },
      { width: 1600, height: 1200 },
      1
    );
    expect(rect.width).toBeCloseTo(240);
    expect(rect.x + rect.width).toBeCloseTo(1600 - 42);
    expect(rect.y + rect.height).toBeCloseTo(1200 - 42);
    const topLeft = logoRect(
      { enabled: true, corner: 'top-left', size: 'small' },
      { width: 1600, height: 1200 },
      2
    );
    expect(topLeft.x).toBeCloseTo(42);
    expect(topLeft.y).toBeCloseTo(42);
    expect(topLeft.height).toBeCloseTo(topLeft.width / 2);
  });

  it('draws arrows along the way they point', () => {
    const rect = { x: 0, y: 0, width: 100, height: 20 };
    expect(arrowLine(rect, 'right')).toEqual({ from: { x: 0, y: 10 }, to: { x: 100, y: 10 } });
    expect(arrowLine(rect, 'up').to).toEqual({ x: 50, y: 0 });
    const [left, right] = arrowHead({ x: 0, y: 10 }, { x: 100, y: 10 }, 20);
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeLessThan(100);
    expect(left.y).toBeCloseTo(20 - right.y);
  });

  it('tells light colours from dark ones', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
    expect(isLightColor('#FBE716')).toBe(true);
    expect(isLightColor('#111827')).toBe(false);
    expect(isLightColor('#1950C7')).toBe(false);
  });

  it('hit-tests with some slop for fingers', () => {
    const rect = { x: 10, y: 10, width: 50, height: 50 };
    expect(containsPoint(rect, { x: 5, y: 30 })).toBe(false);
    expect(containsPoint(rect, { x: 5, y: 30 }, 8)).toBe(true);
  });
});

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('0:00');
  });

  it('formats file sizes', () => {
    expect(formatBytes(512)).toBe('1 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(24 * 1024 * 1024)).toBe('24 MB');
  });

  it('pluralises', () => {
    expect(plural(1, 'photo')).toBe('1 photo');
    expect(plural(3, 'photo')).toBe('3 photos');
  });
});
