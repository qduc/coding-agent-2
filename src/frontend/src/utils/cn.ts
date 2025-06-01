/**
 * Utility for conditional class name concatenation
 */
export default function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
