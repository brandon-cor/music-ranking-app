// Rate panel: stacked emoji votes (1 / 3 / 5 pt); clip countdown lives next to the iPod on Player.
import { motion } from 'framer-motion';
import type { RatingWindowState } from '../types';
import { RATING_OPTIONS } from '../lib/ratingOptions';

export interface RatingPanelProps {
  ratingWindow: RatingWindowState | null;
  hasVoted: boolean;
  onEmojiVote: (score: number) => void;
}

export function RatingPanel({ ratingWindow, hasVoted, onEmojiVote }: RatingPanelProps) {
  if (!ratingWindow) {
    return (
      <section className="flex min-h-[12rem] flex-col rounded-2xl border border-border/30 bg-card/40 p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Rate</h2>
        <p className="mt-auto text-sm text-muted/90">Ratings open as soon as the clip starts.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/30 bg-card/50 p-4">
      <div className="flex flex-col gap-2">
        {RATING_OPTIONS.map(({ score, emoji }) => (
          <motion.button
            key={score}
            type="button"
            disabled={hasVoted}
            onClick={() => onEmojiVote(score)}
            whileTap={hasVoted ? undefined : { scale: 0.92 }}
            className={`flex min-h-[4.5rem] items-center justify-center text-5xl transition active:scale-95 ${
              hasVoted ? 'cursor-default opacity-45' : ''
            }`}
            aria-label={`Vote ${score} points`}
          >
            <span aria-hidden>{emoji}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
