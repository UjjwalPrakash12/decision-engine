/**
 * Format a number as a USD currency string (no cents).
 * e.g. 4200 → "$4,200"
 */
export function formatCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

/**
 * Format a number as a percentage string.
 * e.g. -20 → "-20%"
 */
export function formatPercent(n: number): string {
  return `${n}%`;
}

/**
 * Merge Tailwind class names, filtering out falsy values.
 * Lightweight alternative to clsx / classnames.
 */
export function cn(
  ...classes: (string | undefined | null | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}
