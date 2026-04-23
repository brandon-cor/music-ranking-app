// Landing: create or join a party; styled to feel like a nero.fan subpage
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createParty, joinParty } from '../lib/api';
import { useParty } from '../context/PartyContext';
import { NeroPageShell } from '../components/NeroPageShell';
import { randomDjDisplayName, randomPartyIdea } from '../lib/homeRandomSuggestions';

type Tab = 'create' | 'join';

const REASON_MESSAGES: Record<string, string> = {
  host_left: 'The host left, so the party has been closed.',
  ended: 'That party has already ended.',
  not_found: "We couldn't find that party — the link may no longer be valid.",
};

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setParty, setCurrentUser, joinRoom } = useParty();
  const [tab, setTab] = useState<Tab>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reason = searchParams.get('reason');
  const reasonMessage = reason ? REASON_MESSAGES[reason] : null;

  useEffect(() => {
    if (!reason) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('reason');
      setSearchParams(next, { replace: true });
    }, 8000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

  const [partyName, setPartyName] = useState('');
  const [hostName, setHostName] = useState('');
  const [songsPerUser, setSongsPerUser] = useState(3);

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
        songs_per_user: songsPerUser,
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
    <NeroPageShell>
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10 text-center"
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Party
          </p>
          <h1 className="display-num text-[clamp(2.5rem,12vw,5rem)] leading-[0.95] text-white">
            nero
            <span className="text-accent">.</span>party
          </h1>
          <p className="mt-3 max-w-sm text-balance text-sm text-muted">
            Rate songs. Settle debates. Crown the banger.
          </p>
        </motion.div>

        {reasonMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 w-full max-w-md rounded-2xl border border-orange-700/30 bg-card/60 px-4 py-3 text-sm text-orange-200"
            role="alert"
          >
            {reasonMessage}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm"
        >
          <div className="inline-flex w-full p-1">
            {(['create', 'join'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError('');
                }}
                className={`flex-1 rounded-full py-2.5 text-center text-xs font-semibold uppercase tracking-widest transition ${
                  tab === t
                    ? 'bg-foreground/10 text-white ring-1 ring-[#00ff94]/20'
                    : 'text-muted hover:text-foreground/90'
                }`}
              >
                {t === 'create' ? 'Host a Party' : 'Join a Party'}
              </button>
            ))}
          </div>

          <div className="border-t border-border/30 p-6">
            {tab === 'create' ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <Field
                  label="Party Name"
                  value={partyName}
                  onChange={setPartyName}
                  placeholder="Type a name or tap Shuffle"
                  onShuffle={() => setPartyName(randomPartyIdea())}
                />
                <Field
                  label="Your Name"
                  value={hostName}
                  onChange={setHostName}
                  placeholder="Type a name or tap Shuffle (starts with DJ)"
                  onShuffle={() => setHostName(randomDjDisplayName())}
                />

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Songs per User
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={songsPerUser}
                      onChange={(e) => setSongsPerUser(Number(e.target.value))}
                      className="h-1.5 flex-1 appearance-none rounded-full accent-green-500"
                    />
                    <span className="w-12 text-right text-sm font-semibold text-accent">
                      {songsPerUser}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    How many tracks each guest (and you) can queue up.
                  </p>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button type="submit" disabled={loading} className="btn-nero-cta w-full disabled:cursor-not-allowed">
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
                  placeholder="Type a name or tap Shuffle (starts with DJ)"
                  onShuffle={() => setGuestName(randomDjDisplayName())}
                />

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button type="submit" disabled={loading} className="btn-nero-cta w-full">
                  {loading ? 'Joining…' : 'Join Party'}
                </button>
              </form>
            )}
          </div>
        </motion.div>

        <p className="mt-8 max-w-xs text-center text-xs text-muted">
          Host needs Spotify Premium to play music. Guests just need a name.
        </p>
      </div>
    </NeroPageShell>
  );
}

/** Circular looping arrows — randomize field (heroicons arrow-path style) */
function RandomizeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  onShuffle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onShuffle?: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-white shadow-inner placeholder:text-foreground/35 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        {onShuffle && (
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Randomize"
            title="Randomize"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted transition hover:border-accent/40 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 active:scale-95"
          >
            <RandomizeIcon />
          </button>
        )}
      </div>
    </div>
  );
}
