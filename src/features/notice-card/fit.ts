import { oneLine } from '@/lib/format';

export type FitResult = {
  fontSize: number;
  // True when even the smallest size does not fit, so the notice should be shortened.
  overflow: boolean;
};

// Finds the largest whole font size between min and max for which `fits` returns true.
export function fitFontSize(
  min: number,
  max: number,
  fits: (fontSize: number) => boolean
): FitResult {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high < low) {
    return { fontSize: low, overflow: !fits(low) };
  }
  if (fits(high)) {
    return { fontSize: high, overflow: false };
  }
  if (!fits(low)) {
    return { fontSize: low, overflow: true };
  }
  let best = low;
  let lower = low + 1;
  let upper = high - 1;
  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (fits(middle)) {
      best = middle;
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
  return { fontSize: best, overflow: false };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Indian style, for example "Monday, 6 October 2026".
export function formatNoticeDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Characters that end a line in typed or pasted text.
const LINE_BREAKS = /[\n\r\v\f\u0085\u2028\u2029]+/;

// Details typed or pasted over several lines are joined into one, so they wrap to the card's width
// rather than needing a line each. The lines are joined with commas, which replace any commas or
// semicolons typed at their ends, or with a space next to a dash or a similar joining mark, as in
// "Jaipur - 302020".
function joinLines(value: string): string {
  return value
    .split(LINE_BREAKS)
    .map((line) => oneLine(line).replace(/^[\s,;]+|[\s,;]+$/g, ''))
    .filter(Boolean)
    .reduce((joined, line) => {
      if (!joined) {
        return line;
      }
      const together = /[-–—:/&(]$/.test(joined) || /^[-–—)]/.test(line);
      return `${joined}${together ? ' ' : ', '}${line}`;
    }, '');
}

// The phone and website share a line, so the address can take two lines and the footer still fits.
export function contactText(school: { address: string; phone: string; website: string }): string {
  const reach = [joinLines(school.phone), joinLines(school.website)].filter(Boolean).join(' · ');
  return [joinLines(school.address), reach].filter(Boolean).join('\n');
}
