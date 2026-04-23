import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useParty } from '../context/PartyContext';
import { ApiError, getParty, getSpotifyToken, spotifyPlay } from '../lib/api';
import { playRatingOpen, playVoteConfirm } from '../lib/audio';
import NowPlaying from '../components/NowPlaying';
import Queue from '../components/Queue';
import UserList from '../components/UserList';
import Countdown from '../components/Countdown';
import { PartyCodeEditor } from '../components/PartyCodeEditor';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { RatingWindowState, SpotifyPlayer } from '../types';

const RATING_OPTIONS = [
  { score: 1, emoji: '💀', label: '1 pt' },
  { score: 3, emoji: '😮', label: '3 pt' },
  { score: 5, emoji: '🔥', label: '5 pt' },
] as const;

function emojiForScore(score: number): string {
  const row = RATING_OPTIONS.find((o) => o.score === score);
  return row?.emoji ?? '✓';
}

export default function Player() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const {
    party,
    currentUser,
    users,
    songs,
    currentSong,
    ratingWindow,
    hasVoted,
    voteCount,
    isHost,
    setParty,
    setCurrentUser,
    joinRoom,
    emitSongPlay,
    emitRatingOpen,
    emitRatingSubmit,
    emitPartyEnd,
    leaveParty,
  } = useParty();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [spotifyErrorMessage, setSpotifyErrorMessage] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  const [votedFlash, setVotedFlash] = useState(false);
  const [lastVoteScore, setLastVoteScore] = useState<number | null>(null);
  const [missedVote, setMissedVote] = useState(false);
  const prevRatingWindowRef = useRef<RatingWindowState | null>(null);

  // restore session on refresh
  useEffect(() => {
    if (!partyId) return;
    const restore = async () => {
      try {
        const fetched = await getParty(partyId);
        setParty(fetched);
        let user = currentUser;
        if (!user) {
          const stored = sessionStorage.getItem('nero_user');
          if (stored) {
            user = JSON.parse(stored);
            if (user) setCurrentUser(user);
          }
        }
        if (user) joinRoom(partyId, user.id);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'PARTY_ENDED') {
          leaveParty('ended');
        } else if (err instanceof ApiError && err.status === 404) {
          leaveParty('not_found');
        } else {
          navigate('/');
        }
      }
    };
    if (!party) restore();
    else if (currentUser) joinRoom(partyId, currentUser.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  useEffect(() => {
    const wasOpen = prevRatingWindowRef.current !== null;
    const isOpen = ratingWindow !== null;
    if (wasOpen && !isOpen && !hasVoted && party?.status !== 'ended') {
      setMissedVote(true);
      const t = window.setTimeout(() => setMissedVote(false), 2500);
      prevRatingWindowRef.current = ratingWindow;
      return () => window.clearTimeout(t);
    }
    prevRatingWindowRef.current = ratingWindow;
    return undefined;
  }, [ratingWindow, hasVoted, party?.status]);

  // initialize Spotify Web Playback SDK for the host
  useEffect(() => {
    if (!isHost || !partyId) return;

    const initPlayer = async () => {
      try {
        const { token } = await getSpotifyToken(partyId);

        const sdkReady = () => {
          const onPlayerError = (message: string) => {
            console.warn(message);
            setSpotifyErrorMessage(
              'Spotify playback is unavailable in this browser. Open the host screen in Chrome, reconnect Spotify, then try again.',
            );
          };

          const player: SpotifyPlayer = new window.Spotify.Player({
            name: 'Nero Party',
            getOAuthToken: (cb) => cb(token),
            volume: 0.8,
          });

          player.addListener('ready', (data) => {
            const { device_id } = data as { device_id: string };
            setDeviceId(device_id);
            setSpotifyErrorMessage(null);
          });

          player.addListener('not_ready', () => setDeviceId(null));
          player.addListener('initialization_error', () => onPlayerError('Spotify SDK initialization failed'));
          player.addListener('authentication_error', () => onPlayerError('Spotify SDK authentication failed'));
          player.addListener('account_error', () => onPlayerError('Spotify SDK account check failed'));
          player.addListener('playback_error', () => onPlayerError('Spotify playback error'));

          player.connect().then((success) => {
            if (!success) onPlayerError('Spotify player failed to connect');
          });

          playerRef.current = player;
        };

        if (window.Spotify) {
          sdkReady();
        } else {
          window.onSpotifyWebPlaybackSDKReady = sdkReady;
        }
      } catch {
        console.info('No Spotify token for host — skipping SDK init');
        setSpotifyErrorMessage('Connect Spotify from the lobby before starting songs.');
      }
    };

    initPlayer();

    return () => {
      playerRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, partyId]);

  useEffect(() => {
    if (ratingWindow) {
      playRatingOpen();
      setVotedFlash(false);
      setLastVoteScore(null);
    }
  }, [ratingWindow]);

  const handlePlaySong = async (songId: string) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    if (!partyId || !deviceId) {
      setSpotifyErrorMessage(
        'Spotify player is not ready yet. Make sure the host browser supports Spotify playback and reconnect Spotify.',
      );
      return;
    }

    playerRef.current?.activateElement();

    try {
      await spotifyPlay(
        partyId,
        `spotify:track:${song.spotify_id}`,
        deviceId,
        song.start_time_ms ?? 0,
      );
      setSpotifyErrorMessage(null);
      emitSongPlay(songId);
    } catch (err) {
      console.warn('Spotify play failed:', err);
      setSpotifyErrorMessage(
        'Could not start Spotify playback. Open Spotify on the host browser, then try starting the song again.',
      );
    }
  };

  const handleEmojiVote = (score: number) => {
    if (!ratingWindow || hasVoted) return;
    emitRatingSubmit(ratingWindow.songId, score);
    setLastVoteScore(score);
    setVotedFlash(true);
    playVoteConfirm();
  };

  const currentOrder = currentSong?.order ?? -1;
  const nextSong = songs.find((s) => s.order === currentOrder + 1) ?? null;

  if (!party) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AnimatePresence>
        {missedVote && (
          <motion.div
            key="missed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 px-6"
          >
            <p className="text-center text-xl font-black uppercase tracking-wide text-fiery">
              Too slow! You missed your time.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ratingWindow && (
          <RatingOverlay
            endsAt={ratingWindow.endsAt}
            song={songs.find((s) => s.id === ratingWindow.songId) ?? null}
            hasVoted={hasVoted}
            votedFlash={votedFlash}
            lastVoteScore={lastVoteScore}
            voteCount={voteCount}
            totalUsers={users.length}
            onEmojiVote={handleEmojiVote}
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: party.name, to: `/party/${partyId}/lobby` },
              { label: 'Live' },
            ]}
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-gold text-xs font-bold uppercase tracking-widest">Live</p>
              <h1 className="display-num text-3xl">{party.name}</h1>
            </div>
            {partyId && <PartyCodeEditor partyCode={partyId} />}
            {isHost && (
              <button
                type="button"
                onClick={emitPartyEnd}
                className="text-xs text-gray-600 hover:text-red-400 border border-gray-800 hover:border-red-900 px-3 py-1.5 rounded-lg transition"
              >
                End Party
              </button>
            )}
          </div>
        </div>

        <NowPlaying song={currentSong} />

        {isHost && spotifyErrorMessage && (
          <p className="rounded-lg border border-orange-700/40 bg-orange-900/20 px-3 py-2 text-xs text-orange-200">
            {spotifyErrorMessage}
          </p>
        )}

        {isHost && (
          <div className="flex flex-wrap gap-3">
            {nextSong && !ratingWindow && (
              <button
                type="button"
                onClick={() => handlePlaySong(nextSong.id)}
                className="bg-gold text-black font-black px-6 py-3 rounded-xl uppercase tracking-wide hover:bg-yellow-400 active:scale-95 transition text-sm"
              >
                ▶ Play Song
              </button>
            )}

            {currentSong && !ratingWindow && (
              <button
                type="button"
                onClick={() => emitRatingOpen(currentSong.id)}
                className="bg-fiery text-white font-black px-6 py-3 rounded-xl uppercase tracking-wide hover:bg-orange-500 active:scale-95 transition text-sm"
              >
                🔥 Open Rating
              </button>
            )}

            {deviceId ? (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <span className="w-1.5 h-1.5 bg-success rounded-full" /> Spotify connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" /> Spotify not connected
              </span>
            )}
          </div>
        )}

        <section>
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400 mb-3">Queue</h2>
          <Queue songs={songs} currentSongId={currentSong?.id ?? null} />
        </section>

        <section>
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400 mb-3">
            In the room ({users.length})
          </h2>
          <UserList
            users={users}
            hostId={party.host_id}
            currentUserId={currentUser?.id ?? null}
          />
        </section>
      </div>
    </div>
  );
}

interface RatingOverlayProps {
  endsAt: number;
  song: import('../types').Song | null;
  hasVoted: boolean;
  votedFlash: boolean;
  lastVoteScore: number | null;
  voteCount: number;
  totalUsers: number;
  onEmojiVote: (score: number) => void;
}

function RatingOverlay({
  endsAt,
  song,
  hasVoted,
  votedFlash,
  lastVoteScore,
  voteCount,
  totalUsers,
  onEmojiVote,
}: RatingOverlayProps) {
  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pt-10">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', damping: 15 }}
        >
          <h2 className="display-num text-[clamp(48px,12vw,96px)] text-gold glow-gold leading-none">
            HOT TAKE
          </h2>
        </motion.div>

        {song && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-4"
          >
            <img
              src={song.cover_url}
              alt=""
              className="w-20 h-20 rounded-xl object-cover shadow-2xl"
            />
            <div>
              <p className="font-black text-xl leading-tight">{song.title}</p>
              <p className="text-gray-400 text-sm">{song.artist}</p>
            </div>
          </motion.div>
        )}

        <Countdown endsAt={endsAt} />

        <p className="text-gray-500 text-sm">
          {voteCount} / {totalUsers} voted
        </p>
      </div>

      <div className="p-6 pb-10 border-t border-white/10 bg-black/50 backdrop-blur-sm">
        <AnimatePresence mode="wait">
          {votedFlash && lastVoteScore != null ? (
            <motion.div
              key="voted"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="flex flex-col items-center gap-2 py-4"
            >
              <span className="display-num text-6xl text-success glow-gold">YOU VOTED</span>
              <span className="text-5xl" aria-hidden>
                {emojiForScore(lastVoteScore)}
              </span>
              <span className="text-gray-400 text-sm">
                <strong className="text-white">{lastVoteScore}</strong> pt locked in
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="emoji-pick"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-5"
            >
              <p className="text-center text-xs uppercase tracking-widest text-gray-500">
                Tap one — Skull (1) · Woah (3) · Fire (5)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {RATING_OPTIONS.map(({ score, emoji, label }) => (
                  <button
                    key={score}
                    type="button"
                    disabled={hasVoted}
                    onClick={() => onEmojiVote(score)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-6 px-2 transition active:scale-95 ${
                      hasVoted
                        ? 'border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed'
                        : 'border-white/20 bg-white/5 hover:border-gold/60 hover:bg-gold/10'
                    }`}
                  >
                    <span className="text-4xl" aria-hidden>
                      {emoji}
                    </span>
                    <span className="text-xs font-black uppercase text-gray-400">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
