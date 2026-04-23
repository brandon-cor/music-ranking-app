import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useParty } from '../context/PartyContext';
import { ApiError, getParty } from '../lib/api';
import SongSearch from '../components/SongSearch';
import Queue from '../components/Queue';
import UserList from '../components/UserList';
import { PartyCodeEditor } from '../components/PartyCodeEditor';
import { Breadcrumbs } from '../components/Breadcrumbs';
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

  const [spotifyConnected, setSpotifyConnected] = useState(false);

  // restore session if user refreshed
  useEffect(() => {
    if (!partyId) return;

    const restoreAndJoin = async () => {
      try {
        const fetched = await getParty(partyId);
        setParty(fetched);

        let user = currentUser;
        // if no user in context, try sessionStorage
        if (!user) {
          const stored = sessionStorage.getItem('nero_user');
          if (stored) {
            user = JSON.parse(stored);
            if (user) setCurrentUser(user);
          }
        }
        if (user) joinRoom(partyId, user.id);
      } catch (err) {
        // 410 (PARTY_ENDED) → kick to home with a friendly reason; everything
        // else is a generic redirect home.
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
  // intentionally run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // check if Spotify was just connected via OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify') === 'connected') {
      setSpotifyConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // listen for the host starting the party
  useEffect(() => {
    const socket = getSocket();
    const handler = () => navigate(`/party/${partyId}/play`);
    socket.on('party:start', handler);
    return () => { socket.off('party:start', handler); };
  }, [partyId, navigate]);

  const handleStartParty = () => {
    if (!party || !currentUser) return;
    const socket = getSocket();
    socket.emit('party:start', { partyId: party.id });
    navigate(`/party/${party.id}/play`);
  };

  const spotifyAuthUrl = partyId ? `/api/spotify/auth?partyId=${partyId}` : '#';

  if (!party) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading party…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* header */}
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
          <p className="text-gold text-xs font-bold uppercase tracking-widest">Party Lobby</p>
          <h1 className="display-num text-5xl">{party.name}</h1>

          {/* party code share */}
          {partyId && <PartyCodeEditor partyCode={partyId} className="mt-2" />}
        </motion.div>

        {/* Spotify connect (host only) */}
        {isHost && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5"
          >
            <h2 className="font-bold text-sm uppercase tracking-wide mb-3">
              🎧 Spotify Playback
            </h2>
            {spotifyConnected ? (
              <p className="text-success text-sm font-semibold">
                ✓ Spotify connected — you can play music from the party screen
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-gray-400 text-sm">
                  Connect your Spotify Premium account to control playback.
                </p>
                <a
                  href={spotifyAuthUrl}
                  className="inline-flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold px-5 py-2.5 rounded-full text-sm transition w-fit"
                >
                  <SpotifyIcon /> Connect Spotify
                </a>
              </div>
            )}
          </motion.section>
        )}

        {/* users */}
        <section>
          <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400 mb-3">
            In the room ({users.length})
          </h2>
          <UserList users={users} hostId={party.host_id} currentUserId={currentUser?.id ?? null} />
        </section>

        {/* song search */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-xl p-5"
        >
          <h2 className="font-bold text-sm uppercase tracking-wide mb-3">
            🎵 Add Songs{' '}
            <span className="text-gray-500 font-normal">
              ({songs.length} / {party.max_songs})
            </span>
          </h2>

          {spotifyConnected || isHost ? (
            <SongSearch partyId={party.id} />
          ) : (
            <p className="text-gray-500 text-sm italic">
              Only the host can search while Spotify is connected.
            </p>
          )}
        </motion.section>

        {/* queue preview */}
        {songs.length > 0 && (
          <section>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400 mb-3">
              Queue
            </h2>
            <Queue songs={songs} currentSongId={null} />
          </section>
        )}

        {/* config summary */}
        <div className="flex gap-4 text-xs text-gray-600">
          <span>⏱ {party.rating_window_seconds}s rating window</span>
          <span>🎵 Max {party.max_songs} songs</span>
          {party.show_scores && <span>📊 Scores visible mid-party</span>}
        </div>

        {/* start party (host only) */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={handleStartParty}
              disabled={songs.length === 0}
              className="w-full bg-gold text-black font-black text-xl py-4 rounded-xl uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {songs.length === 0 ? 'Add songs to start' : '🎉 Start the Party!'}
            </button>
          </motion.div>
        )}

        {!isHost && (
          <p className="text-center text-gray-600 text-sm animate-pulse">
            Waiting for the host to start the party…
          </p>
        )}
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
