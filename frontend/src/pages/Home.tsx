import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createParty, joinParty } from '../lib/api';
import { useParty } from '../context/PartyContext';

type Tab = 'create' | 'join';

export default function Home() {
  const navigate = useNavigate();
  const { setParty, setCurrentUser, joinRoom } = useParty();
  const [tab, setTab] = useState<Tab>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // create form
  const [partyName, setPartyName] = useState('');
  const [hostName, setHostName] = useState('');
  const [ratingWindow, setRatingWindow] = useState(30);
  const [maxSongs, setMaxSongs] = useState(20);
  const [showScores, setShowScores] = useState(false);

  // join form
  const [partyCode, setPartyCode] = useState('');
  const [guestName, setGuestName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim() || !hostName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { party, user } = await createParty({
        name: partyName.trim(),
        hostName: hostName.trim(),
        rating_window_seconds: ratingWindow,
        max_songs: maxSongs,
        show_scores: showScores,
      });
      setParty(party);
      setCurrentUser(user);
      joinRoom(party.id, user.id);
      navigate(`/party/${party.id}/lobby`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyCode.trim() || !guestName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { user } = await joinParty(partyCode.trim(), guestName.trim());
      const { getParty } = await import('../lib/api');
      const party = await getParty(partyCode.trim());
      setParty(party);
      setCurrentUser(user);
      joinRoom(party.id, user.id);

      // send to wherever the party currently is
      if (party.status === 'ended') {
        navigate(`/party/${party.id}/podium`);
      } else if (party.status === 'playing') {
        navigate(`/party/${party.id}/play`);
      } else {
        navigate(`/party/${party.id}/lobby`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      {/* hero */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center mb-12"
      >
        <h1 className="display-num text-[clamp(64px,15vw,140px)] leading-none glow-gold text-gold">
          NERO PARTY
        </h1>
        <p className="text-gray-400 text-lg mt-2 font-medium">
          Rate songs. Settle debates. Crown the banger.
        </p>
      </motion.div>

      {/* card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
      >
        {/* tabs */}
        <div className="flex">
          {(['create', 'join'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'bg-gold text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'create' ? '🎉 Host a Party' : '🎵 Join a Party'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Field
                label="Party Name"
                value={partyName}
                onChange={setPartyName}
                placeholder="e.g. Friday Night Bangers"
              />
              <Field
                label="Your Name"
                value={hostName}
                onChange={setHostName}
                placeholder="e.g. DJ Nero"
              />

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">
                    Rating Window
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={15}
                      max={60}
                      step={5}
                      value={ratingWindow}
                      onChange={(e) => setRatingWindow(Number(e.target.value))}
                      className="flex-1 accent-gold"
                    />
                    <span className="text-gold font-bold text-sm w-12 text-right">{ratingWindow}s</span>
                  </div>
                </div>

                <div className="w-28">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">
                    Max Songs
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxSongs}
                    onChange={(e) => setMaxSongs(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/60 text-center"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showScores}
                  onChange={(e) => setShowScores(e.target.checked)}
                  className="w-4 h-4 accent-gold rounded"
                />
                <span className="text-sm text-gray-300">
                  Show scores mid-party{' '}
                  <span className="text-gray-600 text-xs">(off = full reveal at the end)</span>
                </span>
              </label>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-gold text-black font-black text-lg py-3 rounded-xl uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-wait"
              >
                {loading ? 'Creating…' : 'Create Party'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <Field
                label="Party Code"
                value={partyCode}
                onChange={setPartyCode}
                placeholder="Paste the party ID here"
              />
              <Field
                label="Your Name"
                value={guestName}
                onChange={setGuestName}
                placeholder="e.g. Music Fan"
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-gold text-black font-black text-lg py-3 rounded-xl uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-wait"
              >
                {loading ? 'Joining…' : 'Join Party'}
              </button>
            </form>
          )}
        </div>
      </motion.div>

      <p className="mt-8 text-gray-700 text-xs text-center max-w-xs">
        Host needs Spotify Premium to play music. Guests just need a name.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold/60 focus:bg-white/15 transition"
      />
    </div>
  );
}
