import { useState, useRef } from 'react';
import { searchSpotify, addSong } from '../lib/api';
import type { SpotifyTrack } from '../types';
import { useParty } from '../context/PartyContext';

interface SongSearchProps {
  partyId: string;
}

export default function SongSearch({ partyId }: SongSearchProps) {
  const { currentUser, addSongToList, songs, party } = useParty();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleAdd = async (track: SpotifyTrack) => {
    if (!currentUser) return;
    if (songs.length >= (party?.max_songs ?? 20)) {
      setError(`Queue is full (max ${party?.max_songs} songs)`);
      return;
    }

    setAddingId(track.id);
    try {
      const data = await addSong(partyId, track, currentUser.name);
      addSongToList(data.song);
      setResults((prev) => prev.filter((t) => t.id !== track.id));
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
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/60 focus:bg-white/15 transition"
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
            return (
              <li
                key={track.id}
                className="flex items-center gap-3 bg-white/5 rounded-lg p-3"
              >
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
                  onClick={() => handleAdd(track)}
                  disabled={alreadyAdded || addingId === track.id}
                  className={`shrink-0 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition ${
                    alreadyAdded
                      ? 'bg-gray-700 text-gray-500 cursor-default'
                      : addingId === track.id
                        ? 'bg-gold/50 text-black cursor-wait'
                        : 'bg-gold text-black hover:bg-yellow-400 active:scale-95'
                  }`}
                >
                  {alreadyAdded ? 'Added' : addingId === track.id ? '…' : '+ Add'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
