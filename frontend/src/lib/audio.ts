// generate UI sounds with the Web Audio API — no audio files needed

function getCtx(): AudioContext {
  // reuse a single context to avoid browser limits
  const key = '__audioCtx';
  if (!(window as unknown as Record<string, unknown>)[key]) {
    (window as unknown as Record<string, unknown>)[key] = new AudioContext();
  }
  return (window as unknown as Record<string, unknown>)[key] as AudioContext;
}

// plays a classic "air horn" style burst when the rating window opens
export function playRatingOpen() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  [220, 330, 440].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0.25, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.35);
  });
}

// short ding when vote is confirmed
export function playVoteConfirm() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.start(now);
  osc.stop(now + 0.35);
}

// urgent tick as countdown approaches zero
export function playTick() {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.start(now);
  osc.stop(now + 0.06);
}
