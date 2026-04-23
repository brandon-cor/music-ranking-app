// Spotify search + add-to-queue with a 30s clip start picker (chooser sets start_time_ms).
import { useState, useRef, useEffect } from 'react';
import { searchSpotify, addSong } from '../lib/api';
import type { SpotifyTrack } from '../types';
import { useParty } from '../context/PartyContext';

const CLIP_LENGTH_MS = 30_000;

interface SongSearchProps {
  partyId: string;
}

/** Formats milliseconds as m:ss for the clip start label. */
function formatStartLabel(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongSearch({ partyId }: SongSearchProps) {
  const { currentUser, addSongToList, songs, party } = useParty();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingTrack, setPendingTrack] = useState<SpotifyTrack | null>(null);
  const [clipStartMs, setClipStartMs] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxClipStartMs = pendingTrack
    ? Math.max(0, pendingTrack.duration_ms - CLIP_LENGTH_MS)
    : 0;

  useEffect(() => {
    if (pendingTrack) {
      setClipStartMs(0);
    }
  }, [pendingTrack?.id]);

  const handleSearch = (q: string) => {
    setQuery(q);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchSpotify(partyId, q);
        setResults(data.tracks);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleConfirmAdd = async () => {
    if (!currentUser || !pendingTrack) return;
    if (songs.length >= (party?.max_songs ?? 20)) {
      setError(`Queue is full (max ${party?.max_songs} songs)`);
      return;
    }

    const startMs = Math.min(Math.max(0, clipStartMs), maxClipStartMs);

    setAddingId(pendingTrack.id);
    try {
      const data = await addSong(partyId, pendingTrack, currentUser.name, startMs);
      addSongToList(data.song);
      setResults((prev) => prev.filter((t) => t.id !== pendingTrack.id));
      setPendingTrack(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingId(null);
    }
  };

  const queuedIds = new Set(songs.map((s) => s.spotify_id));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Search Spotify..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-sm text-white shadow-inner placeholder:text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">
            searching…
          </span>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {results.map((track) => {
            const alreadyAdded = queuedIds.has(track.id);
            const isPending = pendingTrack?.id === track.id;
            return (
              <li
                key={track.id}
                className="flex flex-col gap-2 rounded-lg border border-border/30 bg-card/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={track.album.images[0]?.url}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{track.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {track.artists.map((a) => a.name).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (alreadyAdded) return;
                      setPendingTrack(isPending ? null : track);
                      setError('');
                    }}
                    disabled={alreadyAdded || addingId === track.id}
                    className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                      alreadyAdded
                        ? 'cursor-default bg-gray-700 text-gray-500'
                        : addingId === track.id
                          ? 'cursor-wait bg-accent/40 text-white'
                          : isPending
                            ? 'border border-accent/40 bg-white/10 text-white'
                            : 'bg-accent text-white hover:bg-green-400 active:scale-95'
                    }`}
                  >
                    {alreadyAdded
                      ? 'Added'
                      : addingId === track.id
                        ? '…'
                        : isPending
                          ? 'Cancel'
                          : '+ Add'}
                  </button>
                </div>

                {isPending && (
                  <div className="pl-0 pt-1 border-t border-white/10 mt-1 flex flex-col gap-3">
                    <p className="text-xs text-gray-400">
                      Pick where your <strong className="text-white">30s</strong> clip starts:{' '}
                      <strong className="text-accent">{formatStartLabel(clipStartMs)}</strong>
                      {maxClipStartMs === 0 && (
                        <span className="text-gray-500"> (full track under 30s — plays from start)</span>
                      )}
                    </p>
                    {maxClipStartMs > 0 && (
                      <input
                        type="range"
                        min={0}
                        max={maxClipStartMs}
                        step={1000}
                        value={Math.min(clipStartMs, maxClipStartMs)}
                        onChange={(e) => setClipStartMs(Number(e.target.value))}
                        className="w-full accent-green-500"
                      />
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setPendingTrack(null)}
                        className="rounded px-3 py-1.5 text-xs font-bold text-gray-400 border border-border/50 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAdd}
                        disabled={addingId === track.id}
                        className="rounded px-4 py-1.5 text-xs font-bold uppercase bg-accent text-white hover:bg-green-400 disabled:opacity-50"
                      >
                        Add to queue
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
