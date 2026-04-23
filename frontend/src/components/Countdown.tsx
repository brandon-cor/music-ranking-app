import { useEffect, useState } from 'react';
import { playTick } from '../lib/audio';

interface CountdownProps {
  endsAt: number; // timestamp in ms
  onExpire?: () => void;
  /** Smaller readout for inline/narrow columns (e.g. Player rating panel) */
  compact?: boolean;
  /** Minimal m:ss line only (no tick sounds) — for compact rating strip */
  variant?: 'default' | 'mmss-tiny';
}

export default function Countdown({
  endsAt,
  onExpire,
  compact = false,
  variant = 'default',
}: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((endsAt - Date.now()) / 1000)),
  );
  const [mmssLabel, setMmssLabel] = useState(() => formatMmss(endsAt));

  useEffect(() => {
    if (variant === 'mmss-tiny') {
      const tick = () => {
        const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
        setMmssLabel(formatMmssFromTotalSec(remaining));
        if (remaining === 0) onExpire?.();
      };
      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 5 && remaining > 0) {
        playTick();
      }

      if (remaining === 0) {
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, onExpire, variant]);

  const isUrgent = secondsLeft < 5;
  const isWarning = secondsLeft < 10 && !isUrgent;

  if (variant === 'mmss-tiny') {
    return (
      <p className="text-center text-xs font-semibold tabular-nums tracking-wide text-muted">{mmssLabel}</p>
    );
  }

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

function formatMmss(endsAt: number): string {
  const sec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
  return formatMmssFromTotalSec(sec);
}

function formatMmssFromTotalSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
