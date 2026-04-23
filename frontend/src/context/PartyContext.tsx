import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import type { Party, Song, SongResult, User, RatingWindowState } from '../types';

// shared reason for the toast/alert that explains why we kicked the user
const PARTY_CLOSED_REASONS: Record<string, string> = {
  host_left: 'The host left, so the party has been closed.',
  ended: 'This party has already ended.',
  not_found: "We couldn't find that party — it may have been closed.",
};

interface PartyContextValue {
  party: Party | null;
  currentUser: User | null;
  users: User[];
  songs: Song[];
  currentSong: Song | null;
  ratingWindow: RatingWindowState | null;
  /** When non-null, rating timer is frozen at this many ms left (host paused playback). */
  ratingPausedRemainingMs: number | null;
  hasVoted: boolean;
  voteCount: number;
  /** User ids who submitted a rating for the current song (from server tally). */
  votedUserIds: string[];
  results: SongResult[];
  isHost: boolean;
  // actions
  setParty: (p: Party) => void;
  setCurrentUser: (u: User) => void;
  joinRoom: (partyId: string, userId: string) => void;
  emitSongPlay: (songId: string) => void;
  emitRatingOpen: (songId: string) => void;
  emitRatingSubmit: (songId: string, score: number) => void;
  emitSongSkip: () => void;
  emitSongPause: () => void;
  emitSongResume: () => void;
  emitPartyEnd: () => void;
  addSongToList: (song: Song) => void;
  emitUserReady: (ready: boolean) => void;
  leaveParty: (reasonKey?: string) => void;
}

const PartyContext = createContext<PartyContextValue | null>(null);

export function PartyProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const socket = getSocket();

  const [party, setPartyState] = useState<Party | null>(null);
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('nero_user');
    return stored ? (JSON.parse(stored) as User) : null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [ratingWindow, setRatingWindow] = useState<RatingWindowState | null>(null);
  const [ratingPausedRemainingMs, setRatingPausedRemainingMs] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [votedUserIds, setVotedUserIds] = useState<string[]>([]);
  const [results, setResults] = useState<SongResult[]>([]);

  // track the current song id so event handlers always read fresh value
  const currentSongRef = useRef<Song | null>(null);
  currentSongRef.current = currentSong;

  const isHost = !!(currentUser && party && party.host_id === currentUser.id);

  function setParty(p: Party) {
    setPartyState(p);
    setUsers(p.users ?? []);
    setSongs(p.songs ?? []);
  }

  function setCurrentUser(u: User) {
    setCurrentUserState(u);
    sessionStorage.setItem('nero_user', JSON.stringify(u));
  }

  // wipe local session and bounce home — used when the party gets shut down
  // server-side so the user can't just retype the URL to come back.
  function leaveParty(reasonKey?: string) {
    sessionStorage.removeItem('nero_user');
    setPartyState(null);
    setCurrentUserState(null);
    setUsers([]);
    setSongs([]);
    setCurrentSong(null);
    setRatingWindow(null);
    setRatingPausedRemainingMs(null);
    setHasVoted(false);
    setVoteCount(0);
    setVotedUserIds([]);
    setResults([]);
    if (reasonKey && PARTY_CLOSED_REASONS[reasonKey]) {
      // a queryParam keeps things shareable / refreshable without state drama
      navigate(`/?reason=${reasonKey}`);
    } else {
      navigate('/');
    }
  }

  function joinRoom(partyId: string, userId: string) {
    socket.emit('party:join', { partyId, userId });
  }

  function emitSongPlay(songId: string) {
    socket.emit('song:play', { songId });
  }

  function emitRatingOpen(songId: string) {
    setHasVoted(false);
    setVoteCount(0);
    setVotedUserIds([]);
    setRatingPausedRemainingMs(null);
    socket.emit('rating:open', { songId });
  }

  function emitRatingSubmit(songId: string, score: number) {
    socket.emit('rating:submit', { songId, score });
  }

  function emitSongSkip() {
    socket.emit('song:skip');
  }

  const emitSongPause = useCallback(() => {
    socket.emit('song:pause');
  }, [socket]);

  const emitSongResume = useCallback(() => {
    socket.emit('song:resume');
  }, [socket]);

  function emitPartyEnd() {
    socket.emit('party:end');
  }

  function emitUserReady(ready: boolean) {
    socket.emit('user:ready', { ready });
  }

  function addSongToList(song: Song) {
    setSongs((prev) => [...prev, song].sort((a, b) => a.order - b.order));
  }

  useEffect(() => {
    // full party state snapshot sent on join
    socket.on('party:state', (data: Party) => {
      setPartyState(data);
      setUsers(data.users ?? []);
      setSongs(data.songs ?? []);

      setCurrentUserState((prev) => {
        if (!prev) return prev;
        const fresh = data.users?.find((u) => u.id === prev.id);
        return fresh ? { ...prev, ...fresh } : prev;
      });

      // restore current song if party is already playing
      if (data.current_song_id && data.songs) {
        const song = data.songs.find((s) => s.id === data.current_song_id) ?? null;
        setCurrentSong(song);
      } else {
        setCurrentSong(null);
      }
    });

    socket.on('user:joined', ({ user }: { user: User }) => {
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.id === user.id);
        if (idx === -1) return [...prev, user];
        const next = [...prev];
        next[idx] = { ...next[idx], ...user };
        return next;
      });
    });

    socket.on('user:left', ({ userId }: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on('user:updated', ({ user }: { user: User }) => {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...user } : u)));
      setCurrentUserState((prev) => {
        if (!prev || prev.id !== user.id) return prev;
        const next = { ...prev, ...user };
        sessionStorage.setItem('nero_user', JSON.stringify(next));
        return next;
      });
    });

    socket.on('song:play', ({ song }: { song: Song }) => {
      setCurrentSong(song);
      setRatingWindow(null);
      setRatingPausedRemainingMs(null);
      setHasVoted(false);
      setVoteCount(0);
      setVotedUserIds([]);
    });

    socket.on(
      'rating:open',
      ({ songId, endsAt, duration }: { songId: string; endsAt: number; duration: number }) => {
        setRatingWindow({ songId, endsAt, duration });
        setRatingPausedRemainingMs(null);
        setHasVoted(false);
        setVoteCount(0);
        setVotedUserIds([]);
      },
    );

    socket.on(
      'rating:pause',
      ({ remainingMs }: { songId: string; remainingMs: number }) => {
        setRatingPausedRemainingMs(Math.max(0, remainingMs));
      },
    );

    socket.on(
      'rating:resume',
      ({
        songId,
        endsAt,
        durationMs,
      }: {
        songId: string;
        endsAt: number;
        durationMs: number;
      }) => {
        setRatingWindow({ songId, endsAt, duration: durationMs / 1000 });
        setRatingPausedRemainingMs(null);
      },
    );

    socket.on('rating:confirmed', () => {
      setHasVoted(true);
    });

    socket.on(
      'rating:tally',
      ({
        voteCount: vc,
        votedUserIds: ids,
      }: {
        voteCount: number;
        votedUserIds?: string[];
      }) => {
        setVoteCount(vc);
        if (ids) setVotedUserIds(ids);
      },
    );

    socket.on('rating:close', () => {
      setRatingWindow(null);
      setRatingPausedRemainingMs(null);
      setVotedUserIds([]);
    });

    socket.on('party:end', ({ results: r }: { results: SongResult[] }) => {
      setResults(r);
      setRatingWindow(null);
      setRatingPausedRemainingMs(null);
      setVotedUserIds([]);
      setPartyState((prev) => (prev ? { ...prev, status: 'ended' } : prev));
      // navigate everyone to the podium
      if (party?.id) navigate(`/party/${party.id}/podium`);
    });

    // host bailed (or party was abandoned) — the URL is no longer valid.
    socket.on('party:closed', ({ reason }: { reason?: string }) => {
      leaveParty(reason ?? 'ended');
    });

    // server told us the party doesn't exist anymore
    socket.on('party:not_found', () => {
      leaveParty('not_found');
    });

    return () => {
      socket.off('party:state');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('user:updated');
      socket.off('song:play');
      socket.off('rating:open');
      socket.off('rating:pause');
      socket.off('rating:resume');
      socket.off('rating:confirmed');
      socket.off('rating:tally');
      socket.off('rating:close');
      socket.off('party:end');
      socket.off('party:closed');
      socket.off('party:not_found');
    };
  // leaveParty is stable enough for our purposes; rebinding only on party id change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, navigate, party?.id]);

  const value: PartyContextValue = {
    party,
    currentUser,
    users,
    songs,
    currentSong,
    ratingWindow,
    ratingPausedRemainingMs,
    hasVoted,
    voteCount,
    votedUserIds,
    results,
    isHost,
    setParty,
    setCurrentUser,
    joinRoom,
    emitSongPlay,
    emitRatingOpen,
    emitRatingSubmit,
    emitSongSkip,
    emitSongPause,
    emitSongResume,
    emitPartyEnd,
    addSongToList,
    emitUserReady,
    leaveParty,
  };

  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty(): PartyContextValue {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error('useParty must be used inside <PartyProvider>');
  return ctx;
}
