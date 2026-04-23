// Shared 1/3/5 pt emoji options for the live rating flow
export const RATING_OPTIONS = [
  { score: 1, emoji: '💀', label: '1 pt' },
  { score: 3, emoji: '😮', label: '3 pt' },
  { score: 5, emoji: '🔥', label: '5 pt' },
] as const;

export function emojiForScore(score: number): string {
  const row = RATING_OPTIONS.find((o) => o.score === score);
  return row?.emoji ?? '✓';
}
