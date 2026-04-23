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

/** Triumphant chord stack for the fire (5 pt) pick */
export function playFireCelebrate() {
  const ctx = getCtx();
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.04);
    gain.gain.setValueAtTime(0, now + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.04 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.start(now + i * 0.04);
    osc.stop(now + 0.5);
  });
}

/** Quick bright pop for the woah (3 pt) pick */
export function playWoahPop() {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(990, now + 0.08);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** Accelerating tom-like hits for the verdict drum roll (Web Audio, no files). */
export function playDrumRoll(durationMs = 3200) {
  const ctx = getCtx();
  void ctx.resume();
  const startWall = performance.now();

  const scheduleHit = () => {
    const elapsed = performance.now() - startWall;
    if (elapsed >= durationMs) return;

    const progress = elapsed / durationMs;
    const gapMs = 95 * (1 - progress * 0.9) + 28;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85 + progress * 55, t);
    gain.gain.setValueAtTime(0.11 + progress * 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.1);

    setTimeout(scheduleHit, gapMs);
  };

  scheduleHit();
}

/** Short impact + bright sting when the podium drops in after the drum roll */
export function playVerdictReveal() {
  const ctx = getCtx();
  void ctx.resume();
  const now = ctx.currentTime;

  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.connect(thudGain);
  thudGain.connect(ctx.destination);
  thud.type = 'sine';
  thud.frequency.setValueAtTime(55, now);
  thud.frequency.exponentialRampToValueAtTime(28, now + 0.12);
  thudGain.gain.setValueAtTime(0.35, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  thud.start(now);
  thud.stop(now + 0.26);

  [392, 523.25, 659.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + 0.08 + i * 0.05);
    gain.gain.setValueAtTime(0, now + 0.08 + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.1 + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.start(now + 0.08 + i * 0.05);
    osc.stop(now + 0.48);
  });
}

/** Low dull thud for the skull (1 pt) pick */
export function playSkullShame() {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.25);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.start(now);
  osc.stop(now + 0.36);
}
