import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
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
        colors: ['#FFD700', '#FF4500', '#00FF88', '#fff'],
      });
    };
    burst(0.3);
    setTimeout(() => burst(0.7), 150);
    setTimeout(() => burst(0.5), 300);
  };

  const currentRank = results.length - revealedCount + 1;

  if (results.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading results…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <p className="text-gold text-xs font-bold uppercase tracking-widest mb-2">
          {party?.name ?? 'Nero Party'} · Final Results
        </p>
        <h1 className="display-num text-[clamp(48px,12vw,96px)] leading-none">
          THE VERDICT
        </h1>
        {partyId && <PartyCodeEditor partyCode={partyId} className="mt-4 justify-center" />}
      </motion.div>

      {!revealing ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={startReveal}
          className="bg-gold text-black font-black text-2xl px-12 py-5 rounded-2xl uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition animate-bounce"
        >
          🏆 Reveal Results
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
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    isWinner
                      ? 'bg-gold/10 border-gold/50 shadow-[0_0_40px_rgba(255,215,0,0.2)]'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {/* rank badge */}
                  <span
                    className={`display-num text-5xl w-14 text-center shrink-0 ${
                      isWinner ? 'text-gold glow-gold' : 'text-gray-400'
                    }`}
                  >
                    {rankLabel}
                  </span>

                  {/* cover */}
                  <img
                    src={song.cover_url}
                    alt=""
                    className={`w-16 h-16 rounded-xl object-cover shrink-0 ${
                      isWinner ? 'shadow-[0_0_20px_rgba(255,215,0,0.4)]' : ''
                    }`}
                  />

                  {/* info */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-black text-lg leading-tight truncate ${
                        isWinner ? 'text-gold' : 'text-white'
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
                        isWinner ? 'text-gold glow-gold' : 'text-white'
                      }`}
                    >
                      {song.avgScore.toFixed(1)}
                    </span>
                    <p className="text-gray-600 text-xs">avg score</p>
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
              <p className="text-gold display-num text-4xl">That's a wrap! 🎉</p>
              <button
                onClick={() => navigate('/')}
                className="mt-6 bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold px-8 py-3 rounded-xl transition"
              >
                Host Another Party
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
