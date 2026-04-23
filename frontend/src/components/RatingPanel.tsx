// Minimal rating strip: tiny m:ss countdown + three emoji buttons (1 / 3 / 5 pt).
import { motion } from 'framer-motion';
import type { RatingWindowState } from '../types';
import { RATING_OPTIONS } from '../lib/ratingOptions';
import Countdown from './Countdown';

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
        <p className="mt-auto text-sm text-muted/90">Waiting for the host to open a rating…</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/30 bg-card/50 p-4">
      <Countdown endsAt={ratingWindow.endsAt} variant="mmss-tiny" />

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
        {RATING_OPTIONS.map(({ score, emoji }) => (
          <motion.button
            key={score}
            type="button"
            disabled={hasVoted}
            onClick={() => onEmojiVote(score)}
            whileTap={hasVoted ? undefined : { scale: 0.92 }}
            className={`flex min-h-[4.5rem] flex-1 items-center justify-center rounded-2xl border-2 text-4xl transition sm:min-h-[5rem] sm:max-w-[7rem] sm:text-5xl ${
              hasVoted
                ? 'cursor-default border-gray-800 bg-gray-900/40 opacity-45'
                : 'border-white/25 bg-white/5 hover:border-accent/50 hover:bg-accent/10 active:scale-95'
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
