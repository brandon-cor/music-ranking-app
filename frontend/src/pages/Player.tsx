import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NeroPageShell } from '../components/NeroPageShell';
import { useParty } from '../context/PartyContext';
import { ApiError, getParty, spotifyPlay } from '../lib/api';
import { useUserSpotifyPlayer } from '../lib/spotify-sdk';
import { playRatingOpen } from '../lib/audio';
import { IPodPlayer } from '../components/IPodPlayer';
import { RatingPanel } from '../components/RatingPanel';
import { CircleCountdown } from '../components/CircleCountdown';
import { VoteCelebration, type CelebrationScore } from '../components/VoteCelebration';
import StartCountdown from '../components/StartCountdown';
import Queue from '../components/Queue';
import UserList from '../components/UserList';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { RatingWindowState, User } from '../types';

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
    votedUserIds,
    isHost,
    setParty,
    setCurrentUser,
    joinRoom,
    emitSongPlay,
    emitRatingSubmit,
    emitSongSkip,
    emitSongPause,
    emitSongResume,
    ratingPausedRemainingMs,
    emitPartyEnd,
    emitPartyAbandon,
    leaveParty,
  } = useParty();

  const { deviceId, playerRef, player: playerInstance, errorMessage: sdkSpotifyError, clearError } =
    useUserSpotifyPlayer(currentUser?.id, isHost && !!currentUser?.spotify_connected);

  const [localPlayError, setLocalPlayError] = useState<string | null>(null);
  const [showStartCountdown, setShowStartCountdown] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const autoPlayLaunchedRef = useRef(false);
  // true while a page refresh/close is in progress — distinguishes unload from React navigation
  const isPageUnloadRef = useRef(false);
  // stable ref to isHost so the cleanup closure always reads the latest value
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  // pending abandon timer — cancelled on remount (handles React StrictMode double-invoke)
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spotifyErrorMessage = localPlayError || sdkSpotifyError;

  const [celebrationScore, setCelebrationScore] = useState<CelebrationScore | null>(null);
  const [missedVote, setMissedVote] = useState(false);
  const prevRatingWindowRef = useRef<RatingWindowState | null>(null);
  const wasRatingOpenRef = useRef(false);
  const handlePlaySongRef = useRef<(songId: string) => Promise<void>>(async () => {});

  // restore session on refresh
  useEffect(() => {
    if (!partyId) return;
    const restore = async () => {
      try {
        const fetched = await getParty(partyId);
        setParty(fetched);
        let user: User | null = currentUser;
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
    if (!party) restore();
    else if (currentUser) joinRoom(partyId, currentUser.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // Mark page-unload (refresh / tab-close) so the abandon cleanup can skip those cases.
  useEffect(() => {
    const onBeforeUnload = () => { isPageUnloadRef.current = true; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // When the host navigates away from /play via React Router (not a refresh/close),
  // end the session for all guests. We use a short-lived timer so that React Strict
  // Mode's intentional mount→cleanup→remount cycle cancels the abandon on remount.
  useEffect(() => {
    // On mount/remount, cancel any abandon queued by a previous cleanup.
    if (abandonTimerRef.current !== null) {
      clearTimeout(abandonTimerRef.current);
      abandonTimerRef.current = null;
    }

    return () => {
      if (isHostRef.current && !isPageUnloadRef.current) {
        abandonTimerRef.current = setTimeout(() => {
          abandonTimerRef.current = null;
          emitPartyAbandon();
        }, 400);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (party?.status === 'playing' && !currentSong && songs.length > 0 && !introDone) {
      setShowStartCountdown(true);
    }
  }, [party?.status, currentSong, songs.length, introDone]);

  useEffect(() => {
    if (party?.status !== 'playing') {
      setShowStartCountdown(false);
    }
  }, [party?.status]);

  useEffect(() => {
    if (currentSong) {
      setShowStartCountdown(false);
      setIntroDone(true);
      autoPlayLaunchedRef.current = true;
    }
  }, [currentSong]);

  const onStartCountdownComplete = useCallback(() => {
    setShowStartCountdown(false);
    setIntroDone(true);
  }, []);

  useEffect(() => {
    if (!introDone || autoPlayLaunchedRef.current || !isHost || currentSong) return;
    const first = songs[0];
    if (!first || !deviceId || !currentUser?.id) return;
    autoPlayLaunchedRef.current = true;
    void (async () => {
      playerRef.current?.activateElement();
      try {
        await spotifyPlay(
          currentUser.id,
          `spotify:track:${first.spotify_id}`,
          deviceId,
          first.start_time_ms ?? 0,
        );
        setLocalPlayError(null);
        clearError();
        emitSongPlay(first.id);
      } catch (err) {
        console.warn('Spotify auto-play failed:', err);
        autoPlayLaunchedRef.current = false;
        setLocalPlayError(
          'Could not start Spotify playback. Open Spotify on the host browser and try again.',
        );
      }
    })();
  }, [introDone, deviceId, songs, isHost, currentSong, currentUser?.id, emitSongPlay, playerRef, clearError]);

  useEffect(() => {
    if (ratingWindow) {
      playRatingOpen();
    }
  }, [ratingWindow]);

  const handlePlaySong = useCallback(
    async (songId: string) => {
      const song = songs.find((s) => s.id === songId);
      if (!song || !currentUser?.id) return;

      if (!deviceId) {
        setLocalPlayError(
          'Spotify player is not ready yet. Make sure the host browser supports Spotify playback and reconnect Spotify.',
        );
        return;
      }

      playerRef.current?.activateElement();

      try {
        await spotifyPlay(
          currentUser.id,
          `spotify:track:${song.spotify_id}`,
          deviceId,
          song.start_time_ms ?? 0,
        );
        setLocalPlayError(null);
        clearError();
        emitSongPlay(songId);
      } catch (err) {
        console.warn('Spotify play failed:', err);
        setLocalPlayError(
          'Could not start Spotify playback. Open Spotify on the host browser, then try starting the song again.',
        );
      }
    },
    [songs, currentUser?.id, deviceId, playerRef, clearError, emitSongPlay],
  );

  handlePlaySongRef.current = handlePlaySong;

  const handleReplayClip = useCallback(async () => {
    const song = currentSong;
    if (!song || !currentUser?.id || !deviceId) return;
    playerRef.current?.activateElement();
    try {
      await spotifyPlay(
        currentUser.id,
        `spotify:track:${song.spotify_id}`,
        deviceId,
        song.start_time_ms ?? 0,
      );
      setLocalPlayError(null);
      clearError();
    } catch (err) {
      console.warn('Replay clip failed:', err);
      setLocalPlayError('Could not replay from the clip start. Try again.');
    }
  }, [currentSong, currentUser?.id, deviceId, playerRef, clearError]);

  const dismissCelebration = useCallback(() => {
    setCelebrationScore(null);
  }, []);

  const onRatingPlaybackTransition = useCallback(
    (paused: boolean) => {
      if (paused) emitSongPause();
      else emitSongResume();
    },
    [emitSongPause, emitSongResume],
  );

  useEffect(() => {
    const justClosed = wasRatingOpenRef.current && ratingWindow === null;
    wasRatingOpenRef.current = ratingWindow !== null;

    if (!justClosed || !isHost || !currentSong) return;

    try {
      void playerRef.current?.pause();
    } catch {
      /* Spotify SDK may throw if not ready */
    }

    const next = songs.find((s) => s.order === currentSong.order + 1) ?? null;
    const t = window.setTimeout(() => {
      if (!next) {
        emitPartyEnd();
        return;
      }
      void handlePlaySongRef.current(next.id);
    }, 0);

    return () => window.clearTimeout(t);
  }, [ratingWindow, currentSong, isHost, songs, emitPartyEnd, playerRef]);

  const handleEmojiVote = (score: number) => {
    if (!ratingWindow || hasVoted) return;
    const normalized: CelebrationScore = score === 1 || score === 5 ? score : 3;
    emitRatingSubmit(ratingWindow.songId, normalized);
    setCelebrationScore(normalized);
  };

  const displayedVotedUserIds = useMemo(() => {
    const set = new Set(votedUserIds);
    if (hasVoted && currentUser?.id) set.add(currentUser.id);
    return Array.from(set);
  }, [votedUserIds, hasVoted, currentUser?.id]);

  if (!party) {
    return (
      <NeroPageShell>
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <p className="text-muted animate-pulse">Loading…</p>
        </div>
      </NeroPageShell>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showStartCountdown && (
          <StartCountdown key="start-countdown" onComplete={onStartCountdownComplete} />
        )}
      </AnimatePresence>

      {celebrationScore !== null && (
        <VoteCelebration score={celebrationScore} onDone={dismissCelebration} />
      )}

      <AnimatePresence>
        {missedVote && (
          <motion.div
            key="missed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMissedVote(false)}
            role="alert"
            aria-live="assertive"
            className="fixed inset-x-0 bottom-6 z-[100] mx-auto flex w-fit max-w-[90vw] cursor-pointer items-center gap-3 rounded-2xl border border-fiery/30 bg-card/95 px-5 py-3.5 shadow-lg backdrop-blur-sm"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-fiery">
              Too slow — you missed that round.
            </span>
            <span className="ml-1 text-xs text-muted/60">Tap to dismiss</span>
          </motion.div>
        )}
      </AnimatePresence>

      <NeroPageShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-6">
          <div className="flex flex-col gap-3">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: party.name, to: `/party/${partyId}/lobby` },
                { label: 'Live' },
              ]}
            />

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Live</p>
              <h1 className="display-num text-3xl text-white">{party.name}</h1>
            </div>
          </div>

          {isHost && spotifyErrorMessage && (
            <p className="rounded-2xl border border-orange-700/30 bg-card/50 px-3 py-2 text-xs text-orange-200">
              {spotifyErrorMessage}
            </p>
          )}

          <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(180px,240px)] lg:items-stretch lg:h-[min(560px,calc(100vh-12rem))]">
            <div className="flex min-h-0 flex-col gap-4 lg:h-full lg:overflow-hidden">
              <section className="flex min-h-0 shrink-0 flex-col" style={{ maxHeight: '35%' }}>
                <h2 className="mb-3 shrink-0 text-sm font-bold uppercase tracking-wide text-muted">
                  In the room ({users.length})
                </h2>
                <div className="scrollbar-left min-h-0 flex-1 overflow-y-auto">
                  <UserList
                    users={users}
                    hostId={party.host_id}
                    currentUserId={currentUser?.id ?? null}
                    votedUserIds={displayedVotedUserIds}
                  />
                </div>
              </section>
              <section className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-3 shrink-0 text-sm font-bold uppercase tracking-wide text-muted">Queue</h2>
                <div className="scrollbar-left min-h-0 flex-1 overflow-y-auto">
                  <Queue songs={songs} currentSongId={currentSong?.id ?? null} />
                </div>
              </section>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col justify-stretch">
              <IPodPlayer
                song={currentSong}
                isHost={isHost}
                player={playerInstance}
                onReplayClip={isHost ? () => void handleReplayClip() : undefined}
                onSkipRating={isHost ? emitSongSkip : undefined}
                showSkip={!!ratingWindow}
                fillHeight
                trackRatingPause={isHost && !!ratingWindow}
                onRatingPlaybackTransition={isHost ? onRatingPlaybackTransition : undefined}
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-col items-center gap-4 pt-2">
              {ratingWindow && (
                <CircleCountdown
                  endsAt={ratingWindow.endsAt}
                  durationMs={ratingWindow.duration * 1000}
                  pausedRemainingMs={ratingPausedRemainingMs}
                  size={104}
                />
              )}
              <RatingPanel ratingWindow={ratingWindow} hasVoted={hasVoted} onEmojiVote={handleEmojiVote} />
            </div>
          </div>
        </div>
      </NeroPageShell>
    </>
  );
}
