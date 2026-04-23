// Party results — drum roll, confetti, Olympic podium + compact side rankings
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { NeroPageShell } from '../components/NeroPageShell';
import { useParty } from '../context/PartyContext';
import { getResults } from '../lib/api';
import { playDrumRoll, playVerdictReveal } from '../lib/audio';
import { PartyCodeEditor } from '../components/PartyCodeEditor';
import type { SongResult } from '../types';

type RevealPhase = 'idle' | 'drum_roll' | 'revealed';

const DRUM_ROLL_MS = 3400;

const rankMedal = (rank: number) =>
  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

function fireVerdictConfetti() {
  const burst = (originX: number, particleCount: number) => {
    confetti({
      particleCount,
      spread: 100,
      startVelocity: 55,
      scalar: 1.1,
      origin: { x: originX, y: 0.45 },
      colors: ['#22c55e', '#00ff94', '#FF4500', '#ffffff', '#86efac'],
    });
  };
  burst(0.25, 140);
  burst(0.5, 180);
  burst(0.75, 140);
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 360,
      startVelocity: 25,
      origin: { x: 0.5, y: 0.5 },
      ticks: 60,
      scalar: 1,
      colors: ['#22c55e', '#00ff94', '#fff'],
    });
  }, 120);
}

interface PodiumBlockProps {
  song: SongResult;
  rank: number;
  heightClass: string;
  delay: number;
}

function PodiumBlock({ song, rank, heightClass, delay }: PodiumBlockProps) {
  const medal = rankMedal(rank);
  const isFirst = rank === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 80, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        damping: 14,
        stiffness: 260,
        delay,
      }}
      className={`flex w-[min(28vw,160px)] flex-col sm:w-40 md:w-44 ${heightClass}`}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col items-center justify-end gap-2 rounded-t-2xl border border-border/50 bg-card/70 px-2 pb-3 pt-4 backdrop-blur-sm ${
          isFirst ? 'border-accent/40 shadow-accent-glow-lg ring-1 ring-accent/20' : ''
        }`}
      >
        <span
          className={`display-num text-4xl leading-none sm:text-5xl ${
            isFirst ? 'glow-accent' : 'text-gray-400'
          }`}
          aria-hidden
        >
          {medal}
        </span>
        <img
          src={song.cover_url}
          alt=""
          className={`aspect-square w-[70%] max-w-[5.5rem] rounded-lg object-cover ${
            isFirst ? 'shadow-[0_0_20px_rgba(34,197,94,0.45)]' : ''
          }`}
        />
        <div className="w-full px-1 text-center">
          <p
            className={`line-clamp-2 text-xs font-black leading-tight sm:text-sm ${
              isFirst ? 'text-accent' : 'text-white'
            }`}
          >
            {song.title}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500 sm:text-xs">{song.artist}</p>
        </div>
        <div className="text-center">
          <span
            className={`display-num text-2xl tabular-nums sm:text-3xl ${
              isFirst ? 'glow-accent text-accent' : 'text-white'
            }`}
          >
            {song.avgScore.toFixed(1)}
          </span>
          <p className="text-[10px] text-gray-600">avg / 5</p>
        </div>
      </div>
      <div
        className={`display-num shrink-0 rounded-b-xl py-2 text-center text-sm font-bold tracking-wide ${
          rank === 1
            ? 'bg-accent/25 text-accent'
            : rank === 2
              ? 'bg-zinc-600/40 text-zinc-300'
              : 'bg-amber-900/30 text-amber-600/90'
        }`}
      >
        {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
      </div>
    </motion.div>
  );
}

interface SideRankRowProps {
  song: SongResult;
  rank: number;
}

function SideRankRow({ song, rank }: SideRankRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/50 px-2 py-1.5 backdrop-blur-sm">
      <span className="display-num w-7 shrink-0 text-center text-sm text-gray-500">#{rank}</span>
      <img src={song.cover_url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">{song.title}</p>
        <p className="truncate text-[10px] text-gray-500">{song.artist}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="display-num text-sm tabular-nums text-white">{song.avgScore.toFixed(1)}</span>
        <p className="text-[9px] text-gray-600">avg</p>
      </div>
    </div>
  );
}

export default function Podium() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const { results: ctxResults, party } = useParty();

  const [results, setResults] = useState<SongResult[]>(ctxResults);
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (results.length > 0) return;
    if (!partyId) return;

    getResults(partyId)
      .then(({ results: r }) => setResults(r))
      .catch(() => navigate('/'));
  }, [partyId, results.length, navigate]);

  // API order: best first — rank = index + 1
  const ranked = results;
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  useEffect(() => {
    if (phase !== 'drum_roll') return;

    playDrumRoll(DRUM_ROLL_MS);

    let done = false;
    const t = window.setTimeout(() => {
      if (!done) setPhase('revealed');
    }, DRUM_ROLL_MS);

    return () => {
      done = true;
      window.clearTimeout(t);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealed') return;
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    playVerdictReveal();
    fireVerdictConfetti();
  }, [phase]);

  const startReveal = () => {
    if (phase !== 'idle') return;
    confettiFiredRef.current = false;
    setPhase('drum_roll');
  };

  /** Olympic order: 2nd, 1st, 3rd */
  const podiumSlots: { song: SongResult; rank: number; height: string; delay: number }[] = [];
  if (top3[1]) podiumSlots.push({ song: top3[1], rank: 2, height: 'min-h-[220px] md:min-h-[260px]', delay: 0.12 });
  if (top3[0]) podiumSlots.push({ song: top3[0], rank: 1, height: 'min-h-[260px] md:min-h-[320px]', delay: 0 });
  if (top3[2]) podiumSlots.push({ song: top3[2], rank: 3, height: 'min-h-[200px] md:min-h-[240px]', delay: 0.22 });

  if (results.length === 0) {
    return (
      <NeroPageShell>
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <p className="text-muted animate-pulse">Loading results…</p>
        </div>
      </NeroPageShell>
    );
  }

  return (
    <NeroPageShell>
      <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:min-h-[calc(100vh-5rem)] lg:py-6">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 shrink-0 text-center sm:mb-8"
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
            {party?.name ?? 'Nero Party'} · Final Results
          </p>
          <h1 className="display-num text-[clamp(40px,10vw,80px)] leading-none text-white">
            THE VERDICT
          </h1>
          {partyId && <PartyCodeEditor partyCode={partyId} className="mt-3 justify-center" />}
        </motion.div>

        {phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 items-center justify-center py-8"
          >
            <button
              type="button"
              onClick={startReveal}
              className="btn-nero-cta animate-bounce px-10 py-4 text-xl font-black uppercase tracking-widest sm:px-12 sm:py-5 sm:text-2xl"
            >
              Reveal Results
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {phase === 'drum_roll' && (
            <motion.div
              key="drum"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center py-12"
            >
              <motion.p
                className="display-num text-3xl uppercase tracking-[0.2em] text-white sm:text-4xl"
                animate={{
                  scale: [1, 1.04, 1, 1.06, 1],
                  textShadow: [
                    '0 0 0px rgba(34,197,94,0)',
                    '0 0 24px rgba(34,197,94,0.5)',
                    '0 0 0px rgba(34,197,94,0)',
                    '0 0 32px rgba(34,197,94,0.6)',
                    '0 0 0px rgba(34,197,94,0)',
                  ],
                }}
                transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut' }}
              >
                Drum roll…
              </motion.p>
              <div className="mt-8 flex gap-2" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-accent"
                    animate={{ opacity: [0.2, 1, 0.2], y: [0, -10, 0] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.08,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'revealed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-6"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:justify-center">
                <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-muted lg:mb-4">
                  Top 3
                </p>
                <div className="flex flex-1 items-end justify-center gap-2 sm:gap-4 md:gap-6">
                  {podiumSlots.map(({ song, rank, height, delay }) => (
                    <PodiumBlock key={song.id} song={song} rank={rank} heightClass={height} delay={delay} />
                  ))}
                </div>
              </div>

              {rest.length > 0 && (
                <aside className="flex w-full shrink-0 flex-col lg:w-72 xl:w-80">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                    Also ranked ({rest.length})
                  </p>
                  <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[min(520px,calc(100vh-14rem))]">
                    {rest.map((song, i) => (
                      <SideRankRow key={song.id} song={song} rank={4 + i} />
                    ))}
                  </div>
                </aside>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex shrink-0 flex-col items-center border-t border-border/30 pt-6"
            >
              <p className="display-num text-2xl text-accent sm:text-3xl">That&apos;s a wrap!</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 rounded-full border border-border/50 bg-card/60 px-8 py-3 text-sm font-semibold text-white transition hover:bg-card"
              >
                Host Another Party
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </NeroPageShell>
  );
}
