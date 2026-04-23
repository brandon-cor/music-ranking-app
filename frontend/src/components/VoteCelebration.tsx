// Full-screen burst after picking a rating emoji; auto-dismisses after ~1.2s.
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { emojiForScore } from '../lib/ratingOptions';
import { playFireCelebrate, playSkullShame, playWoahPop } from '../lib/audio';

export type CelebrationScore = 1 | 3 | 5;

interface VoteCelebrationProps {
  score: CelebrationScore;
  onDone: () => void;
}

const DISMISS_MS = 1200;

export function VoteCelebration({ score, onDone }: VoteCelebrationProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (score === 5) playFireCelebrate();
    else if (score === 3) playWoahPop();
    else playSkullShame();

    const t = window.setTimeout(() => onDoneRef.current(), DISMISS_MS);
    return () => clearTimeout(t);
  }, [score]);

  const emoji = emojiForScore(score);
  const isBad = score === 1;
  const isFire = score === 5;

  return (
    <AnimatePresence>
      <motion.div
        key="vote-celebration"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[130] flex items-center justify-center px-6 ${
          isBad ? 'bg-black/92' : 'bg-background/88 backdrop-blur-md'
        }`}
        aria-live="polite"
      >
        {isFire && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.35)_0%,transparent_55%)]"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 0.5 }}
          />
        )}

        <motion.div
          initial={{ scale: 0.2, opacity: 0 }}
          animate={
            isBad
              ? {
                  scale: [1, 1.06, 1, 1.05, 1],
                  opacity: 1,
                  rotate: [0, -2, 2, -1, 0],
                }
              : { scale: 1, opacity: 1 }
          }
          transition={
            isBad
              ? { duration: 1.1, ease: 'easeInOut' }
              : { type: 'spring', damping: 12, stiffness: 260 }
          }
          className="relative flex flex-col items-center gap-2"
        >
          <span
            className={`text-[clamp(96px,28vw,220px)] leading-none select-none ${
              isBad ? 'grayscale-[0.2] drop-shadow-[0_0_24px_rgba(255,255,255,0.15)]' : ''
            }`}
            aria-hidden
          >
            {emoji}
          </span>
          {isBad && (
            <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              rough take
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
