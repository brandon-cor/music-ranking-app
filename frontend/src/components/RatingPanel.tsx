// Inline nero.party rating panel — countdown and emoji vote UI (replaces full-screen rating overlay on Player)
import { motion, AnimatePresence } from 'framer-motion';
import type { RatingWindowState, Song } from '../types';
import { emojiForScore, RATING_OPTIONS } from '../lib/ratingOptions';
import Countdown from './Countdown';

export interface RatingPanelProps {
  ratingWindow: RatingWindowState | null;
  song: Song | null;
  hasVoted: boolean;
  votedFlash: boolean;
  lastVoteScore: number | null;
  voteCount: number;
  totalUsers: number;
  onEmojiVote: (score: number) => void;
}

export function RatingPanel({
  ratingWindow,
  song,
  hasVoted,
  votedFlash,
  lastVoteScore,
  voteCount,
  totalUsers,
  onEmojiVote,
}: RatingPanelProps) {
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
      <div>
        <h2 className="display-num text-2xl leading-none text-accent sm:text-3xl">nero.party</h2>
        {song && (
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-white" title={song.title}>
            {song.title}
          </p>
        )}
      </div>

      <div className="scale-90 sm:scale-100">
        <Countdown endsAt={ratingWindow.endsAt} compact />
      </div>

      <p className="text-center text-xs text-gray-500">
        {voteCount} / {totalUsers} voted
      </p>

      <div className="min-h-[140px]">
        <AnimatePresence mode="wait">
          {votedFlash && lastVoteScore != null ? (
            <motion.div
              key="voted"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="flex flex-col items-center gap-1 py-2"
            >
              <span className="display-num text-3xl text-success sm:text-4xl">YOU VOTED</span>
              <span className="text-4xl" aria-hidden>
                {emojiForScore(lastVoteScore)}
              </span>
              <span className="text-gray-400 text-sm">
                <strong className="text-white">{lastVoteScore}</strong> pt locked in
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="emoji-pick"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <p className="text-center text-[10px] uppercase tracking-widest text-gray-500">
                1 · 3 · 5 pt
              </p>
              <div className="flex flex-col gap-2">
                {RATING_OPTIONS.map(({ score, emoji, label }) => (
                  <button
                    key={score}
                    type="button"
                    disabled={hasVoted}
                    onClick={() => onEmojiVote(score)}
                    className={`flex min-h-[3.5rem] flex-row items-center justify-center gap-3 rounded-2xl border-2 py-2 px-3 transition active:scale-95 ${
                      hasVoted
                        ? 'cursor-not-allowed border-gray-800 bg-gray-900/50 text-gray-600'
                        : 'border-white/20 bg-white/5 hover:border-accent/50 hover:bg-accent/10'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden>
                      {emoji}
                    </span>
                    <span className="text-xs font-black uppercase text-gray-400">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
