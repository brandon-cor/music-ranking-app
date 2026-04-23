import { useEffect, useState } from 'react';
import { playTick } from '../lib/audio';

interface CountdownProps {
  endsAt: number; // timestamp in ms
  onExpire?: () => void;
  /** Smaller readout for inline/narrow columns (e.g. Player rating panel) */
  compact?: boolean;
}

export default function Countdown({ endsAt, onExpire, compact = false }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      // play an urgent tick when under 5 seconds
      if (remaining <= 5 && remaining > 0) {
        playTick();
      }

      if (remaining === 0) {
        onExpire?.();
      }
    };

    tick(); // run immediately
    const id = setInterval(tick, 250); // update every 250ms for smooth display
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  // color shifts as urgency increases
  const isUrgent = secondsLeft <= 5;
  const isWarning = secondsLeft <= 10 && !isUrgent;

  const colorClass = isUrgent
    ? 'text-red-500 glow-red animate-pulse-fast'
    : isWarning
      ? 'text-orange-400'
      : 'text-accent glow-accent';

  const sizeClass = compact
    ? 'text-4xl sm:text-5xl leading-none'
    : 'text-[120px] leading-none';

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      <span
        className={`display-num ${sizeClass} tabular-nums transition-colors duration-300 ${colorClass}`}
      >
        {secondsLeft}
      </span>
      <span
        className={`text-gray-400 font-semibold uppercase tracking-widest ${compact ? 'text-[10px]' : 'text-sm'}`}
      >
        seconds left
      </span>
    </div>
  );
}
