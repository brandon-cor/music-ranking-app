// Subtle concentric-arc wireframe (SVG) behind page content, inspired by nero.fan
export function WireframeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="h-full w-full opacity-[0.08]"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="white" strokeWidth="0.4">
          {Array.from({ length: 12 }, (_, i) => {
            const ry = 40 + i * 38;
            return (
              <ellipse
                key={`e-${i}`}
                cx="500"
                cy="520"
                rx={280 + i * 15}
                ry={ry}
                opacity={0.5 + (i % 3) * 0.1}
              />
            );
          })}
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            return (
              <line
                key={`l-${i}`}
                x1="500"
                y1="200"
                x2={500 + Math.cos(angle) * 400}
                y2={200 + Math.sin(angle) * 500}
                opacity="0.35"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
