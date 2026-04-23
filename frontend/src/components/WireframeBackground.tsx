// Wave-stack background pattern, matching nero.fan's aesthetic
const WAVE_PATH = 'M351.073 444.277C351.073 444.277 566.287 231.637 297.993 181.478C29.6987 131.319 0.323898 -19.5179 0.323898 -19.5179';

const WAVE_OFFSETS = [
  '55%', '54%', '53%', '52%', '51%', '50%',
  '49%', '48%', '47%', '46%', '45%', '44%',
  '43%', '42%', '41%', '30%',
];

export function WireframeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 1000"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{ transform: 'scaleX(-1)' }}
      >
        <defs>
          <linearGradient id="waveGradientRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0" />
            <stop offset="40%" stopColor="#22c55e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00ff94" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {WAVE_OFFSETS.map((translate, i) => (
          <path
            key={i}
            d={WAVE_PATH}
            stroke="url(#waveGradientRight)"
            strokeWidth="1.5"
            style={{
              transform: 'scaleX(-1)',
              translate,
              scale: '0.25',
              rotate: '-10deg',
            }}
          />
        ))}
      </svg>
    </div>
  );
}
