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
