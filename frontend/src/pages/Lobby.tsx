// Pre-game lobby: Spotify connect, queue build, start party
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

  const allSpotifyReady =
    users.length > 0 && users.every((u) => u.spotify_connected);

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

  return (
    <NeroPageShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-6">
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

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm"
        >
          {currentUser?.spotify_connected ? (
            <p className="text-sm font-semibold text-success">
              You&apos;re connected — you can search, preview clips, and join playback when the party goes live.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Connect your Spotify Premium.</p>
              <a
                href={spotifyAuthUrl}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#1ed760]"
              >
                <SpotifyIcon /> Connect Spotify
              </a>
              <p className="text-sm text-muted">
                Everyone in the room must connect before the host can start.
              </p>
            </div>
          )}
        </motion.section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            In the room ({users.length})
          </h2>
          <UserList users={users} hostId={party.host_id} currentUserId={currentUser?.id ?? null} />
        </section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm"
        >
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">
            Add songs{' '}
            <span className="font-normal text-muted">
              (up to {party.songs_per_user} picks per person)
            </span>
          </h2>

          {currentUser?.spotify_connected ? (
            <SongSearch partyId={party.id} />
          ) : (
            <p className="text-sm italic text-muted">Connect Spotify to search and add tracks.</p>
          )}
        </motion.section>

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
              disabled={songs.length === 0 || !allSpotifyReady}
              className="btn-nero-cta w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-40"
            >
              {songs.length === 0
                ? 'Add songs to start'
                : !allSpotifyReady
                  ? 'Waiting for everyone to connect Spotify'
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
