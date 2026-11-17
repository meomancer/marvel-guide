const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Sep 1963", or "1963" when the month is unknown. */
export function formatDate(year: number, month?: number): string {
  const name = month ? MONTHS[month - 1] : undefined;
  return name ? `${name} ${year}` : String(year);
}

/** "1963", or "1963–1965" for a range. */
export function formatYears(start: number, end: number): string {
  return start === end ? String(start) : `${start}–${end}`;
}
