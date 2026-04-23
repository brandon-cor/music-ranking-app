// Animated circular countdown for the live clip / rating window (green → yellow → red).
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface CircleCountdownProps {
  endsAt: number;
  durationMs: number;
  size?: number;
  onExpire?: () => void;
}

function formatCenterLabel(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  if (s > 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
  return `${s}`;
}

/** Maps remaining fraction (1 = full window left) to a ring color. */
function ringColor(remainingFraction: number): string {
  if (remainingFraction > 0.66) return '#22c55e';
  if (remainingFraction > 0.33) return '#84cc16';
  if (remainingFraction > 0.1) return '#f97316';
  return '#ef4444';
}

export function CircleCountdown({
  endsAt,
  durationMs,
  size = 144,
  onExpire,
}: CircleCountdownProps) {
  const strokeWidth = 8;
  const pad = strokeWidth / 2 + 6;
  const radius = (size - pad * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const [msLeft, setMsLeft] = useState(() =>
    Math.max(0, Math.min(durationMs, endsAt - Date.now())),
  );

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedExpireRef = useRef(false);

  useEffect(() => {
    firedExpireRef.current = false;
    setMsLeft(Math.max(0, Math.min(durationMs, endsAt - Date.now())));
  }, [endsAt, durationMs]);

  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setMsLeft(left);
      if (left <= 0 && !firedExpireRef.current) {
        firedExpireRef.current = true;
        onExpireRef.current?.();
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [endsAt]);

  const remainingFraction = durationMs > 0 ? Math.min(1, msLeft / durationMs) : 0;
  const dashOffset = circumference * (1 - remainingFraction);
  const color = ringColor(remainingFraction);
  const isUrgent = remainingFraction <= 0.1 && msLeft > 0;
  const secondsCeil = Math.ceil(msLeft / 1000);

  return (
    <motion.div
      className="relative flex flex-col items-center"
      style={{ width: size, height: size }}
      animate={isUrgent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={isUrgent ? { repeat: Infinity, duration: 0.85, ease: 'easeInOut' } : undefined}
    >
      <svg
        width={size}
        height={size}
        className="block"
        aria-hidden
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="text-2xl font-black tabular-nums tracking-tight text-white drop-shadow-md"
          aria-live="polite"
        >
          {formatCenterLabel(secondsCeil)}
        </span>
      </div>
    </motion.div>
  );
}
