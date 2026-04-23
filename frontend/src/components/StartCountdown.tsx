// A brief 3-2-1-GO full-screen flashing countdown that plays when a party
// transitions from lobby to live, right before the first song kicks in.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEP_MS = 800;
const STEPS: string[] = ['3', '2', '1', 'GO'];

interface StartCountdownProps {
  onComplete: () => void;
}

export default function StartCountdown({ onComplete }: StartCountdownProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= STEPS.length) {
      const t = window.setTimeout(onComplete, 250);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [index, onComplete]);

  const label = STEPS[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <AnimatePresence mode="wait">
        {label && (
          <motion.span
            key={label}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 220 }}
            className="display-num text-[clamp(120px,30vw,320px)] leading-none text-accent glow-accent"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
