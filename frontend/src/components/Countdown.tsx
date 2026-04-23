import { useEffect, useState } from 'react';
import { playTick } from '../lib/audio';

interface CountdownProps {
  endsAt: number; // timestamp in ms
  onExpire?: () => void;
}

export default function Countdown({ endsAt, onExpire }: CountdownProps) {
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
      : 'text-gold';

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`display-num text-[120px] leading-none tabular-nums transition-colors duration-300 ${colorClass}`}
      >
        {secondsLeft}
      </span>
      <span className="text-gray-400 text-sm font-semibold uppercase tracking-widest">
        seconds left
      </span>
    </div>
  );
}
