// Pre-game lobby: two-column room + add songs, host Spotify status, queue and start
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useParty } from '../context/PartyContext';
import { ApiError, getParty } from '../lib/api';
import type { User } from '../types';
import SongSearch from '../components/SongSearch';
import Queue from '../components/Queue';
import UserList from '../components/UserList';
import { PartyCodeEditor } from '../components/PartyCodeEditor';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { NeroPageShell } from '../components/NeroPageShell';
import { getSocket } from '../lib/socket';

export default function Lobby() {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const {
    party,
    currentUser,
    users,
    songs,
    setParty,
    setCurrentUser,
    joinRoom,
    isHost,
    leaveParty,
  } = useParty();

  useEffect(() => {
    if (!partyId) return;

    const restoreAndJoin = async () => {
      try {
        const fetched = await getParty(partyId);
        setParty(fetched);

        let user = currentUser;
        if (!user) {
          const stored = sessionStorage.getItem('nero_user');
          if (stored) {
            user = JSON.parse(stored) as User;
            if (user) setCurrentUser(user);
          }
        }
        if (user) {
          const fresh = fetched.users?.find((u) => u.id === user.id);
          if (fresh) setCurrentUser({ ...user, ...fresh });
          joinRoom(partyId, user.id);
        }
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

    if (!party) restoreAndJoin();
    else if (currentUser) joinRoom(partyId, currentUser.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // After Spotify OAuth redirect, wait for the server to confirm `party:join` before
  // notifying the room — avoids a race where `user:spotify_connected` ran before socket.data was set.
  useEffect(() => {
    if (!partyId || !currentUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify') !== 'connected') return;

    const socket = getSocket();

    const onPartyState = () => {
      socket.emit('user:spotify_connected');
      window.history.replaceState({}, '', window.location.pathname);
      socket.off('party:state', onPartyState);
    };

    socket.on('party:state', onPartyState);
    joinRoom(partyId, currentUser.id);

    return () => {
      socket.off('party:state', onPartyState);
    };
  }, [partyId, currentUser?.id, joinRoom]);

  useEffect(() => {
    const socket = getSocket();
    const handler = () => navigate(`/party/${partyId}/play`);
    socket.on('party:start', handler);
    return () => {
      socket.off('party:start', handler);
    };
  }, [partyId, navigate]);

  const handleStartParty = () => {
    if (!party || !currentUser) return;
    const socket = getSocket();
    socket.emit('party:start', { partyId: party.id });
    navigate(`/party/${party.id}/play`);
  };

  const spotifyAuthUrl =
    partyId && currentUser
      ? `/api/spotify/auth?userId=${encodeURIComponent(currentUser.id)}&partyId=${encodeURIComponent(partyId)}`
      : '#';

  if (!party) {
    return (
      <NeroPageShell>
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <p className="text-muted animate-pulse">Loading party…</p>
        </div>
      </NeroPageShell>
    );
  }

  const hostConnected = !!users.find((u) => u.id === party.host_id)?.spotify_connected;

  return (
    <NeroPageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: party.name },
            ]}
          />
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Party Lobby</p>
          <h1 className="display-num text-4xl text-white sm:text-5xl">{party.name}</h1>

          {partyId && <PartyCodeEditor partyCode={partyId} className="mt-2" />}
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex min-h-[280px] flex-col rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm lg:min-h-[min(480px,calc(100vh-14rem))]"
          >
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              In the room ({users.length})
            </h2>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="min-h-[120px] flex-1">
                <UserList users={users} hostId={party.host_id} currentUserId={currentUser?.id ?? null} />
              </div>
              {(isHost || !hostConnected) && (
                <div className="mt-auto border-t border-border/30 pt-4">
                  {isHost && hostConnected && (
                    <div
                      className="flex items-center justify-center gap-2.5 sm:justify-start"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                      </span>
                      <span className="text-sm font-semibold text-success">Spotify connected</span>
                    </div>
                  )}
                  {isHost && !hostConnected && (
                    <a
                      href={spotifyAuthUrl}
                      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-full bg-[#1DB954] px-5 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(29,185,84,0.35)] transition hover:bg-[#1ed760] sm:w-auto"
                    >
                      <SpotifyIcon /> Connect Spotify
                    </a>
                  )}
                  {!isHost && !hostConnected && (
                    <p className="animate-pulse text-sm text-muted">Waiting for host to connect Spotify…</p>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex min-h-[280px] flex-col rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm lg:min-h-[min(480px,calc(100vh-14rem))]"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Add songs{' '}
                <span className="font-normal text-muted">
                  ({party.songs_per_user} per person · {party.songs_per_user * users.length} total)
                </span>
              </h2>
              <p className="text-xs text-muted">
                Your picks:{' '}
                <strong className="text-white">
                  {songs.filter((s) => s.added_by_user_id === currentUser?.id).length}
                </strong>{' '}
                / {party.songs_per_user}
              </p>
            </div>

            <div className="min-h-0 flex-1">
              <SongSearch partyId={party.id} />
            </div>
          </motion.section>
        </div>

        {songs.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Queue</h2>
            <Queue songs={songs} currentSongId={null} />
          </section>
        )}

        <p className="text-xs text-muted">
          When the party starts, everyone gets a <strong className="text-white">30s</strong> window to rate each clip.
        </p>

        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              type="button"
              onClick={handleStartParty}
              disabled={songs.length === 0 || !hostConnected}
              className="btn-nero-cta w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              {songs.length === 0
                ? 'Add songs to start'
                : !hostConnected
                  ? 'Waiting for host to connect Spotify'
                  : 'Start the Party'}
            </button>
          </motion.div>
        )}

        {!isHost && (
          <p className="text-center text-sm text-muted animate-pulse">Waiting for the host to start the party…</p>
        )}
      </div>
    </NeroPageShell>
  );
}

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
