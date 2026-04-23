// Party results — staged reveal, confetti, nero.fan–aligned styling
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { NeroPageShell } from '../components/NeroPageShell';
import { useParty } from '../context/PartyContext';
import { getResults } from '../lib/api';
import { PartyCodeEditor } from '../components/PartyCodeEditor';
import type { SongResult } from '../types';

export default function Podium() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const { results: ctxResults, party } = useParty();

  const [results, setResults] = useState<SongResult[]>(ctxResults);
  const [revealedCount, setRevealedCount] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const confettiFiredRef = useRef(false);

  // fetch results from API if context doesn't have them (page refresh)
  useEffect(() => {
    if (results.length > 0) return;
    if (!partyId) return;

    getResults(partyId)
      .then(({ results: r }) => setResults(r))
      .catch(() => navigate('/'));
  }, [partyId, results.length, navigate]);

  // reverse so we reveal worst → best
  const ranked = [...results].reverse();

  const startReveal = () => {
    if (revealing) return;
    setRevealing(true);
    setRevealedCount(0);

    let i = 0;
    const next = () => {
      i++;
      setRevealedCount(i);

      // fire confetti for the winner (last reveal)
      if (i === ranked.length && !confettiFiredRef.current) {
        confettiFiredRef.current = true;
        setTimeout(() => fireConfetti(), 300);
      }

      if (i < ranked.length) {
        setTimeout(next, 2500);
      }
    };
    setTimeout(next, 500);
  };

  const fireConfetti = () => {
    const burst = (originX: number) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { x: originX, y: 0.6 },
        colors: ['#22c55e', '#00ff94', '#FF4500', '#fff'],
      });
    };
    burst(0.3);
    setTimeout(() => burst(0.7), 150);
    setTimeout(() => burst(0.5), 300);
  };

  const currentRank = results.length - revealedCount + 1;

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
      <div className="flex flex-col items-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
          {party?.name ?? 'Nero Party'} · Final Results
        </p>
        <h1 className="display-num text-[clamp(48px,12vw,96px)] leading-none text-white">
          THE VERDICT
        </h1>
        {partyId && <PartyCodeEditor partyCode={partyId} className="mt-4 justify-center" />}
      </motion.div>

      {!revealing ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={startReveal}
          className="btn-nero-cta animate-bounce px-12 py-5 text-2xl font-black uppercase tracking-widest"
        >
          Reveal Results
        </motion.button>
      ) : (
        <div className="w-full max-w-lg flex flex-col gap-4">
          <AnimatePresence>
            {ranked.slice(0, revealedCount).map((song, i) => {
              const rank = ranked.length - i; // #1 is last revealed
              const isWinner = rank === 1;
              const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

              return (
                <motion.div
                  key={song.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7, y: 60 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    damping: 16,
                    stiffness: 180,
                  }}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                    isWinner
                      ? 'border-accent/50 bg-accent/10 shadow-accent-glow-lg'
                      : 'border-border/40 bg-card/60'
                  }`}
                >
                  {/* rank badge */}
                  <span
                    className={`display-num w-14 shrink-0 text-center text-5xl ${
                      isWinner ? 'glow-accent text-accent' : 'text-gray-400'
                    }`}
                  >
                    {rankLabel}
                  </span>

                  {/* cover */}
                  <img
                    src={song.cover_url}
                    alt=""
                    className={`h-16 w-16 shrink-0 rounded-xl object-cover ${
                      isWinner ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)]' : ''
                    }`}
                  />

                  {/* info */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-lg font-black leading-tight ${
                        isWinner ? 'text-accent' : 'text-white'
                      }`}
                    >
                      {song.title}
                    </p>
                    <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {song.ratings.length} vote{song.ratings.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* score */}
                  <div className="shrink-0 text-right">
                    <span
                      className={`display-num text-4xl tabular-nums ${
                        isWinner ? 'glow-accent text-accent' : 'text-white'
                      }`}
                    >
                      {song.avgScore.toFixed(1)}
                    </span>
                    <p className="text-gray-600 text-xs">avg / 5</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* "next up" teaser while revealing */}
          {revealedCount < ranked.length && (
            <motion.div
              key={`teaser-${revealedCount}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <p className="text-gray-500 text-sm uppercase tracking-widest animate-pulse">
                #{currentRank} coming up…
              </p>
            </motion.div>
          )}

          {/* all revealed */}
          {revealedCount === ranked.length && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center pt-4"
            >
              <p className="display-num text-4xl text-accent">That&apos;s a wrap!</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-6 rounded-full border border-border/50 bg-card/60 px-8 py-3 text-sm font-semibold text-white transition hover:bg-card"
              >
                Host Another Party
              </button>
            </motion.div>
          )}
        </div>
      )}
      </div>
    </NeroPageShell>
  );
}
