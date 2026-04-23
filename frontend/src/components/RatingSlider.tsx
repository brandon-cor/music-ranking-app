import { useRef, useState } from 'react';

const LABELS = [
  { value: 0, label: 'mid' },
  { value: 25, label: 'eh' },
  { value: 50, label: 'solid' },
  { value: 75, label: 'slaps' },
  { value: 100, label: 'BANGER 🔥' },
];

interface RatingSliderProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export default function RatingSlider({ value, onChange, disabled }: RatingSliderProps) {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  // active label is whichever stop is closest to the current value
  const activeLabel = LABELS.reduce((closest, l) =>
    Math.abs(l.value - value) < Math.abs(closest.value - value) ? l : closest,
  );

  // background gradient driven by the slider value
  const pct = `${value}%`;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* active label */}
      <div className="text-center">
        <span
          className={`display-num text-6xl transition-colors duration-200 ${
            value >= 75 ? 'text-gold glow-gold' : value >= 50 ? 'text-yellow-300' : 'text-gray-400'
          }`}
        >
          {activeLabel.label}
        </span>
      </div>

      {/* score number */}
      <div className="text-center">
        <span
          className={`display-num text-8xl tabular-nums transition-colors duration-200 ${
            value >= 75 ? 'text-gold' : value >= 50 ? 'text-yellow-200' : 'text-gray-300'
          }`}
        >
          {value}
        </span>
      </div>

      {/* slider track */}
      <div ref={trackRef} className="relative px-4">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={handleInput}
          disabled={disabled}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onTouchStart={() => setDragging(true)}
          onTouchEnd={() => setDragging(false)}
          className="rating-slider w-full"
          style={{ '--value': pct } as React.CSSProperties}
        />
      </div>

      {/* label stops */}
      <div className="flex justify-between px-4 mt-1">
        {LABELS.map((l) => (
          <button
            key={l.value}
            onClick={() => !disabled && onChange(l.value)}
            className={`text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
              activeLabel.value === l.value ? 'text-gold' : 'text-gray-500'
            } ${disabled ? 'cursor-default' : 'cursor-pointer hover:text-gray-300'}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* invisible spacer used to track drag state for thumb scale */}
      <div className="sr-only" aria-hidden>
        {dragging ? 'dragging' : 'idle'}
      </div>
    </div>
  );
}
