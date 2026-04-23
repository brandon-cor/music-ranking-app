// Rate panel: free-floating emoji votes (1 / 3 / 5 pt); no card chrome
import { motion } from 'framer-motion';
import type { RatingWindowState } from '../types';
import { RATING_OPTIONS } from '../lib/ratingOptions';

export interface RatingPanelProps {
  ratingWindow: RatingWindowState | null;
  hasVoted: boolean;
  onEmojiVote: (score: number) => void;
}

export function RatingPanel({ ratingWindow, hasVoted, onEmojiVote }: RatingPanelProps) {
  const active = ratingWindow !== null;

  return (
    <div className="flex h-full min-h-[14rem] flex-col items-center justify-around gap-8 py-2 sm:gap-10 sm:py-4">
      {RATING_OPTIONS.map(({ score, emoji }) => (
        <motion.button
          key={score}
          type="button"
          disabled={hasVoted || !active}
          onClick={() => onEmojiVote(score)}
          whileTap={hasVoted || !active ? undefined : { scale: 0.92 }}
          className={`text-6xl leading-none transition sm:text-7xl ${
            !active ? 'cursor-default opacity-30' : ''
          } ${hasVoted ? 'cursor-default opacity-45' : active ? 'hover:opacity-90' : ''}`}
          aria-label={`Vote ${score} points`}
        >
          <span aria-hidden>{emoji}</span>
        </motion.button>
      ))}
    </div>
  );
}
