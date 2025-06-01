/**
 * Utility for conditional class name concatenation (supports clsx-like syntax)
 */
export function cn(...inputs: (string | number | boolean | null | undefined | Record<string, unknown> | Array<string | number | boolean | null | undefined>)[]): string {
  return inputs
    .flatMap(input => {
      if (typeof input === 'string') {
        return input;
      } else if (input && typeof input === 'object') {
        return Object.entries(input)
          .filter(([key, value]) => value)
          .map(([key]) => key);
      } else if (Array.isArray(input)) {
        return input.filter(Boolean);
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}
